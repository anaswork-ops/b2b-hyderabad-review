import { Injectable } from '@nestjs/common';
import { getDatabase } from '../../platform/db/prisma.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly db = getDatabase();
  record(
    actorId: string | null,
    action: string,
    resource: string,
    outcome: string,
    tx: Prisma.TransactionClient = this.db,
    detail: { resourceId?: string; reason?: string } = {},
  ) {
    return tx.auditEvent.create({
      data: { actorId, action, resource, outcome, ...detail },
    });
  }

  async query(q: import('@b2b/validation/admin').AdminQuery) {
    const where = {
      ...(q.resourceId ? { resourceId: q.resourceId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.q
        ? { action: { contains: q.q, mode: 'insensitive' as const } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.auditEvent.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * 25,
        take: 25,
      }),
      this.db.auditEvent.count({ where }),
    ]);
    return { items, total, page: q.page };
  }
}
