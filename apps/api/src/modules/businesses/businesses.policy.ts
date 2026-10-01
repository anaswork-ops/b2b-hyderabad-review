import { ForbiddenException, Injectable } from '@nestjs/common';
import { getDatabase } from '../../platform/db/prisma.js';
import type { Prisma, BusinessStatus } from '@prisma/client';

@Injectable()
export class BusinessesPolicy {
  private readonly db = getDatabase();
  createDraft(ownerId: string, tx: Prisma.TransactionClient = this.db) {
    return tx.business.create({ data: { primaryOwnerId: ownerId } });
  }
  setStatus(
    id: string,
    status: BusinessStatus,
    tx: Prisma.TransactionClient = this.db,
  ) {
    return tx.business.update({ where: { id }, data: { status } });
  }
  async stateForOwner(userId: string) {
    const business = await this.db.business.findFirst({
      where: { primaryOwnerId: userId },
      select: { id: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    return business ?? null;
  }
  async assertApprovedOwner(userId: string, businessId: string) {
    const match = await this.db.business.findFirst({
      where: { id: businessId, primaryOwnerId: userId, status: 'APPROVED' },
      select: { id: true },
    });
    if (!match) throw new ForbiddenException('Access denied');
  }

  async adminList(q: import('@b2b/validation/admin').AdminQuery) {
    const where = q.q
      ? {
          OR: [
            {
              profile: {
                name: { contains: q.q, mode: 'insensitive' as const },
              },
            },
            {
              application: {
                legalName: { contains: q.q, mode: 'insensitive' as const },
              },
            },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      this.db.business.findMany({
        where,
        skip: (q.page - 1) * 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          status: true,
          createdAt: true,
          primaryOwner: { select: { id: true, email: true, status: true } },
          profile: { select: { name: true, publicSlug: true } },
          application: { select: { id: true, legalName: true } },
        },
      }),
      this.db.business.count({ where }),
    ]);
    return { items, total, page: q.page };
  }
  adminDetail(id: string) {
    return this.db.business.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        primaryOwnerId: true,
        primaryOwner: {
          select: {
            id: true,
            email: true,
            status: true,
            emailVerifiedAt: true,
            mobileVerifiedAt: true,
          },
        },
        profile: {
          select: {
            name: true,
            publicSlug: true,
            businessType: true,
            headquartersCountry: true,
            headquartersCity: true,
          },
        },
        application: {
          select: {
            id: true,
            status: true,
            reviews: { orderBy: { createdAt: 'desc' }, take: 50 },
          },
        },
      },
    });
  }
  async adminCounts() {
    return {
      approved: await this.db.business.count({ where: { status: 'APPROVED' } }),
      suspended: await this.db.business.count({
        where: { status: 'SUSPENDED' },
      }),
    };
  }
  async changeApprovedStatus(
    id: string,
    expected: 'APPROVED' | 'SUSPENDED',
    next: 'APPROVED' | 'SUSPENDED',
    tx: Prisma.TransactionClient,
  ) {
    const changed = await tx.business.updateMany({
      where: { id, status: expected },
      data: { status: next },
    });
    if (!changed.count)
      throw new ForbiddenException('Business state changed; reload');
  }
}
