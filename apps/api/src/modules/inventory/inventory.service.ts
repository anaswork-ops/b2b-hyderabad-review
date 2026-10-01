import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OfferingStatus, Prisma, User } from '@prisma/client';
import type {
  PackageInput,
  ServiceInput,
  OfferInput,
} from '@b2b/validation/inventory';
import { getDatabase } from '../../platform/db/prisma.js';
import { AuditService } from '../audit/audit.service.js';
import { FilesService } from '../files/files.service.js';

const transitions: Record<string, [OfferingStatus[], OfferingStatus]> = {
  PUBLISH: [['DRAFT', 'PAUSED'], 'PUBLISHED'],
  PAUSE: [['PUBLISHED'], 'PAUSED'],
  RESUME: [['PAUSED'], 'PUBLISHED'],
  ARCHIVE: [['DRAFT', 'PUBLISHED', 'PAUSED'], 'ARCHIVED'],
};
const json = (value: unknown) => value as Prisma.InputJsonValue;
@Injectable()
export class InventoryService {
  private readonly db = getDatabase();
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}
  private async profile(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const profile = await this.db.businessProfile.findFirst({
      where: { business: { primaryOwnerId: user.id, status: 'APPROVED' } },
      select: { id: true },
    });
    if (!profile)
      throw new ForbiddenException('Approved business profile required');
    return profile;
  }
  async list(user: User) {
    const profile = await this.profile(user);
    const [packages, services, offers] = await Promise.all([
      this.db.package.findMany({
        where: { profileId: profile.id },
        include: {
          availability: true,
          media: {
            select: {
              id: true,
              kind: true,
              filename: true,
              contentType: true,
              isPublic: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.service.findMany({
        where: { profileId: profile.id },
        include: {
          availability: true,
          media: {
            select: {
              id: true,
              kind: true,
              filename: true,
              contentType: true,
              isPublic: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.offer.findMany({
        where: { profileId: profile.id },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { packages, services, offers };
  }
  private availability(
    input: PackageInput['availability'] | ServiceInput['availability'],
  ) {
    return input.map((item) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate) : null,
      endDate: item.endDate ? new Date(item.endDate) : null,
      blackoutDates: item.blackoutDates.map((date) => new Date(date)),
    }));
  }
  async createPackage(user: User, input: PackageInput) {
    const profile = await this.profile(user);
    const { availability, ...data } = input;
    return this.db.package.create({
      data: {
        ...data,
        accommodation: json(data.accommodation),
        transport: json(data.transport),
        flights: data.flights ? json(data.flights) : undefined,
        validFrom: data.validFrom ? new Date(data.validFrom) : null,
        validTo: data.validTo ? new Date(data.validTo) : null,
        price: data.price,
        profileId: profile.id,
        availability: { create: this.availability(availability) },
      },
      include: { availability: true },
    });
  }
  async updatePackage(user: User, id: string, input: PackageInput) {
    const profile = await this.profile(user);
    const current = await this.db.package.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!current) throw new NotFoundException('Package not found');
    if (current.status === 'ARCHIVED')
      throw new BadRequestException('Archived package cannot be edited');
    const { availability, ...data } = input;
    return this.db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { packageId: id } });
      return tx.package.update({
        where: { id },
        data: {
          ...data,
          accommodation: json(data.accommodation),
          transport: json(data.transport),
          flights: data.flights ? json(data.flights) : undefined,
          validFrom: data.validFrom ? new Date(data.validFrom) : null,
          validTo: data.validTo ? new Date(data.validTo) : null,
          price: data.price,
          availability: { create: this.availability(availability) },
        },
        include: { availability: true },
      });
    });
  }
  async packageLifecycle(
    user: User,
    id: string,
    action: keyof typeof transitions,
  ) {
    const profile = await this.profile(user);
    const current = await this.db.package.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!current) throw new NotFoundException('Package not found');
    const [allowed, next] = transitions[action] ?? [[], 'DRAFT'];
    if (!allowed.includes(current.status))
      throw new BadRequestException('Invalid package transition');
    const result = await this.db.package.update({
      where: { id },
      data: {
        status: next,
        publishedAt:
          next === 'PUBLISHED'
            ? (current.publishedAt ?? new Date())
            : current.publishedAt,
      },
    });
    await this.audit.record(
      user.id,
      `package.${action.toLowerCase()}`,
      'package',
      'success',
    );
    return result;
  }
  async duplicatePackage(user: User, id: string) {
    const profile = await this.profile(user);
    const source = await this.db.package.findFirst({
      where: { id, profileId: profile.id },
      include: { availability: true },
    });
    if (!source) throw new NotFoundException('Package not found');
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      status: _status,
      moderationHidden: _moderationHidden,
      publishedAt: _published,
      availability,
      ...data
    } = source;
    return this.db.package.create({
      data: {
        ...data,
        accommodation: json(data.accommodation),
        transport: json(data.transport),
        flights: data.flights === null ? undefined : json(data.flights),
        name: `${source.name} (Copy)`.slice(0, 200),
        status: 'DRAFT',
        availability: {
          create: availability.map(
            ({
              id: _rule,
              packageId: _package,
              serviceId: _service,
              createdAt: _at,
              ...rule
            }) => rule,
          ),
        },
      },
      include: { availability: true },
    });
  }
  async deleteDraftPackage(user: User, id: string) {
    const profile = await this.profile(user);
    const deleted = await this.db.package.deleteMany({
      where: { id, profileId: profile.id, status: 'DRAFT' },
    });
    if (!deleted.count)
      throw new BadRequestException(
        'Only an owned draft package can be deleted',
      );
    return { deleted: true };
  }
  async createService(user: User, input: ServiceInput) {
    const profile = await this.profile(user);
    const { availability, ...data } = input;
    return this.db.service.create({
      data: {
        ...data,
        price: data.price,
        profileId: profile.id,
        availability: { create: this.availability(availability) },
      },
      include: { availability: true },
    });
  }
  async updateService(user: User, id: string, input: ServiceInput) {
    const profile = await this.profile(user);
    const current = await this.db.service.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!current) throw new NotFoundException('Service not found');
    if (current.status === 'ARCHIVED')
      throw new BadRequestException('Archived service cannot be edited');
    const { availability, ...data } = input;
    return this.db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { serviceId: id } });
      return tx.service.update({
        where: { id },
        data: {
          ...data,
          price: data.price,
          availability: { create: this.availability(availability) },
        },
        include: { availability: true },
      });
    });
  }
  async serviceLifecycle(
    user: User,
    id: string,
    action: keyof typeof transitions,
  ) {
    const profile = await this.profile(user);
    const current = await this.db.service.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!current) throw new NotFoundException('Service not found');
    const [allowed, next] = transitions[action] ?? [[], 'DRAFT'];
    if (!allowed.includes(current.status))
      throw new BadRequestException('Invalid service transition');
    return this.db.service.update({ where: { id }, data: { status: next } });
  }
  async deleteDraftService(user: User, id: string) {
    const profile = await this.profile(user);
    const deleted = await this.db.service.deleteMany({
      where: { id, profileId: profile.id, status: 'DRAFT' },
    });
    if (!deleted.count)
      throw new BadRequestException(
        'Only an owned draft service can be deleted',
      );
    return { deleted: true };
  }
  async createOffer(user: User, input: OfferInput) {
    const profile = await this.profile(user);
    if (
      input.packageId &&
      !(await this.db.package.findFirst({
        where: { id: input.packageId, profileId: profile.id },
      }))
    )
      throw new ForbiddenException('Package access denied');
    if (
      input.serviceId &&
      !(await this.db.service.findFirst({
        where: { id: input.serviceId, profileId: profile.id },
      }))
    )
      throw new ForbiddenException('Service access denied');
    return this.db.offer.create({
      data: {
        ...input,
        profileId: profile.id,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        price: input.price,
      },
    });
  }
  async updateOffer(user: User, id: string, input: OfferInput) {
    const profile = await this.profile(user);
    const current = await this.db.offer.findFirst({
      where: { id, profileId: profile.id },
    });
    if (!current) throw new NotFoundException('Offer not found');
    if (
      input.packageId &&
      !(await this.db.package.findFirst({
        where: { id: input.packageId, profileId: profile.id },
      }))
    )
      throw new ForbiddenException('Package access denied');
    if (
      input.serviceId &&
      !(await this.db.service.findFirst({
        where: { id: input.serviceId, profileId: profile.id },
      }))
    )
      throw new ForbiddenException('Service access denied');
    return this.db.offer.update({
      where: { id },
      data: {
        ...input,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        price: input.price,
      },
    });
  }
  async deleteOffer(user: User, id: string) {
    const profile = await this.profile(user);
    const deleted = await this.db.offer.deleteMany({
      where: { id, profileId: profile.id },
    });
    if (!deleted.count) throw new NotFoundException('Offer not found');
    return { deleted: true };
  }
  async uploadPackageMedia(
    user: User,
    packageId: string,
    input: {
      kind: string;
      filename: string;
      contentType: string;
      isPublic: boolean;
      bytes: Buffer;
    },
  ) {
    const profile = await this.profile(user);
    const item = await this.db.package.findFirst({
      where: { id: packageId, profileId: profile.id },
    });
    if (!item) throw new NotFoundException('Package not found');
    if (!input.bytes.length || input.bytes.length > 5 * 1024 * 1024)
      throw new BadRequestException('Invalid media size');
    const valid =
      input.contentType === 'application/pdf'
        ? input.bytes.subarray(0, 5).toString() === '%PDF-'
        : input.contentType === 'image/png'
          ? input.bytes
              .subarray(0, 8)
              .equals(Buffer.from('89504e470d0a1a0a', 'hex'))
          : input.contentType === 'image/jpeg'
            ? input.bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
            : input.contentType === 'image/webp'
              ? input.bytes.subarray(0, 4).toString() === 'RIFF' &&
                input.bytes.subarray(8, 12).toString() === 'WEBP'
              : false;
    if (!valid) throw new BadRequestException('Unsupported media type');
    const filename = input.filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 120);
    if (!filename) throw new BadRequestException('Invalid filename');
    const id = crypto.randomUUID();
    const storageKey = `phase4/${profile.id}/${packageId}/${id}`;
    await this.files.put(storageKey, input.bytes, input.contentType);
    return this.db.offeringMedia.create({
      data: {
        id,
        packageId,
        kind: input.kind,
        filename,
        contentType: input.contentType,
        sizeBytes: input.bytes.length,
        storageKey,
        isPublic: input.isPublic,
      },
    });
  }
  async packageMedia(user: User, packageId: string, id: string) {
    const profile = await this.profile(user);
    const media = await this.db.offeringMedia.findFirst({
      where: { id, packageId, package: { profileId: profile.id } },
    });
    if (!media) throw new NotFoundException('Media not found');
    return { ...media, bytes: await this.files.get(media.storageKey) };
  }
  async publicPackageMedia(slug: string, packageId: string, id: string) {
    const media = await this.db.offeringMedia.findFirst({
      where: {
        id,
        packageId,
        isPublic: true,
        package: {
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { publicSlug: slug, business: { status: 'APPROVED' } },
        },
      },
    });
    if (!media) throw new NotFoundException('Media not found');
    return { ...media, bytes: await this.files.get(media.storageKey) };
  }

  async adminList(
    kind: 'packages' | 'services' | 'offers',
    q: import('@b2b/validation/admin').AdminQuery,
  ) {
    if (kind === 'packages') {
      const where = {
        ...(q.q
          ? { name: { contains: q.q, mode: 'insensitive' as const } }
          : {}),
        ...(q.businessId ? { profile: { businessId: q.businessId } } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.package.findMany({
          where,
          skip: (q.page - 1) * 25,
          take: 25,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            status: true,
            moderationHidden: true,
            profile: { select: { name: true, businessId: true } },
          },
        }),
        this.db.package.count({ where }),
      ]);
      return { items, total, page: q.page };
    }
    if (kind === 'services') {
      const where = {
        ...(q.q
          ? { name: { contains: q.q, mode: 'insensitive' as const } }
          : {}),
        ...(q.businessId ? { profile: { businessId: q.businessId } } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.service.findMany({
          where,
          skip: (q.page - 1) * 25,
          take: 25,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            status: true,
            moderationHidden: true,
            profile: { select: { name: true, businessId: true } },
          },
        }),
        this.db.service.count({ where }),
      ]);
      return { items, total, page: q.page };
    }
    if (kind === 'offers') {
      const where = {
        ...(q.q
          ? { title: { contains: q.q, mode: 'insensitive' as const } }
          : {}),
        ...(q.businessId ? { profile: { businessId: q.businessId } } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.offer.findMany({
          where,
          skip: (q.page - 1) * 25,
          take: 25,
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            title: true,
            active: true,
            moderationHidden: true,
            profile: { select: { name: true, businessId: true } },
          },
        }),
        this.db.offer.count({ where }),
      ]);
      return { items, total, page: q.page };
    }
    throw new BadRequestException('Invalid listing kind');
  }
  async adminDetail(kind: 'packages' | 'services' | 'offers', id: string) {
    if (kind === 'packages') {
      const item = await this.db.package.findUnique({
        where: { id },
        include: { availability: true },
      });
      if (!item) throw new NotFoundException('Listing not found');
      return item;
    }
    if (kind === 'services') {
      const item = await this.db.service.findUnique({
        where: { id },
        include: { availability: true },
      });
      if (!item) throw new NotFoundException('Listing not found');
      return item;
    }
    if (kind === 'offers') {
      const item = await this.db.offer.findUnique({ where: { id } });
      if (!item) throw new NotFoundException('Listing not found');
      return item;
    }
    throw new BadRequestException('Invalid listing kind');
  }
  async moderate(
    admin: User,
    kind: 'packages' | 'services' | 'offers',
    id: string,
    hidden: boolean,
    reason: string,
  ) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(admin.role))
      throw new ForbiddenException('Access denied');
    return this.db.$transaction(async (tx) => {
      if (kind === 'packages') {
        const changed = await tx.package.updateMany({
          where: { id, moderationHidden: !hidden },
          data: { moderationHidden: hidden },
        });
        if (!changed.count)
          throw new BadRequestException(
            'Listing missing or moderation state changed; reload',
          );
      }
      if (kind === 'services') {
        const changed = await tx.service.updateMany({
          where: { id, moderationHidden: !hidden },
          data: { moderationHidden: hidden },
        });
        if (!changed.count)
          throw new BadRequestException(
            'Listing missing or moderation state changed; reload',
          );
      }
      if (kind === 'offers') {
        const changed = await tx.offer.updateMany({
          where: { id, moderationHidden: !hidden },
          data: { moderationHidden: hidden },
        });
        if (!changed.count)
          throw new BadRequestException(
            'Listing missing or moderation state changed; reload',
          );
      }
      await this.audit.record(
        admin.id,
        hidden ? 'moderation.hide' : 'moderation.restore',
        kind,
        'success',
        tx,
        { resourceId: id, reason },
      );
      return { hidden };
    });
  }
  async adminCounts() {
    return {
      packages: await this.db.package.count({
        where: {
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
      }),
      services: await this.db.service.count({
        where: {
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
      }),
      offers: await this.db.offer.count({
        where: {
          active: true,
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
      }),
    };
  }
}
