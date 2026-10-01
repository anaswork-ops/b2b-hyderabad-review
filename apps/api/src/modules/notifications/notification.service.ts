import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getDatabase } from '../../platform/db/prisma.js';

@Injectable()
export class NotificationService {
  private readonly db = getDatabase();
  intent(
    recipientUserId: string,
    kind: string,
    payloadEncrypted: string,
    tx: Prisma.TransactionClient = this.db,
    channel: 'IN_APP' | 'EMAIL' | 'MOBILE' = 'EMAIL',
  ) {
    return tx.notificationIntent.create({
      data: { recipientUserId, kind, payloadEncrypted, channel },
    });
  }
  mine(userId: string) {
    return this.db.notificationIntent.findMany({
      where: {
        recipientUserId: userId,
        channel: 'IN_APP',
        kind: { startsWith: 'APPLICATION_' },
      },
      select: { id: true, kind: true, createdAt: true, deliveryState: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
  async statusChanged(
    recipientUserId: string,
    kind: string,
    payloadEncrypted: string,
    tx: Prisma.TransactionClient,
  ) {
    for (const channel of ['IN_APP', 'EMAIL', 'MOBILE'] as const) {
      await this.intent(recipientUserId, kind, payloadEncrypted, tx, channel);
    }
  }

  async adminHealth() {
    const rows = await this.db.notificationIntent.groupBy({
      by: ['deliveryState'],
      _count: true,
    });
    return {
      pending: rows.find((x) => x.deliveryState === 'PENDING')?._count ?? 0,
      failed: rows.find((x) => x.deliveryState === 'FAILED')?._count ?? 0,
      delivered: rows.find((x) => x.deliveryState === 'DELIVERED')?._count ?? 0,
    };
  }
}
