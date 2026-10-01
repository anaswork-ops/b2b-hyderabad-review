import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import request from 'supertest';
import argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { getDatabase } from '../src/platform/db/prisma.js';
import { hashToken } from '../src/modules/auth/crypto.js';

if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Disposable phase2_test database required');
const db = getDatabase();
let app: Awaited<ReturnType<typeof NestFactory.create>>;
const api = () => request(app.getHttpServer());

async function owner(approved = true) {
  const id = randomUUID(),
    token = randomUUID() + randomUUID(),
    csrf = randomUUID() + randomUUID();
  const user = await db.user.create({
    data: {
      email: `phase6-${id}@example.test`,
      passwordHash: await argon2.hash('Synthetic-Only-Password-123!', {
        type: argon2.argon2id,
      }),
      emailVerifiedAt: new Date(),
      mobile:
        '+91' + String(Math.floor(1000000000 + Math.random() * 8999999999)),
      mobileVerifiedAt: new Date(),
    },
  });
  const business = await db.business.create({
    data: {
      primaryOwnerId: user.id,
      status: approved ? 'APPROVED' : 'DRAFT',
    },
  });
  const profile = await db.businessProfile.create({
    data: {
      businessId: business.id,
      publicSlug: 'phase6-' + id,
      name: 'Synthetic ' + id.slice(0, 8),
      businessType: 'TRAVEL_AGENCY',
      description: 'Synthetic approved supplier for Phase 6 message testing.',
      headquartersCountry: 'India',
      headquartersState: 'Telangana',
      headquartersCity: 'Hyderabad',
      privateEmail: user.email,
      privatePhone: user.mobile!,
      yearsOperating: 5,
      languages: ['English'],
      marketsServed: ['India'],
      capabilities: ['Umrah'],
      serviceCountries: ['Saudi Arabia'],
      serviceCities: ['Makkah'],
    },
  });
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      csrfHash: hashToken(csrf),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return {
    business,
    profile,
    cookie: 'b2b_session=' + encodeURIComponent(token),
    csrf,
  };
}
const auth = (call: request.Test, user: Awaited<ReturnType<typeof owner>>) =>
  call.set('Cookie', user.cookie).set('X-CSRF-Token', user.csrf);

beforeAll(async () => {
  app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.use(
    '/messages',
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

describe('Phase 6 messaging direct API security and lifecycle', () => {
  it('retains context, enforces access, unread, attachments, blocking, reports and custom requests', async () => {
    const a = await owner(),
      b = await owner(),
      stranger = await owner(),
      pending = await owner(false);
    const pkg = await db.package.create({
      data: {
        profileId: b.profile.id,
        name: 'Synthetic Umrah',
        subtype: 'UMRAH',
        sourceMarket: 'India',
        departureCity: 'Hyderabad',
        destinationCities: ['Makkah'],
        totalNights: 10,
        makkahNights: 6,
        madinahNights: 4,
        accommodation: {},
        roomOccupancy: ['Double'],
        transport: {},
        meals: [],
        visaStatus: 'Included',
        ziyarat: [],
        assistance: [],
        inclusions: [],
        exclusions: [],
        pricingMode: 'ON_REQUEST',
        cancellationTerms: 'Synthetic terms',
        status: 'PUBLISHED',
      },
    });
    expect(
      (
        await api().post('/messages').send({
          contextType: 'PACKAGE',
          contextId: pkg.id,
          message: 'Need group terms',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await auth(api().post('/messages'), pending).send({
          contextType: 'PACKAGE',
          contextId: pkg.id,
          message: 'Need group terms',
        })
      ).status,
    ).toBe(403);
    const started = await auth(api().post('/messages'), a).send({
      contextType: 'PACKAGE',
      contextId: pkg.id,
      message: 'Need group terms',
    });
    expect(started.status).toBe(201);
    const id = started.body.id;
    expect(started.body.contextPackageId).toBe(pkg.id);
    expect((await auth(api().get('/messages/' + id), stranger)).status).toBe(
      404,
    );
    const inbox = await auth(api().get('/messages'), b);
    expect(
      inbox.body.find((x: { id: string }) => x.id === id).unreadCount,
    ).toBe(1);
    expect(
      (await auth(api().get('/messages/' + id), b)).body.contextPackageId,
    ).toBe(pkg.id);
    expect(
      (await auth(api().get('/messages'), b)).body.find(
        (x: { id: string }) => x.id === id,
      ).unreadCount,
    ).toBe(0);
    const reply = await auth(api().post(`/messages/${id}/send`), b).send({
      body: 'Terms attached',
    });
    expect(reply.status).toBe(201);
    const pdf = Buffer.from('%PDF-1.4 synthetic');
    const upload = await auth(
      api().post(`/messages/${id}/messages/${reply.body.id}/attachments`),
      b,
    )
      .set('Content-Type', 'application/pdf')
      .set('X-File-Name', 'terms.pdf')
      .send(pdf);
    expect(upload.status).toBe(201);
    expect(
      (
        await auth(
          api().get(`/messages/${id}/attachments/${upload.body.id}`),
          a,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await auth(
          api().get(`/messages/${id}/attachments/${upload.body.id}`),
          stranger,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await auth(
          api().post(`/messages/${id}/messages/${reply.body.id}/attachments`),
          b,
        )
          .set('Content-Type', 'application/pdf')
          .set('X-File-Name', 'fake.pdf')
          .send(Buffer.from('not a pdf'))
      ).status,
    ).toBe(400);
    expect(
      (
        await auth(api().post(`/messages/${id}/report`), a).send({
          reason: 'Synthetic report reason for integration testing.',
        })
      ).status,
    ).toBe(201);
    expect((await auth(api().post(`/messages/${id}/block`), a)).status).toBe(
      201,
    );
    expect(
      (
        await auth(api().post(`/messages/${id}/send`), b).send({
          body: 'Blocked response',
        })
      ).status,
    ).toBe(403);
    const custom = await auth(
      api().post('/messages/custom-requests'),
      stranger,
    ).send({
      providerSlug: b.profile.publicSlug,
      subtype: 'UMRAH',
      departureCity: 'Hyderabad',
      startDate: '2027-02-01',
      endDate: '2027-02-11',
      groupSize: 20,
      totalNights: 10,
      makkahNights: 6,
      madinahNights: 4,
      requirements: 'Need a custom group package with transfers.',
    });
    expect(custom.status).toBe(201);
    const customId = custom.body.conversationId;
    expect(
      (
        await auth(api().post(`/messages/${customId}/send`), b).send({
          body: 'We can serve this group.',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await db.customPackageRequest.findUnique({
          where: { id: custom.body.request.id },
        })
      )?.status,
    ).toBe('RESPONDED');
    expect(
      (
        await auth(
          api().post(`/messages/${customId}/custom-request/close`),
          stranger,
        )
      ).status,
    ).toBe(201);
    expect(
      await db.notificationIntent.count({
        where: { kind: 'MESSAGE_RECEIVED' },
      }),
    ).toBeGreaterThanOrEqual(3);
  }, 15000);
});
