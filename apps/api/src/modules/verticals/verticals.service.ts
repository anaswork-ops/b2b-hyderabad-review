import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import type { OfferingStatus, Prisma, User } from '@prisma/client';
import type {
  TourismInput,
  VisaInput,
  VerticalSearch,
} from '@b2b/validation/verticals';
import { getDatabase } from '../../platform/db/prisma.js';
import { AuditService } from '../audit/audit.service.js';
const transitions: Record<string, [OfferingStatus[], OfferingStatus]> = {
  PUBLISH: [['DRAFT', 'PAUSED'], 'PUBLISHED'],
  PAUSE: [['PUBLISHED'], 'PAUSED'],
  RESUME: [['PAUSED'], 'PUBLISHED'],
  ARCHIVE: [['DRAFT', 'PUBLISHED', 'PAUSED'], 'ARCHIVED'],
};
@Injectable()
export class VerticalsService {
  private db = getDatabase();
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}
  private async profile(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const p = await this.db.businessProfile.findFirst({
      where: { business: { primaryOwnerId: user.id, status: 'APPROVED' } },
      select: { id: true },
    });
    if (!p) throw new ForbiddenException('Approved business profile required');
    return p;
  }
  private rules(items: (TourismInput | VisaInput)['availability']) {
    return items.map((x) => ({
      ...x,
      startDate: x.startDate ? new Date(x.startDate) : null,
      endDate: x.endDate ? new Date(x.endDate) : null,
      blackoutDates: x.blackoutDates.map((d) => new Date(d)),
    }));
  }
  async mine(user: User) {
    const p = await this.profile(user);
    const [tourism, visa] = await Promise.all([
      this.db.tourismPackage.findMany({
        where: { profileId: p.id },
        include: { availability: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.visaService.findMany({
        where: { profileId: p.id },
        include: { availability: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { tourism, visa };
  }
  async createTourism(user: User, input: TourismInput) {
    const p = await this.profile(user),
      { availability, ...data } = input;
    return this.db.tourismPackage.create({
      data: {
        ...data,
        profileId: p.id,
        availability: { create: this.rules(availability) },
      },
      include: { availability: true },
    });
  }
  async createVisa(user: User, input: VisaInput) {
    const p = await this.profile(user),
      { availability, ...data } = input;
    return this.db.visaService.create({
      data: {
        ...data,
        profileId: p.id,
        availability: { create: this.rules(availability) },
      },
      include: { availability: true },
    });
  }
  async update(
    user: User,
    kind: 'tourism' | 'visa',
    id: string,
    input: TourismInput | VisaInput,
  ) {
    const p = await this.profile(user),
      model = kind === 'tourism' ? this.db.tourismPackage : this.db.visaService,
      current = await (model as any).findFirst({
        where: { id, profileId: p.id },
      });
    if (!current) throw new NotFoundException('Listing not found');
    if (current.status === 'ARCHIVED')
      throw new BadRequestException('Archived listing cannot be edited');
    const { availability, ...data } = input;
    return this.db.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({
        where:
          kind === 'tourism' ? { tourismPackageId: id } : { visaServiceId: id },
      });
      return (
        kind === 'tourism' ? tx.tourismPackage : (tx.visaService as any)
      ).update({
        where: { id },
        data: { ...data, availability: { create: this.rules(availability) } },
        include: { availability: true },
      });
    });
  }
  async lifecycle(
    user: User,
    kind: 'tourism' | 'visa',
    id: string,
    action: string,
  ) {
    const p = await this.profile(user),
      model = kind === 'tourism' ? this.db.tourismPackage : this.db.visaService,
      current = await (model as any).findFirst({
        where: { id, profileId: p.id },
      });
    if (!current) throw new NotFoundException('Listing not found');
    const [allowed, next] = transitions[action] ?? [[], 'DRAFT'];
    if (!allowed.includes(current.status))
      throw new BadRequestException('Invalid transition');
    return (model as any).update({
      where: { id },
      data: {
        status: next,
        publishedAt:
          next === 'PUBLISHED'
            ? (current.publishedAt ?? new Date())
            : current.publishedAt,
      },
    });
  }
  private availability(
    q: VerticalSearch,
  ): Prisma.AvailabilityRuleListRelationFilter | undefined {
    if (!q.startDate || !q.endDate) return undefined;
    return {
      some: {
        OR: [
          { kind: 'YEAR_ROUND' },
          { kind: 'ON_REQUEST' },
          { kind: 'RECURRING' },
          {
            kind: 'DATE_RANGE',
            startDate: { lte: new Date(q.startDate) },
            endDate: { gte: new Date(q.endDate) },
          },
          {
            kind: 'FIXED_DEPARTURE',
            startDate: { gte: new Date(q.startDate), lte: new Date(q.endDate) },
          },
        ],
      },
    };
  }
  async search(q: VerticalSearch) {
    const skip = (q.page - 1) * q.pageSize,
      availability = this.availability(q),
      common = {
        status: 'PUBLISHED' as const,
        moderationHidden: false,
        profile: { business: { status: 'APPROVED' as const } },
        ...(q.market ? { sourceMarket: q.market } : {}),
        ...(q.destination
          ? {
              destinationCountry: {
                contains: q.destination,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(q.pricingMode ? { pricingMode: q.pricingMode } : {}),
        ...(q.currency ? { currency: q.currency } : {}),
        ...(q.maxPrice ? { price: { lte: q.maxPrice } } : {}),
        ...(availability ? { availability } : {}),
      };
    if (q.vertical === 'tourism') {
      const where: Prisma.TourismPackageWhereInput = {
        ...common,
        ...(q.category
          ? { category: { contains: q.category, mode: 'insensitive' } }
          : {}),
        ...(q.groupSize
          ? {
              AND: [
                {
                  OR: [
                    { minimumGroupSize: null },
                    { minimumGroupSize: { lte: q.groupSize } },
                  ],
                },
                {
                  OR: [
                    { maximumGroupSize: null },
                    { maximumGroupSize: { gte: q.groupSize } },
                  ],
                },
              ],
            }
          : {}),
      };
      const [items, total] = await Promise.all([
        this.db.tourismPackage.findMany({
          where,
          skip,
          take: q.pageSize,
          include: {
            profile: { select: { name: true, publicSlug: true } },
            availability: true,
          },
          orderBy: { updatedAt: 'desc' },
        }),
        this.db.tourismPackage.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    }
    const where: Prisma.VisaServiceWhereInput = {
      ...common,
      ...(q.category
        ? { visaCategory: { contains: q.category, mode: 'insensitive' } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.visaService.findMany({
        where,
        skip,
        take: q.pageSize,
        include: {
          profile: { select: { name: true, publicSlug: true } },
          availability: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.db.visaService.count({ where }),
    ]);
    return {
      items: items.map((x) => ({
        ...x,
        disclaimer:
          'Visa approval, appointments and processing times are determined by government or consular authorities and are never guaranteed.',
      })),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  }
  async detail(kind: 'tourism' | 'visa', id: string) {
    const item =
      kind === 'tourism'
        ? await this.db.tourismPackage.findFirst({
            where: {
              id,
              status: 'PUBLISHED',
              moderationHidden: false,
              profile: { business: { status: 'APPROVED' } },
            },
            include: {
              profile: {
                select: {
                  name: true,
                  publicSlug: true,
                  headquartersCountry: true,
                },
              },
              availability: true,
            },
          })
        : await this.db.visaService.findFirst({
            where: {
              id,
              status: 'PUBLISHED',
              moderationHidden: false,
              profile: { business: { status: 'APPROVED' } },
            },
            include: {
              profile: {
                select: {
                  name: true,
                  publicSlug: true,
                  headquartersCountry: true,
                },
              },
              availability: true,
            },
          });
    if (!item) throw new NotFoundException('Listing not found');
    return kind === 'visa'
      ? {
          ...item,
          disclaimer:
            'Visa approval, appointments and processing times are determined by government or consular authorities and are never guaranteed.',
        }
      : item;
  }

  async adminList(
    kind: 'tourism' | 'visa',
    q: import('@b2b/validation/admin').AdminQuery,
  ) {
    if (kind === 'tourism') {
      const where = {
        ...(q.q
          ? { name: { contains: q.q, mode: 'insensitive' as const } }
          : {}),
        ...(q.businessId ? { profile: { businessId: q.businessId } } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.tourismPackage.findMany({
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
        this.db.tourismPackage.count({ where }),
      ]);
      return { items, total, page: q.page };
    }
    if (kind === 'visa') {
      const where = {
        ...(q.q
          ? { name: { contains: q.q, mode: 'insensitive' as const } }
          : {}),
        ...(q.businessId ? { profile: { businessId: q.businessId } } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.visaService.findMany({
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
        this.db.visaService.count({ where }),
      ]);
      return { items, total, page: q.page };
    }
    throw new BadRequestException('Invalid listing kind');
  }
  async adminDetail(kind: 'tourism' | 'visa', id: string) {
    if (kind === 'tourism') {
      const item = await this.db.tourismPackage.findUnique({
        where: { id },
        include: { availability: true },
      });
      if (!item) throw new NotFoundException('Listing not found');
      return item;
    }
    if (kind === 'visa') {
      const item = await this.db.visaService.findUnique({
        where: { id },
        include: { availability: true },
      });
      if (!item) throw new NotFoundException('Listing not found');
      return item;
    }
    throw new BadRequestException('Invalid listing kind');
  }
  async moderate(
    admin: User,
    kind: 'tourism' | 'visa',
    id: string,
    hidden: boolean,
    reason: string,
  ) {
    if (!['ADMIN', 'SUPER_ADMIN'].includes(admin.role))
      throw new ForbiddenException('Access denied');
    return this.db.$transaction(async (tx) => {
      if (kind === 'tourism') {
        const changed = await tx.tourismPackage.updateMany({
          where: { id, moderationHidden: !hidden },
          data: { moderationHidden: hidden },
        });
        if (!changed.count)
          throw new BadRequestException(
            'Listing missing or moderation state changed; reload',
          );
      }
      if (kind === 'visa') {
        const changed = await tx.visaService.updateMany({
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
      tourism: await this.db.tourismPackage.count({
        where: {
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
      }),
      visa: await this.db.visaService.count({
        where: {
          status: 'PUBLISHED',
          moderationHidden: false,
          profile: { business: { status: 'APPROVED' } },
        },
      }),
    };
  }
}
