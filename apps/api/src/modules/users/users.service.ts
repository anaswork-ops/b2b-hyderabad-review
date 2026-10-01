import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { getDatabase } from '../../platform/db/prisma.js';

@Injectable()
export class UsersService {
  private readonly db = getDatabase();
  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }
  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
  create(
    email: string,
    passwordHash: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    return tx.user.create({ data: { email, passwordHash } });
  }
  async suspend(id: string) {
    await this.db.$transaction([
      this.db.user.update({ where: { id }, data: { status: 'SUSPENDED' } }),
      this.db.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }
  markEmailVerified(
    id: string,
    at: Date,
    tx: Prisma.TransactionClient = this.db,
  ) {
    return tx.user.update({ where: { id }, data: { emailVerifiedAt: at } });
  }
  setPasswordHash(
    id: string,
    passwordHash: string,
    tx: Prisma.TransactionClient = this.db,
  ) {
    return tx.user.update({ where: { id }, data: { passwordHash } });
  }
  setMfaSecret(id: string, mfaSecretEncrypted: string) {
    return this.db.user.update({ where: { id }, data: { mfaSecretEncrypted } });
  }
  enableMfa(id: string, at: Date) {
    return this.db.user.update({ where: { id }, data: { mfaEnabledAt: at } });
  }

  async adminList(q: import('@b2b/validation/admin').AdminQuery) {
    const where = q.q
      ? { email: { contains: q.q, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await Promise.all([
      this.db.user.findMany({
        where,
        skip: (q.page - 1) * 25,
        take: 25,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          mfaEnabledAt: true,
          createdAt: true,
        },
      }),
      this.db.user.count({ where }),
    ]);
    return { items, total, page: q.page };
  }
}
