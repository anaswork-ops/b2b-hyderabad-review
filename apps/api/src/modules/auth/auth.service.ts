import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { getDatabase } from '../../platform/db/prisma.js';
import { UsersService } from '../users/users.service.js';
import { BusinessesPolicy } from '../businesses/businesses.policy.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import {
  decrypt,
  encrypt,
  hashToken,
  randomToken,
  validTotp,
} from './crypto.js';
import type { Prisma, User } from '@prisma/client';

const sessionLife = 7 * 24 * 60 * 60 * 1000;
const absentUserHash = argon2.hash(randomToken(), { type: argon2.argon2id });
const staffRoles = new Set(['ADMIN', 'SUPER_ADMIN']);
function base32(value: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0,
    buffer = 0,
    output = '';
  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(buffer >>> (bits -= 5)) & 31];
    }
  }
  if (bits) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

@Injectable()
export class AuthService {
  private readonly db = getDatabase();
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(BusinessesPolicy) private readonly businesses: BusinessesPolicy,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
  ) {}

  async register(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (await this.users.findByEmail(normalized))
      throw new BadRequestException('Unable to register account');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.db.$transaction(async (tx) => {
      const created = await this.users.create(normalized, passwordHash, tx);
      await this.issueToken(
        created.id,
        'EMAIL_VERIFICATION',
        24 * 60 * 60 * 1000,
        tx,
      );
      return created;
    });
    await this.audit.record(user.id, 'identity.register', 'user', 'success');
    return { message: 'Check your email to verify your account' };
  }

  private async issueToken(
    userId: string,
    purpose: 'EMAIL_VERIFICATION' | 'PASSWORD_RESET',
    life: number,
    tx: Prisma.TransactionClient = this.db,
  ) {
    const token = randomToken();
    await tx.identityToken.create({
      data: {
        userId,
        purpose,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + life),
      },
    });
    // Encrypted outbox delivery runs after commit in the isolated worker.
    await this.notifications.intent(userId, purpose, encrypt(token), tx);
  }

  async resendVerification(email: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user && !user.emailVerifiedAt && user.status === 'ACTIVE')
      await this.db.$transaction((tx) =>
        this.issueToken(user.id, 'EMAIL_VERIFICATION', 24 * 60 * 60 * 1000, tx),
      );
    return {
      message: 'If the account needs verification, instructions will be sent',
    };
  }

  async verifyEmail(token: string) {
    const row = await this.db.identityToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !row ||
      row.purpose !== 'EMAIL_VERIFICATION' ||
      row.consumedAt ||
      row.expiresAt <= new Date()
    )
      throw new BadRequestException('Invalid or expired link');
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const claimed = await tx.identityToken.updateMany({
        where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (!claimed.count)
        throw new BadRequestException('Invalid or expired link');
      await this.users.markEmailVerified(row.userId, now, tx);
    });
    await this.audit.record(
      row.userId,
      'identity.email_verified',
      'user',
      'success',
    );
    return { message: 'Email verified' };
  }

  async requestMobile(user: User, mobile: string) {
    const token = randomToken();
    await this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { mobile, mobileVerifiedAt: null },
      });
      await tx.identityToken.updateMany({
        where: {
          userId: user.id,
          purpose: 'MOBILE_VERIFICATION',
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
      await tx.identityToken.create({
        data: {
          userId: user.id,
          purpose: 'MOBILE_VERIFICATION',
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 15 * 60_000),
        },
      });
      await this.notifications.intent(
        user.id,
        'MOBILE_VERIFICATION',
        encrypt(token),
        tx,
        'MOBILE',
      );
    });
    return { message: 'Verification instructions queued' };
  }

  async verifyMobile(user: User, token: string) {
    const now = new Date();
    const result = await this.db.$transaction(async (tx) => {
      const claimed = await tx.identityToken.updateMany({
        where: {
          userId: user.id,
          purpose: 'MOBILE_VERIFICATION',
          tokenHash: hashToken(token),
          consumedAt: null,
          expiresAt: { gt: now },
        },
        data: { consumedAt: now },
      });
      if (!claimed.count) return false;
      await tx.user.update({
        where: { id: user.id },
        data: { mobileVerifiedAt: now },
      });
      return true;
    });
    if (!result) throw new BadRequestException('Invalid or expired code');
    await this.audit.record(
      user.id,
      'identity.mobile_verified',
      'user',
      'success',
    );
    return { message: 'Mobile verified' };
  }

  async forgotPassword(email: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (user && user.status === 'ACTIVE') {
      await this.db.$transaction((tx) =>
        this.issueToken(user.id, 'PASSWORD_RESET', 15 * 60 * 1000, tx),
      );
      await this.audit.record(
        user.id,
        'identity.password_reset_requested',
        'user',
        'success',
      );
    }
    return {
      message: 'If this account exists, reset instructions will be sent',
    };
  }

  async resetPassword(token: string, password: string) {
    const row = await this.db.identityToken.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !row ||
      row.purpose !== 'PASSWORD_RESET' ||
      row.consumedAt ||
      row.expiresAt <= new Date()
    )
      throw new BadRequestException('Invalid or expired link');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const now = new Date();
    await this.db.$transaction(async (tx) => {
      const claimed = await tx.identityToken.updateMany({
        where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (!claimed.count)
        throw new BadRequestException('Invalid or expired link');
      await this.users.setPasswordHash(row.userId, passwordHash, tx);
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.identityToken.updateMany({
        where: {
          userId: row.userId,
          purpose: 'PASSWORD_RESET',
          consumedAt: null,
        },
        data: { consumedAt: now },
      });
    });
    await this.audit.record(
      row.userId,
      'identity.password_reset',
      'user',
      'success',
    );
    return { message: 'Password updated' };
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    const valid = await argon2.verify(
      user?.passwordHash ?? (await absentUserHash),
      password,
    );
    if (!valid || !user) {
      await this.audit.record(
        user?.id ?? null,
        'identity.login',
        'user',
        'denied',
      );
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      await this.audit.record(user.id, 'identity.login', 'user', 'suspended');
      throw new ForbiddenException('Account suspended');
    }
    if (!user.emailVerifiedAt) {
      await this.audit.record(user.id, 'identity.login', 'user', 'unverified');
      throw new ForbiddenException('Verify your email before signing in');
    }
    if (staffRoles.has(user.role) || user.mfaEnabledAt) {
      const challenge = randomToken();
      await this.db.identityToken.create({
        data: {
          userId: user.id,
          purpose: 'MFA_LOGIN',
          tokenHash: hashToken(challenge),
          expiresAt: new Date(Date.now() + 5 * 60_000),
        },
      });
      return {
        mfaRequired: true as const,
        challenge,
        setupRequired: !user.mfaEnabledAt,
      };
    }
    await this.audit.record(user.id, 'identity.login', 'user', 'success');
    return { mfaRequired: false as const, ...(await this.createSession(user)) };
  }

  private async challengeUser(challenge: string) {
    const row = await this.db.identityToken.findUnique({
      where: { tokenHash: hashToken(challenge) },
      include: { user: true },
    });
    if (
      !row ||
      row.purpose !== 'MFA_LOGIN' ||
      row.consumedAt ||
      row.expiresAt <= new Date() ||
      row.user.status !== 'ACTIVE'
    )
      throw new UnauthorizedException('Invalid or expired challenge');
    return row;
  }

  async mfaSetup(challenge: string) {
    const row = await this.challengeUser(challenge);
    if (row.user.mfaEnabledAt)
      throw new BadRequestException('MFA already active');
    const secret = randomBytes(20).toString('base64url');
    await this.users.setMfaSecret(row.userId, encrypt(secret));
    const setupKey = base32(Buffer.from(secret, 'base64url'));
    return {
      secret: setupKey,
      uri: `otpauth://totp/B2B%20Hyderabad:${encodeURIComponent(row.user.email)}?secret=${setupKey}&issuer=B2B%20Hyderabad`,
    };
  }

  async mfaVerify(challenge: string, code: string) {
    const row = await this.challengeUser(challenge);
    if (
      !row.user.mfaSecretEncrypted ||
      !validTotp(decrypt(row.user.mfaSecretEncrypted), code)
    ) {
      await this.audit.record(
        row.userId,
        'identity.mfa_verify',
        'user',
        'denied',
      );
      throw new UnauthorizedException('Invalid code');
    }
    const now = new Date();
    const claimed = await this.db.identityToken.updateMany({
      where: { id: row.id, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (!claimed.count)
      throw new UnauthorizedException('Invalid or expired challenge');
    if (!row.user.mfaEnabledAt) await this.users.enableMfa(row.userId, now);
    await this.audit.record(
      row.userId,
      'identity.mfa_verified',
      'user',
      'success',
    );
    return this.createSession(row.user);
  }

  async createSession(user: User) {
    const token = randomToken();
    const csrf = randomToken();
    const expiresAt = new Date(Date.now() + sessionLife);
    await this.db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        csrfHash: hashToken(csrf),
        expiresAt,
      },
    });
    return { token, csrf, expiresAt };
  }

  async requireSession(token?: string, csrf?: string) {
    if (!token) throw new UnauthorizedException('Authentication required');
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      !session.user.emailVerifiedAt ||
      (staffRoles.has(session.user.role) && !session.user.mfaEnabledAt)
    )
      throw new UnauthorizedException('Session expired');
    if (csrf !== undefined && hashToken(csrf) !== session.csrfHash)
      throw new ForbiddenException('CSRF check failed');
    return session.user;
  }

  async logout(token?: string) {
    if (token)
      await this.db.session.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    return { message: 'Signed out' };
  }

  async businessStatus(user: User) {
    return user.role === 'BUSINESS_USER'
      ? ((await this.businesses.stateForOwner(user.id))?.status ?? null)
      : null;
  }

  async sessionContext(user: User) {
    if (staffRoles.has(user.role))
      return { route: '/admin', businessStatus: null };
    const businessStatus = await this.businessStatus(user);
    return {
      route: businessStatus === 'APPROVED' ? '/business' : '/apply',
      businessStatus,
    };
  }
  async routeFor(user: User) {
    return (await this.sessionContext(user)).route;
  }

  async assertRole(user: User, role: 'ADMIN' | 'SUPER_ADMIN') {
    if (
      user.role !== role &&
      !(role === 'ADMIN' && user.role === 'SUPER_ADMIN')
    ) {
      await this.audit.record(
        user.id,
        'authorization.role_denied',
        'admin',
        'denied',
      );
      throw new ForbiddenException('Access denied');
    }
  }

  async assertApprovedBusinessUser(user: User) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    const business = await this.businesses.stateForOwner(user.id);
    if (!business || business.status !== 'APPROVED')
      throw new ForbiddenException('Approved business required');
    return business;
  }

  async assertApprovedOwner(user: User, businessId: string) {
    if (user.role !== 'BUSINESS_USER')
      throw new ForbiddenException('Access denied');
    await this.businesses.assertApprovedOwner(user.id, businessId);
  }

  revokeUserSessions(
    userId: string,
    tx: import('@prisma/client').Prisma.TransactionClient,
  ) {
    return tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
