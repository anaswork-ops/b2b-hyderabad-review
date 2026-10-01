import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
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
async function owner() {
  const id = randomUUID(),
    token = randomUUID() + randomUUID(),
    csrf = randomUUID() + randomUUID(),
    user = await db.user.create({
      data: {
        email: `vertical-${id}@example.test`,
        passwordHash: await argon2.hash('Synthetic-Only-Password-123!', {
          type: argon2.argon2id,
        }),
        emailVerifiedAt: new Date(),
        mobile:
          '+91' + String(Math.floor(1000000000 + Math.random() * 8999999999)),
        mobileVerifiedAt: new Date(),
      },
    }),
    business = await db.business.create({
      data: { primaryOwnerId: user.id, status: 'APPROVED' },
    });
  await db.businessProfile.create({
    data: {
      businessId: business.id,
      publicSlug: 'vertical-' + id,
      name: 'Vertical Supplier',
      businessType: 'DMC',
      description: 'Synthetic vertical supplier for integration tests.',
      headquartersCountry: 'India',
      headquartersState: 'Telangana',
      headquartersCity: 'Hyderabad',
      privateEmail: user.email,
      privatePhone: user.mobile!,
      yearsOperating: 5,
      languages: ['English'],
      marketsServed: ['India'],
      capabilities: ['Tourism', 'Visa'],
      serviceCountries: ['Turkey'],
      serviceCities: ['Istanbul'],
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
  return { cookie: 'b2b_session=' + encodeURIComponent(token), csrf };
}
const auth = (x: request.Test, u: Awaited<ReturnType<typeof owner>>) =>
  x.set('Cookie', u.cookie).set('X-CSRF-Token', u.csrf);
const availability = [
    {
      kind: 'DATE_RANGE',
      startDate: '2027-04-01',
      endDate: '2027-04-30',
      blackoutDates: [],
      capacity: 20,
    },
  ],
  commercial = {
    pricingMode: 'FIXED',
    price: 50000,
    currency: 'INR',
    availability,
  };
beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});
describe('three vertical extension', () => {
  it('enforces ownership, publication, filters, details, disclaimers and contextual enquiry', async () => {
    const market = 'isolated-' + randomUUID();
    const a = await owner(),
      b = await owner();
    const tourism = {
      name: 'Istanbul Culture',
      description: 'A complete synthetic tourism package for testing.',
      sourceMarket: market,
      departureCity: 'Hyderabad',
      destinationCountry: 'Turkey',
      destinationCities: ['Istanbul'],
      category: 'CULTURE',
      durationDays: 7,
      accommodation: 'Demo hotel',
      transport: 'Coach',
      inclusions: ['Hotel'],
      exclusions: ['Flights'],
      ...commercial,
    };
    const made = await auth(api().post('/verticals/tourism'), a).send(tourism);
    expect(made.status).toBe(201);
    expect(
      (
        await api()
          .get('/verticals/search')
          .query({ vertical: 'tourism', market })
      ).body.total,
    ).toBe(0);
    expect(
      (
        await auth(api().put(`/verticals/tourism/${made.body.id}`), b).send(
          tourism,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await auth(
          api().post(`/verticals/tourism/${made.body.id}/lifecycle`),
          a,
        ).send({ action: 'PUBLISH' })
      ).status,
    ).toBe(201);
    const found = await api().get('/verticals/search').query({
      vertical: 'tourism',
      destination: 'Turkey',
      category: 'Culture',
      startDate: '2027-04-10',
      endDate: '2027-04-12',
    });
    expect(
      found.body.items.some((x: { id: string }) => x.id === made.body.id),
    ).toBe(true);
    expect((await api().get(`/verticals/tourism/${made.body.id}`)).status).toBe(
      200,
    );
    const visa = {
      name: 'Turkey Visa Assistance',
      description: 'Synthetic visa assistance listing for testing only.',
      sourceMarket: market,
      applicantNationality: 'Indian',
      destinationCountry: 'Turkey',
      visaCategory: 'TOURIST',
      processingRequirement: 'Travel dates and complete documents required.',
      documentSummary: 'Passport and supporting documents are required.',
      appointmentAssistance: true,
      governmentFeeIncluded: false,
      ...commercial,
      availability: [{ kind: 'ON_REQUEST', blackoutDates: [] }],
    };
    const v = await auth(api().post('/verticals/visa'), a).send(visa);
    await auth(api().post(`/verticals/visa/${v.body.id}/lifecycle`), a).send({
      action: 'PUBLISH',
    });
    const detail = await api().get(`/verticals/visa/${v.body.id}`);
    expect(detail.body.disclaimer).toContain('never guaranteed');
    expect(
      (
        await auth(api().post('/messages'), b).send({
          contextType: 'VISA_SERVICE',
          contextId: v.body.id,
          message: 'Need assistance',
        })
      ).status,
    ).toBe(201);
  }, 20000);
});
