import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID, randomBytes } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { getDatabase } from '../src/platform/db/prisma.js';
import { decrypt, encrypt, totp } from '../src/modules/auth/crypto.js';
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Disposable phase2_test database required');
const db = getDatabase();
let app: Awaited<ReturnType<typeof NestFactory.create>>;
const api = () => request(app.getHttpServer());
const email = () => `phase3-${randomUUID()}@example.test`;
const password = 'Synthetic-Only-Password-123!';
const cookies = (response: { headers: Record<string, unknown> }) =>
  (response.headers['set-cookie'] as string[])
    .map((value) => value.split(';')[0])
    .join('; ');
const csrf = (response: { headers: Record<string, unknown> }) =>
  decodeURIComponent(
    (response.headers['set-cookie'] as string[])
      .find((value) => value.startsWith('b2b_csrf='))!
      .split(';')[0]!
      .split('=')[1]!,
  );
const tokenFor = async (userId: string, kind: string) =>
  decrypt(
    (
      await db.notificationIntent.findFirstOrThrow({
        where: { recipientUserId: userId, kind },
        orderBy: { createdAt: 'desc' },
      })
    ).payloadEncrypted,
  );
beforeAll(async () => {
  app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.use(
    '/applications/mine/documents',
    express.raw({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      limit: '5mb',
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  await app.init();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});

describe('Phase 3 application lifecycle and authorization', () => {
  it('requires verified contacts, private documents, admin MFA, correction and approval', async () => {
    const address = email();
    expect(
      (await api().post('/auth/register').send({ email: address, password }))
        .status,
    ).toBe(201);
    const user = await db.user.findUniqueOrThrow({ where: { email: address } });
    const verify = await tokenFor(user.id, 'EMAIL_VERIFICATION');
    expect(
      (await api().post('/auth/email/verify').send({ token: verify })).status,
    ).toBe(201);
    const login = await api()
      .post('/auth/login')
      .send({ email: address, password });
    const ownerCookie = cookies(login),
      ownerCsrf = csrf(login);
    expect(
      (await api().get('/applications/admin').set('Cookie', ownerCookie))
        .status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/applications/mine/submit')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
      ).status,
    ).toBe(404);
    const draft = {
      legalName: 'Synthetic Hajj Services',
      tradingName: 'Synthetic Travel',
      businessType: 'TRAVEL_AGENCY',
      address: 'Test address',
      country: 'India',
      state: 'Telangana',
      city: 'Hyderabad',
      contactEmail: address,
      contactMobile:
        '+91' +
        String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000)),
      yearsOperating: 4,
      capabilities: ['Umrah'],
      sourceMarkets: ['India'],
      saudiDestinations: ['Makkah'],
      licenceNumber: 'TEST-123',
      licenceIssuer: 'Synthetic issuer',
    };
    const saved = await api()
      .patch('/applications/mine')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send(draft);
    expect(saved.status).toBe(200);
    const applicationId = saved.body.id as string;
    expect(
      (
        await api()
          .post('/applications/mine/submit')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
      ).status,
    ).toBe(400);
    const mobile = await api()
      .post('/auth/mobile/request')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .send({ mobile: draft.contactMobile });
    expect(mobile.status).toBe(201);
    expect(
      (
        await api()
          .post('/auth/mobile/verify')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
          .send({ token: await tokenFor(user.id, 'MOBILE_VERIFICATION') })
      ).status,
    ).toBe(201);
    const pdf = Buffer.from('%PDF-1.4\nSynthetic test document\n');
    const upload = await api()
      .post('/applications/mine/documents')
      .set('Cookie', ownerCookie)
      .set('X-CSRF-Token', ownerCsrf)
      .set('X-Document-Kind', 'REGISTRATION_LICENCE')
      .set('X-File-Name', 'synthetic.pdf')
      .set('Content-Type', 'application/pdf')
      .send(pdf);
    expect(upload.status).toBe(201);
    const documentId = upload.body.id as string;
    expect(
      (await api().get(`/applications/mine/documents/${documentId}`)).status,
    ).toBe(401);
    expect(
      (
        await api()
          .get(`/applications/mine/documents/${documentId}`)
          .set('Cookie', ownerCookie)
      ).status,
    ).toBe(200);
    expect(
      (await api().post('/applications/mine/submit').set('Cookie', ownerCookie))
        .status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/applications/mine/submit')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
      ).status,
    ).toBe(201);
    expect(
      (
        await api()
          .patch('/applications/mine')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
          .send({ city: 'Other' })
      ).status,
    ).toBe(400);
    const adminEmail = email();
    const secret = randomBytes(20).toString('base64url');
    await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        mfaSecretEncrypted: encrypt(secret),
        mfaEnabledAt: new Date(),
      },
    });
    const adminLogin = await api()
      .post('/auth/login')
      .send({ email: adminEmail, password });
    expect(adminLogin.body.mfaRequired).toBe(true);
    expect((await api().get('/applications/admin')).status).toBe(401);
    const adminMfa = await api()
      .post('/auth/mfa/verify')
      .send({ challenge: adminLogin.body.challenge, code: totp(secret) });
    const adminCookie = cookies(adminMfa),
      adminCsrf = csrf(adminMfa);
    expect(
      (await api().get('/applications/admin').set('Cookie', adminCookie))
        .status,
    ).toBe(200);
    expect(
      (
        await api()
          .get(`/applications/admin/${applicationId}/documents/${documentId}`)
          .set('Cookie', adminCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .post(`/applications/admin/${applicationId}/review`)
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
          .send({ action: 'APPROVE' })
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post(`/applications/admin/${applicationId}/review`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', adminCsrf)
          .send({
            action: 'REQUEST_INFORMATION',
            note: 'Please clarify the market',
          })
      ).body.status,
    ).toBe('REQUEST_INFORMATION');
    expect(
      (
        await api()
          .patch('/applications/mine')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
          .send({ sourceMarkets: ['India', 'UAE'] })
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .post('/applications/mine/submit')
          .set('Cookie', ownerCookie)
          .set('X-CSRF-Token', ownerCsrf)
      ).body.status,
    ).toBe('SUBMITTED');
    expect(
      (
        await api()
          .post(`/applications/admin/${applicationId}/review`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', adminCsrf)
          .send({ action: 'APPROVE' })
      ).body.status,
    ).toBe('APPROVED');
    expect(
      (
        await api()
          .get(`/auth/access/business/${saved.body.businessId}`)
          .set('Cookie', ownerCookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .post(`/applications/admin/${applicationId}/review`)
          .set('Cookie', adminCookie)
          .set('X-CSRF-Token', adminCsrf)
          .send({ action: 'APPROVE' })
      ).status,
    ).toBe(400);
    expect(
      await db.auditEvent.findFirst({
        where: {
          action: 'application.approve',
          actorId: (
            await db.user.findUniqueOrThrow({ where: { email: adminEmail } })
          ).id,
        },
      }),
    ).not.toBeNull();
    expect(
      (
        await db.notificationIntent.findMany({
          where: { recipientUserId: user.id, kind: 'APPLICATION_APPROVED' },
        })
      ).length,
    ).toBeGreaterThan(0);
  }, 15_000);
});
