import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import type { ProfileInput } from '@b2b/validation/inventory';
import { getDatabase } from '../../platform/db/prisma.js';
@Injectable()
export class BusinessProfilesService {
  private readonly db = getDatabase();
  private async approved(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const business = await this.db.business.findFirst({
      where: { primaryOwnerId: user.id, status: 'APPROVED' },
      select: { id: true },
    });
    if (!business) throw new ForbiddenException('Approved business required');
    return business;
  }
  async mine(user: User) {
    const business = await this.approved(user);
    return this.db.businessProfile.findUnique({
      where: { businessId: business.id },
      include: {
        _count: { select: { packages: true, services: true, offers: true } },
      },
    });
  }
  async save(user: User, input: ProfileInput) {
    const business = await this.approved(user);
    const data = {
      ...input,
      publicEmail: input.publicEmail || null,
      publicPhone: input.publicPhone || null,
      website: input.website || null,
      licenceNumber: input.licenceNumber || null,
      licenceIssuer: input.licenceIssuer || null,
    };
    try {
      return await this.db.businessProfile.upsert({
        where: { businessId: business.id },
        create: { ...data, businessId: business.id },
        update: data,
      });
    } catch {
      throw new BadRequestException(
        'Profile or public URL conflicts with an existing business',
      );
    }
  }
  async public(slug: string, rich = false) {
    const profile = await this.db.businessProfile.findUnique({
      where: { publicSlug: slug },
      include: {
        business: { select: { status: true } },
        packages: {
          where: { status: 'PUBLISHED', moderationHidden: false },
          include: {
            availability: true,
            media: {
              where: { isPublic: true },
              select: {
                id: true,
                kind: true,
                filename: true,
                contentType: true,
              },
            },
          },
        },
        services: {
          where: { status: 'PUBLISHED', moderationHidden: false },
          select: {
            id: true,
            name: true,
            subtype: true,
            description: true,
            serviceCountry: true,
            serviceCity: true,
            pricingMode: true,
            price: true,
            currency: true,
          },
        },
        tourismPackages: {
          where: { status: 'PUBLISHED', moderationHidden: false },
          include: { availability: true },
        },
        visaServices: {
          where: { status: 'PUBLISHED', moderationHidden: false },
          include: { availability: true },
        },
      },
    });
    if (!profile || profile.business.status !== 'APPROVED')
      throw new NotFoundException('Business profile not found');
    const {
      privateEmail,
      privatePhone,
      licenceNumber,
      businessId,
      logoKey,
      business,
      ...publicData
    } = profile;
    return rich
      ? { ...publicData, privateEmail, privatePhone, licenceNumber }
      : publicData;
  }
}
