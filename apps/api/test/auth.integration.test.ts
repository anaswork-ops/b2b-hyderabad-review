import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { getDatabase } from '../src/platform/db/prisma.js';
import { decrypt, hashToken, totp } from '../src/modules/auth/crypto.js';

if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Integration tests require disposable phase2_test database');
const db = getDatabase();
let app: Awaited<ReturnType<typeof NestFactory.create>>;
const api = () => request(app.getHttpServer());
const email = () => `phase2-${randomUUID()}@example.test`;
const password = 'Synthetic-Only-Password-123!';
const tokenFor = async (userId: string, kind: string) => {
  const intent = await db.notificationIntent.findFirst({
    where: { recipientUserId: userId, kind },
    orderBy: { createdAt: 'desc' },
  });
  if (!intent) throw new Error('Missing intent');
  return decrypt(intent.payloadEncrypted);
};
const cookieHeader = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[])
    .map((value) => value.split(';')[0])
    .join('; ');
const csrfFor = (response: { headers: Record<string, unknown> }) =>
  decodeURIComponent(
    (response.headers['set-cookie'] as string[])
      .find((value) => value.startsWith('b2b_csrf='))!
      .split(';')[0]!
      .split('=')[1]!,
  );

beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe('Phase 2 direct API security', () => {
  it('registers, verifies, denies admin, checks CSRF, and revokes logout session', async () => {
    const address = email();
    expect(
      (await api().post('/auth/register').send({ email: address, password }))
        .status,
    ).toBe(201);
    expect(
      (await api().post('/auth/login').send({ email: address, password }))
        .status,
    ).toBe(403);
    const user = await db.user.findUniqueOrThrow({ where: { email: address } });
    const verify = await tokenFor(user.id, 'EMAIL_VERIFICATION');
    expect(
      (
        await api()
          .post('/auth/email/verify')
          .send({ token: 'invalid-token-invalid-token' })
      ).status,
    ).toBe(400);
    const expiredVerify = randomUUID() + randomUUID();
    await db.identityToken.create({
      data: {
        userId: user.id,
        purpose: 'EMAIL_VERIFICATION',
        tokenHash: hashToken(expiredVerify),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(
      (await api().post('/auth/email/verify').send({ token: expiredVerify }))
        .status,
    ).toBe(400);
    expect(
      (await api().post('/auth/email/verify').send({ token: verify })).status,
    ).toBe(201);
    expect(
      (await api().post('/auth/email/verify').send({ token: verify })).status,
    ).toBe(400);
    const login = await api()
      .post('/auth/login')
      .send({ email: address, password });
    expect(login.status).toBe(201);
    expect(login.body.mfaRequired).toBe(false);
    const cookies = cookieHeader(login);
    expect(
      (await api().get('/auth/session').set('Cookie', cookies)).body.route,
    ).toBe('/apply');
    expect(
      (await api().get('/auth/access/admin').set('Cookie', cookies)).status,
    ).toBe(403);
    expect(
      await db.auditEvent.findFirst({
        where: { actorId: user.id, action: 'authorization.role_denied' },
      }),
    ).not.toBeNull();
    expect(
      (await api().post('/auth/logout').set('Cookie', cookies)).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/auth/logout')
          .set('Cookie', cookies)
          .set('x-csrf-token', csrfFor(login))
      ).status,
    ).toBe(201);
    expect(
      (await api().get('/auth/session').set('Cookie', cookies)).status,
    ).toBe(401);
  });

  it('keeps recovery enumeration safe and invalidates old sessions on reset', async () => {
    const address = email();
    const user = await db.user.create({
      data: {
        email: address,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerifiedAt: new Date(),
      },
    });
    const login = await api()
      .post('/auth/login')
      .send({ email: address, password });
    const cookies = cookieHeader(login);
    const known = await api()
      .post('/auth/password/forgot')
      .send({ email: address });
    const unknown = await api()
      .post('/auth/password/forgot')
      .send({ email: email() });
    expect(known.body).toEqual(unknown.body);
    expect(
      (
        await api()
          .post('/auth/password/reset')
          .send({ token: 'invalid-token-invalid-token', password })
      ).status,
    ).toBe(400);
    const reset = await tokenFor(user.id, 'PASSWORD_RESET');
    expect(
      (
        await api()
          .post('/auth/password/reset')
          .send({ token: reset, password: 'New-Synthetic-Password-123!' })
      ).status,
    ).toBe(201);
    expect(
      (
        await api()
          .post('/auth/password/reset')
          .send({ token: reset, password })
      ).status,
    ).toBe(400);
    expect(
      (await api().get('/auth/session').set('Cookie', cookies)).status,
    ).toBe(401);
  });

  it.each(['ADMIN', 'SUPER_ADMIN'] as const)(
    'requires TOTP before %s API access',
    async (role) => {
      const address = email();
      await db.user.create({
        data: {
          email: address,
          passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
          emailVerifiedAt: new Date(),
          role,
        },
      });
      const login = await api()
        .post('/auth/login')
        .send({ email: address, password });
      expect(login.body).toMatchObject({
        mfaRequired: true,
        setupRequired: true,
      });
      expect(login.headers['set-cookie']).toBeUndefined();
      expect((await api().get('/auth/access/admin')).status).toBe(401);
      const challenge = login.body.challenge;
      const setup = await api().post('/auth/mfa/setup').send({ challenge });
      expect(setup.body.uri).toContain('otpauth://totp/');
      const user = await db.user.findUniqueOrThrow({
        where: { email: address },
      });
      expect(
        (
          await api()
            .post('/auth/mfa/verify')
            .send({ challenge, code: 'not-code' })
        ).status,
      ).toBe(400);
      const wrongCode = totp(decrypt(user.mfaSecretEncrypted!)).replace(
        /^./,
        (digit) => (digit === '0' ? '1' : '0'),
      );
      expect(
        (
          await api()
            .post('/auth/mfa/verify')
            .send({ challenge, code: wrongCode })
        ).status,
      ).toBe(401);
      expect(
        await db.auditEvent.findFirst({
          where: {
            actorId: user.id,
            action: 'identity.mfa_verify',
            outcome: 'denied',
          },
        }),
      ).not.toBeNull();
      const verified = await api()
        .post('/auth/mfa/verify')
        .send({ challenge, code: totp(decrypt(user.mfaSecretEncrypted!)) });
      expect(verified.status).toBe(201);
      expect(
        (
          await api()
            .get('/auth/access/admin')
            .set('Cookie', cookieHeader(verified))
        ).status,
      ).toBe(200);
      expect(
        (
          await api()
            .post('/auth/mfa/verify')
            .send({ challenge, code: totp(decrypt(user.mfaSecretEncrypted!)) })
        ).status,
      ).toBe(401);
    },
  );

  it('denies business actions until approval and enforces ownership', async () => {
    const address = email();
    const user = await db.user.create({
      data: {
        email: address,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerifiedAt: new Date(),
      },
    });
    const owned = await db.business.create({
      data: { primaryOwnerId: user.id, status: 'DRAFT' },
    });
    const other = await db.business.create({
      data: { primaryOwnerId: user.id, status: 'APPROVED' },
    });
    const login = await api()
      .post('/auth/login')
      .send({ email: address, password });
    const cookies = cookieHeader(login);
    expect(
      (
        await api()
          .get(`/auth/access/business/${owned.id}`)
          .set('Cookie', cookies)
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .get(`/auth/access/business/${other.id}`)
          .set('Cookie', cookies)
      ).status,
    ).toBe(200);
    const outsider = await db.user.create({
      data: {
        email: email(),
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerifiedAt: new Date(),
      },
    });
    const outsiderBusiness = await db.business.create({
      data: { primaryOwnerId: outsider.id, status: 'APPROVED' },
    });
    expect(
      (
        await api()
          .get(`/auth/access/business/${outsiderBusiness.id}`)
          .set('Cookie', cookies)
      ).status,
    ).toBe(403);
    await db.user.update({
      where: { id: user.id },
      data: { status: 'SUSPENDED' },
    });
    expect(
      (await api().get('/auth/session').set('Cookie', cookies)).status,
    ).toBe(401);
  });

  it('rejects expired recovery tokens and expired sessions', async () => {
    const address = email();
    const user = await db.user.create({
      data: {
        email: address,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerifiedAt: new Date(),
      },
    });
    const expired = randomUUID() + randomUUID();
    await db.identityToken.create({
      data: {
        userId: user.id,
        purpose: 'PASSWORD_RESET',
        tokenHash: hashToken(expired),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect(
      (
        await api()
          .post('/auth/password/reset')
          .send({ token: expired, password })
      ).status,
    ).toBe(400);
    const login = await api()
      .post('/auth/login')
      .send({ email: address, password });
    const cookies = cookieHeader(login);
    const sessionToken = cookies.match(/b2b_session=([^; ]+)/)![1]!;
    await db.session.update({
      where: { tokenHash: hashToken(sessionToken) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      (await api().get('/auth/session').set('Cookie', cookies)).status,
    ).toBe(401);
  });
});
