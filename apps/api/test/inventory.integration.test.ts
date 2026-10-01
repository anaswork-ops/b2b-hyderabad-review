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
const api = () => request(app.getHttpServer()),
  password = 'Synthetic-Only-Password-123!';
async function owner() {
  const token = randomUUID() + randomUUID(),
    csrf = randomUUID() + randomUUID();
  const user = await db.user.create({
    data: {
      email: 'phase4-' + randomUUID() + '@example.test',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: new Date(),
      mobile:
        '+91' + String(Math.floor(1000000000 + Math.random() * 8999999999)),
      mobileVerifiedAt: new Date(),
    },
  });
  await db.business.create({
    data: { primaryOwnerId: user.id, status: 'APPROVED' },
  });
  await db.session.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      csrfHash: hashToken(csrf),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  return { cookie: 'b2b_session=' + encodeURIComponent(token), csrf, user };
}
const profile = (slug: string, email: string) => ({
  publicSlug: slug,
  name: 'Synthetic Pilgrimage Partners',
  businessType: 'TRAVEL_AGENCY',
  description:
    'Synthetic approved business profile for Phase 4 integration validation.',
  headquartersCountry: 'India',
  headquartersState: 'Telangana',
  headquartersCity: 'Hyderabad',
  publicEmail: 'public-' + email,
  publicPhone: '+919900000001',
  privateEmail: 'private-' + email,
  privatePhone: '+919900000002',
  website: 'https://example.test',
  yearsOperating: 8,
  languages: ['English', 'Urdu'],
  marketsServed: ['India'],
  capabilities: ['Umrah packages', 'Ground handling'],
  serviceCountries: ['Saudi Arabia'],
  serviceCities: ['Makkah', 'Madinah'],
  licenceNumber: 'TEST-LICENCE',
  licenceIssuer: 'Synthetic Authority',
});
const packageInput = {
  name: 'Complete Umrah 12 Nights',
  subtype: 'UMRAH',
  sourceMarket: 'India',
  departureCity: 'Hyderabad',
  destinationCities: ['Makkah', 'Madinah'],
  validFrom: '2027-01-01',
  validTo: '2027-12-31',
  totalNights: 12,
  makkahNights: 7,
  madinahNights: 5,
  minimumGroupSize: 10,
  maximumGroupSize: 40,
  accommodation: { makkah: 'Synthetic Hotel', madinah: 'Synthetic Hotel' },
  roomOccupancy: ['Double', 'Triple'],
  transport: { type: 'Private coach' },
  flights: { route: 'HYD-JED' },
  meals: ['Breakfast'],
  visaStatus: 'Included',
  ziyarat: ['Makkah', 'Madinah'],
  assistance: ['Airport', '24/7'],
  inclusions: ['Hotels', 'Transfers', 'Visa'],
  exclusions: ['Personal expenses'],
  pricingMode: 'FIXED',
  price: 125000,
  currency: 'INR',
  cancellationTerms: 'Refund schedule applies before departure.',
  availability: [
    {
      kind: 'DATE_RANGE',
      startDate: '2027-01-01',
      endDate: '2027-12-31',
      blackoutDates: ['2027-06-01'],
      capacity: 40,
    },
  ],
};
beforeAll(async () => {
  app = await NestFactory.create(AppModule, {
    logger: false,
    bodyParser: false,
  });
  app.use(
    '/inventory/packages',
    express.raw({
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
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
describe('Phase 4 inventory and profile direct API authorization', () => {
  it('enforces approval, ownership, validation, privacy, CRUD and lifecycle', async () => {
    expect((await api().get('/inventory')).status).toBe(401);
    const a = await owner(),
      b = await owner(),
      slug = 'synthetic-' + randomUUID();
    for (const x of [a, b])
      expect(
        (
          await api()
            .put('/businesses/mine/profile')
            .set('Cookie', x.cookie)
            .set('X-CSRF-Token', x.csrf)
            .send(
              profile(x === a ? slug : 'other-' + randomUUID(), x.user.email),
            )
        ).status,
      ).toBe(200);
    expect(
      (
        await api()
          .post('/inventory/packages')
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
          .send({ ...packageInput, currency: undefined })
      ).status,
    ).toBe(400);
    const made = await api()
      .post('/inventory/packages')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .send(packageInput);
    expect(made.status).toBe(201);
    const id = made.body.id;
    expect(
      (
        await api()
          .put('/inventory/packages/' + id)
          .set('Cookie', b.cookie)
          .set('X-CSRF-Token', b.csrf)
          .send(packageInput)
      ).status,
    ).toBe(404);
    expect(
      (
        await api()
          .post('/inventory/packages/' + id + '/lifecycle')
          .set('Cookie', a.cookie)
          .send({ action: 'PUBLISH' })
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/inventory/packages/' + id + '/lifecycle')
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
          .send({ action: 'PUBLISH' })
      ).status,
    ).toBe(201);
    const invalidMedia = await api()
      .post('/inventory/packages/' + id + '/media')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .set('X-Media-Kind', 'IMAGE')
      .set('X-File-Name', 'fake.png')
      .set('X-Media-Public', 'true')
      .set('Content-Type', 'image/png')
      .send(Buffer.from('not an image'));
    expect(invalidMedia.status).toBe(400);
    const media = await api()
      .post('/inventory/packages/' + id + '/media')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .set('X-Media-Kind', 'IMAGE')
      .set('X-File-Name', 'synthetic.png')
      .set('X-Media-Public', 'true')
      .set('Content-Type', 'image/png')
      .send(
        Buffer.concat([
          Buffer.from('89504e470d0a1a0a', 'hex'),
          Buffer.from('synthetic'),
        ]),
      );
    expect(media.status).toBe(201);
    expect(
      (await api().get('/inventory/packages/' + id + '/media/' + media.body.id))
        .status,
    ).toBe(401);
    expect(
      (
        await api()
          .get('/inventory/packages/' + id + '/media/' + media.body.id)
          .set('Cookie', a.cookie)
      ).status,
    ).toBe(200);
    expect(
      (
        await api().get(
          '/inventory/public/' +
            slug +
            '/packages/' +
            id +
            '/media/' +
            media.body.id,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .delete('/inventory/packages/' + id)
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
      ).status,
    ).toBe(400);
    const duplicate = await api()
      .post('/inventory/packages/' + id + '/duplicate')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf);
    expect(duplicate.body.status).toBe('DRAFT');
    expect(
      (
        await api()
          .delete('/inventory/packages/' + duplicate.body.id)
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .post('/inventory/packages/' + id + '/lifecycle')
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
          .send({ action: 'PAUSE' })
      ).body.status,
    ).toBe('PAUSED');
    expect(
      (
        await api()
          .post('/inventory/packages/' + id + '/lifecycle')
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
          .send({ action: 'RESUME' })
      ).body.status,
    ).toBe('PUBLISHED');
    const service = await api()
      .post('/inventory/services')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .send({
        name: 'Umrah Ground Service',
        subtype: 'UMRAH',
        description: 'Complete synthetic ground handling service.',
        sourceMarket: 'India',
        serviceCountry: 'Saudi Arabia',
        serviceCity: 'Makkah',
        pricingMode: 'ON_REQUEST',
        availability: [
          { kind: 'YEAR_ROUND', blackoutDates: [], capacity: 100 },
        ],
      });
    expect(service.status).toBe(201);
    const offerBody = {
      serviceId: service.body.id,
      title: 'Early booking offer',
      description: 'Synthetic early booking commercial offer.',
      validFrom: '2027-01-01',
      validTo: '2027-03-31',
      active: true,
      pricingMode: 'STARTING_FROM',
      price: 5000,
      currency: 'INR',
    };
    const offer = await api()
      .post('/inventory/offers')
      .set('Cookie', a.cookie)
      .set('X-CSRF-Token', a.csrf)
      .send(offerBody);
    expect(offer.status).toBe(201);
    expect(
      (
        await api()
          .put('/inventory/offers/' + offer.body.id)
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
          .send({ ...offerBody, title: 'Updated early booking offer' })
      ).status,
    ).toBe(200);
    expect(
      (
        await api()
          .delete('/inventory/offers/' + offer.body.id)
          .set('Cookie', a.cookie)
          .set('X-CSRF-Token', a.csrf)
      ).status,
    ).toBe(200);
    const publicProfile = await api().get('/businesses/public/' + slug);
    expect(publicProfile.status).toBe(200);
    expect(publicProfile.body.privateEmail).toBeUndefined();
    expect(publicProfile.body.licenceNumber).toBeUndefined();
    expect(publicProfile.body.packages[0].name).toBe(packageInput.name);
    expect((await api().get('/businesses/network/' + slug)).status).toBe(401);
    const network = await api()
      .get('/businesses/network/' + slug)
      .set('Cookie', b.cookie);
    expect(network.body.privateEmail).toBe(
      profile(slug, a.user.email).privateEmail,
    );
    expect(
      await db.auditEvent.findFirst({
        where: { actorId: a.user.id, action: 'package.publish' },
      }),
    ).not.toBeNull();
  }, 15_000);
});
