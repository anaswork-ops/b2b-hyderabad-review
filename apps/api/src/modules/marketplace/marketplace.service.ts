import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { MarketplaceQuery } from '@b2b/validation/marketplace';
import { getDatabase } from '../../platform/db/prisma.js';
@Injectable()
export class MarketplaceService {
  private readonly db = getDatabase();
  private dates(
    q: MarketplaceQuery,
  ): Prisma.AvailabilityRuleListRelationFilter | undefined {
    if (q.availability === 'ON_REQUEST')
      return { some: { kind: 'ON_REQUEST' } };
    if (!q.startDate || !q.endDate)
      return q.availability === 'AVAILABLE'
        ? { some: { kind: { not: 'ON_REQUEST' } } }
        : undefined;
    const days: string[] = [];
    for (
      let d = new Date(q.startDate);
      d <= new Date(q.endDate);
      d.setUTCDate(d.getUTCDate() + 1)
    )
      days.push(d.toISOString().slice(0, 10));
    return {
      some: {
        AND: [
          {
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
                startDate: {
                  gte: new Date(q.startDate),
                  lte: new Date(q.endDate),
                },
              },
            ],
          },
          { NOT: { blackoutDates: { hasSome: days.map((x) => new Date(x)) } } },
          ...(q.groupSize
            ? [{ OR: [{ capacity: null }, { capacity: { gte: q.groupSize } }] }]
            : []),
        ],
      },
    };
  }
  async search(q: MarketplaceQuery) {
    const started = performance.now();
    const skip = (q.page - 1) * q.pageSize,
      availability = this.dates(q);
    const profile = {
      business: { status: 'APPROVED' as const },
      ...(q.supplierType ? { businessType: q.supplierType } : {}),
      ...(q.market ? { marketsServed: { has: q.market } } : {}),
    };
    if (q.mode === 'businesses') {
      const where: Prisma.BusinessProfileWhereInput = profile;
      const [items, total] = await Promise.all([
        this.db.businessProfile.findMany({
          where,
          skip,
          take: q.pageSize,
          orderBy: { name: 'asc' },
          select: {
            publicSlug: true,
            name: true,
            businessType: true,
            description: true,
            headquartersCountry: true,
            headquartersCity: true,
            languages: true,
            marketsServed: true,
            capabilities: true,
            serviceCountries: true,
            serviceCities: true,
          },
        }),
        this.db.businessProfile.count({ where }),
      ]);
      return {
        items,
        total,
        page: q.page,
        pageSize: q.pageSize,
        elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      };
    }
    if (q.mode === 'services') {
      const where: Prisma.ServiceWhereInput = {
        status: 'PUBLISHED',
        moderationHidden: false,
        profile,
        ...(q.subtype ? { subtype: q.subtype } : {}),
        ...(q.market ? { sourceMarket: q.market } : {}),
        ...(q.destination
          ? { serviceCity: { contains: q.destination, mode: 'insensitive' } }
          : {}),
        ...(q.pricingMode ? { pricingMode: q.pricingMode } : {}),
        ...(q.currency ? { currency: q.currency } : {}),
        ...(availability ? { availability } : {}),
      };
      const [items, total] = await Promise.all([
        this.db.service.findMany({
          where,
          skip,
          take: q.pageSize,
          orderBy: { updatedAt: 'desc' },
          include: {
            profile: {
              select: { publicSlug: true, name: true, businessType: true },
            },
            availability: true,
          },
        }),
        this.db.service.count({ where }),
      ]);
      return {
        items,
        total,
        page: q.page,
        pageSize: q.pageSize,
        elapsedMs: Math.round((performance.now() - started) * 100) / 100,
      };
    }
    const where: Prisma.PackageWhereInput = {
      status: 'PUBLISHED',
      moderationHidden: false,
      profile,
      ...(q.subtype ? { subtype: q.subtype } : {}),
      ...(q.market ? { sourceMarket: q.market } : {}),
      ...(q.departure
        ? { departureCity: { contains: q.departure, mode: 'insensitive' } }
        : {}),
      ...(q.destination ? { destinationCities: { has: q.destination } } : {}),
      ...(q.minNights !== undefined
        ? {
            totalNights: {
              gte: q.minNights,
              ...(q.maxNights !== undefined ? { lte: q.maxNights } : {}),
            },
          }
        : {}),
      ...(q.makkahNights !== undefined
        ? { makkahNights: { gte: q.makkahNights } }
        : {}),
      ...(q.madinahNights !== undefined
        ? { madinahNights: { gte: q.madinahNights } }
        : {}),
      ...(q.occupancy ? { roomOccupancy: { has: q.occupancy } } : {}),
      ...(q.visa
        ? { visaStatus: { contains: q.visa, mode: 'insensitive' } }
        : {}),
      ...(q.meals ? { meals: { has: q.meals } } : {}),
      ...(q.transport
        ? { transport: { path: ['details'], string_contains: q.transport } }
        : {}),
      ...(q.pricingMode ? { pricingMode: q.pricingMode } : {}),
      ...(q.currency ? { currency: q.currency } : {}),
      ...(q.minPrice !== undefined
        ? {
            price: {
              gte: q.minPrice,
              ...(q.maxPrice !== undefined ? { lte: q.maxPrice } : {}),
            },
          }
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
      ...(availability ? { availability } : {}),
    };
    const [items, total] = await Promise.all([
      this.db.package.findMany({
        where,
        skip,
        take: q.pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          profile: {
            select: { publicSlug: true, name: true, businessType: true },
          },
          availability: true,
        },
      }),
      this.db.package.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      elapsedMs: Math.round((performance.now() - started) * 100) / 100,
    };
  }
  async compare(ids: string[]) {
    return this.db.package.findMany({
      where: {
        id: { in: ids },
        status: 'PUBLISHED',
        moderationHidden: false,
        profile: { business: { status: 'APPROVED' } },
      },
      include: {
        profile: { select: { name: true, publicSlug: true } },
        availability: true,
      },
    });
  }
}
