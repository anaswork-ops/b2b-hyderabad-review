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
beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});
describe('Phase 5 availability-aware marketplace', () => {
  it('matches dates, blackout, geography, modes, pagination and protected comparison', async () => {
    const suffix = randomUUID(),
      market = 'India-' + suffix,
      token = randomUUID() + randomUUID(),
      csrf = randomUUID() + randomUUID();
    const user = await db.user.create({
      data: {
        email: 'phase5-' + suffix + '@example.test',
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
      data: { primaryOwnerId: user.id, status: 'APPROVED' },
    });
    const profile = await db.businessProfile.create({
      data: {
        businessId: business.id,
        publicSlug: 'phase5-' + suffix,
        name: 'Remote Saudi Supplier',
        businessType: 'DMC',
        description:
          'Synthetic marketplace supplier located outside the source market.',
        headquartersCountry: 'UAE',
        headquartersState: 'Dubai',
        headquartersCity: 'Dubai',
        privateEmail: user.email,
        privatePhone: user.mobile!,
        yearsOperating: 10,
        languages: ['English'],
        marketsServed: [market],
        capabilities: ['Umrah'],
        serviceCountries: ['Saudi Arabia'],
        serviceCities: ['Makkah'],
      },
    });
    const common = {
      profileId: profile.id,
      subtype: 'UMRAH' as const,
      sourceMarket: market,
      departureCity: 'Hyderabad',
      destinationCities: ['Makkah', 'Madinah'],
      totalNights: 10,
      makkahNights: 6,
      madinahNights: 4,
      accommodation: { details: 'Four star' },
      roomOccupancy: ['Double'],
      transport: { details: 'Coach' },
      meals: ['Breakfast'],
      visaStatus: 'Included',
      ziyarat: ['Makkah'],
      assistance: ['Guide'],
      inclusions: ['Hotel'],
      exclusions: ['Personal'],
      pricingMode: 'FIXED' as const,
      price: 100000,
      currency: 'INR',
      cancellationTerms: 'Synthetic cancellation schedule.',
    };
    const available = await db.package.create({
      data: {
        ...common,
        name: 'January Available',
        availability: {
          create: {
            kind: 'DATE_RANGE',
            startDate: new Date('2027-01-01'),
            endDate: new Date('2027-01-31'),
            blackoutDates: [new Date('2027-01-15')],
            capacity: 20,
          },
        },
        status: 'PUBLISHED',
      },
    });
    const requestOnly = await db.package.create({
      data: {
        ...common,
        name: 'On Request',
        pricingMode: 'ON_REQUEST',
        price: null,
        currency: null,
        availability: { create: { kind: 'ON_REQUEST', blackoutDates: [] } },
        status: 'PUBLISHED',
      },
    });
    await db.service.create({
      data: {
        profileId: profile.id,
        name: 'Makkah Ground Handling',
        subtype: 'UMRAH',
        description: 'Synthetic year round service.',
        sourceMarket: market,
        serviceCountry: 'Saudi Arabia',
        serviceCity: 'Makkah',
        pricingMode: 'ON_REQUEST',
        availability: { create: { kind: 'YEAR_ROUND', blackoutDates: [] } },
        status: 'PUBLISHED',
      },
    });
    const start = Date.now(),
      match = await api().get('/marketplace/search').query({
        mode: 'packages',
        market,
        departure: 'Hyderabad',
        destination: 'Makkah',
        subtype: 'UMRAH',
        startDate: '2027-01-10',
        endDate: '2027-01-12',
        groupSize: 10,
        pageSize: 1,
      });
    expect(match.status).toBe(200);
    expect(match.body.total).toBe(2);
    expect(match.body.items).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(3000);
    const blackout = await api().get('/marketplace/search').query({
      mode: 'packages',
      market,
      startDate: '2027-01-15',
      endDate: '2027-01-15',
      availability: 'AVAILABLE',
    });
    expect(blackout.body.items.map((x: { id: string }) => x.id)).not.toContain(
      available.id,
    );
    const availableOnly = await api()
      .get('/marketplace/search')
      .query({ mode: 'packages', market, availability: 'AVAILABLE' });
    expect(
      availableOnly.body.items.map((x: { id: string }) => x.id),
    ).not.toContain(requestOnly.id);
    expect(
      (
        await api()
          .get('/marketplace/search')
          .query({ mode: 'services', market, destination: 'Makkah' })
      ).body.total,
    ).toBeGreaterThan(0);
    expect(
      (
        await api()
          .get('/marketplace/search')
          .query({ mode: 'businesses', market, supplierType: 'DMC' })
      ).body.items.some(
        (x: { publicSlug: string }) => x.publicSlug === profile.publicSlug,
      ),
    ).toBe(true);
    expect(
      (
        await api()
          .post('/marketplace/compare')
          .send({ packageIds: [available.id, requestOnly.id] })
      ).status,
    ).toBe(401);
    await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        csrfHash: hashToken(csrf),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    expect(
      (
        await api()
          .post('/marketplace/compare')
          .set('Cookie', 'b2b_session=' + encodeURIComponent(token))
          .send({ packageIds: [available.id, requestOnly.id] })
      ).status,
    ).toBe(403);
    const compared = await api()
      .post('/marketplace/compare')
      .set('Cookie', 'b2b_session=' + encodeURIComponent(token))
      .set('X-CSRF-Token', csrf)
      .send({ packageIds: [available.id, requestOnly.id] });
    expect(compared.status).toBe(201);
    expect(compared.body).toHaveLength(2);
  }, 15000);
});
