import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module.js';
import { getDatabase } from '../src/platform/db/prisma.js';
import { hashToken } from '../src/modules/auth/crypto.js';
if (
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
  '/b2btravelv2_phase2_test_phase7_20260930'
)
  throw new Error('Dedicated Phase 7 test database required');
const db = getDatabase();
let app: Awaited<ReturnType<typeof NestFactory.create>>;
const api = () => request(app.getHttpServer());
async function identity(
  role: 'ADMIN' | 'SUPER_ADMIN' | 'BUSINESS_USER' = 'BUSINESS_USER',
  mfa = true,
) {
  const token = randomUUID(),
    csrf = randomUUID(),
    user = await db.user.create({
      data: {
        email: `phase7-${randomUUID()}@example.test`,
        passwordHash: 'non-login synthetic fixture',
        role,
        emailVerifiedAt: new Date(),
        mfaEnabledAt: role !== 'BUSINESS_USER' && mfa ? new Date() : null,
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
  return { user, cookie: `b2b_session=${token}`, csrf };
}
type Identity = Awaited<ReturnType<typeof identity>>;
const auth = (r: request.Test, u: Identity) =>
  r.set('Cookie', u.cookie).set('X-CSRF-Token', u.csrf);
async function supplier() {
  const u = await identity(),
    business = await db.business.create({
      data: { primaryOwnerId: u.user.id, status: 'APPROVED' },
    }),
    profile = await db.businessProfile.create({
      data: {
        businessId: business.id,
        publicSlug: `p7-${randomUUID()}`,
        name: 'Phase7 supplier',
        businessType: 'DMC',
        description: 'Synthetic test supplier',
        headquartersCountry: 'India',
        headquartersState: 'Telangana',
        headquartersCity: 'Hyderabad',
        privateEmail: u.user.email,
        privatePhone: '+910000000000',
        yearsOperating: 1,
      },
    });
  return { ...u, business, profile };
}
beforeAll(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
});
afterAll(async () => {
  await app.close();
  await db.$disconnect();
});
describe('Phase 7 governance', { timeout: 20000 }, () => {
  it('requires live staff MFA and denies supplier impersonation and role management', async () => {
    const admin = await identity('ADMIN'),
      superAdmin = await identity('SUPER_ADMIN'),
      owner = await supplier(),
      noMfa = await identity('ADMIN', false);
    for (const path of [
      'dashboard',
      'businesses',
      'users',
      'reports',
      'audit',
      'health',
      'listings/packages',
    ]) {
      expect((await api().get('/admin/' + path)).status).toBe(401);
      expect((await auth(api().get('/admin/' + path), owner)).status).toBe(403);
      expect((await auth(api().get('/admin/' + path), noMfa)).status).toBe(401);
    }
    expect((await auth(api().get('/admin/users'), superAdmin)).status).toBe(
      200,
    );
    for (const staff of [admin, superAdmin])
      for (const path of ['/inventory', '/verticals', '/messages'])
        expect((await auth(api().get(path), staff)).status).toBe(403);
    expect(
      (
        await auth(
          api().post('/admin/users/' + owner.user.id + '/role'),
          admin,
        ).send({ role: 'SUPER_ADMIN' })
      ).status,
    ).toBe(404);
    const users = await auth(api().get('/admin/users'), admin);
    expect(users.status).toBe(200);
    expect(users.body.items.length).toBeLessThanOrEqual(25);
    const output = JSON.stringify(users.body);
    for (const field of [
      'passwordHash',
      'mfaSecretEncrypted',
      'tokenHash',
      'csrfHash',
    ])
      expect(output).not.toContain(field);
    expect((await auth(api().get('/admin/users?page=0'), admin)).status).toBe(
      400,
    );
  });
  it('suspends businesses without applications, revokes sessions, reactivates without reviving sessions and keeps data', async () => {
    const admin = await identity('ADMIN'),
      owner = await supplier(),
      path = `/admin/businesses/${owner.business.id}/status`;
    expect(
      (
        await api()
          .post(path)
          .set('Cookie', admin.cookie)
          .send({ action: 'SUSPEND', reason: 'Security review required' })
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(api().post(path), admin)
          .set('Origin', 'https://invalid.example')
          .send({ action: 'SUSPEND', reason: 'Security review required' })
      ).status,
    ).toBe(400);
    expect(
      (
        await auth(api().post(path), admin).send({
          action: 'SUSPEND',
          reason: 'Security review required',
        })
      ).status,
    ).toBe(201);
    expect((await auth(api().get('/auth/session'), owner)).status).toBe(401);
    expect(
      (await api().get(`/businesses/public/${owner.profile.publicSlug}`))
        .status,
    ).toBe(404);
    expect(
      (
        await auth(api().post(path), admin).send({
          action: 'REACTIVATE',
          reason: 'Security review completed',
        })
      ).status,
    ).toBe(201);
    expect((await auth(api().get('/auth/session'), owner)).status).toBe(401);
    expect(
      await db.businessProfile.count({ where: { id: owner.profile.id } }),
    ).toBe(1);
    expect(
      await db.auditEvent.count({
        where: {
          resourceId: owner.business.id,
          action: { startsWith: 'business.' },
        },
      }),
    ).toBe(2);
  });
  it('moderates all five listing models without changing commercial terms; supplier resume cannot bypass', async () => {
    const admin = await identity('ADMIN'),
      owner = await supplier(),
      buyer = await supplier();
    const base = {
      profileId: owner.profile.id,
      name: 'Phase7 listing',
      sourceMarket: 'Phase7-only',
      pricingMode: 'ON_REQUEST' as const,
      status: 'PUBLISHED' as const,
    };
    const pkg = await db.package.create({
      data: {
        ...base,
        subtype: 'UMRAH',
        departureCity: 'Hyderabad',
        destinationCities: ['Makkah'],
        totalNights: 5,
        makkahNights: 3,
        madinahNights: 2,
        accommodation: {},
        roomOccupancy: [],
        transport: {},
        meals: [],
        visaStatus: 'Assistance',
        ziyarat: [],
        assistance: [],
        inclusions: [],
        exclusions: [],
        cancellationTerms: 'Synthetic terms',
      },
    });
    const service = await db.service.create({
      data: {
        ...base,
        subtype: 'UMRAH',
        description: 'Synthetic service',
        serviceCountry: 'Saudi Arabia',
        serviceCity: 'Makkah',
      },
    });
    const tourism = await db.tourismPackage.create({
      data: {
        ...base,
        description: 'Synthetic tourism',
        departureCity: 'Hyderabad',
        destinationCountry: 'Turkey',
        destinationCities: ['Istanbul'],
        category: 'CULTURE',
        durationDays: 5,
        accommodation: 'Hotel',
        transport: 'Coach',
        inclusions: [],
        exclusions: [],
      },
    });
    const visa = await db.visaService.create({
      data: {
        ...base,
        description: 'Synthetic visa',
        applicantNationality: 'Indian',
        destinationCountry: 'Turkey',
        visaCategory: 'TOURIST',
        processingRequirement: 'Documents',
        documentSummary: 'Passport',
      },
    });
    const offer = await db.offer.create({
      data: {
        profileId: owner.profile.id,
        packageId: pkg.id,
        title: 'Phase7 offer',
        description: 'Synthetic offer',
        validFrom: new Date('2026-01-01'),
        validTo: new Date('2027-12-31'),
        pricingMode: 'ON_REQUEST',
      },
    });
    for (const [kind, item, context] of [
      ['packages', pkg, 'PACKAGE'],
      ['services', service, 'SERVICE'],
      ['tourism', tourism, 'TOURISM_PACKAGE'],
      ['visa', visa, 'VISA_SERVICE'],
      ['offers', offer, 'OFFER'],
    ] as const) {
      const path = `/admin/listings/${kind}/${item.id}/moderation`;
      expect(
        (
          await auth(api().post(path), owner).send({
            hidden: true,
            reason: 'Invalid content review',
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await auth(api().post(path), admin).send({
            hidden: true,
            reason: 'short',
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await auth(api().post(path), admin).send({
            hidden: true,
            reason: 'Invalid content review',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await auth(api().post('/messages'), buyer).send({
            contextType: context,
            contextId: item.id,
            message: 'Synthetic enquiry',
          })
        ).status,
      ).toBe(404);
      if (kind === 'tourism' || kind === 'visa')
        expect((await api().get(`/verticals/${kind}/${item.id}`)).status).toBe(
          404,
        );
      if (kind === 'packages' || kind === 'services') {
        for (const action of ['PAUSE', 'RESUME'])
          expect(
            (
              await auth(
                api().post(`/inventory/${kind}/${item.id}/lifecycle`),
                owner,
              ).send({ action })
            ).status,
          ).toBe(201);
        const search = await api().get(
          `/marketplace/search?mode=${kind}&market=Phase7-only`,
        );
        expect(
          search.body.items.some((x: { id: string }) => x.id === item.id),
        ).toBe(false);
      }
      if (kind === 'packages') {
        const profile = await api().get(
          `/businesses/public/${owner.profile.publicSlug}`,
        );
        expect(
          profile.body.packages.some((x: { id: string }) => x.id === pkg.id),
        ).toBe(false);
        const compared = await auth(
          api().post('/marketplace/compare'),
          buyer,
        ).send({ packageIds: [pkg.id, randomUUID()] });
        expect(compared.status).toBe(201);
        expect(compared.body).toHaveLength(0);
        expect(
          (
            await auth(api().post('/messages'), buyer).send({
              contextType: 'OFFER',
              contextId: offer.id,
              message: 'Linked offering enquiry',
            })
          ).status,
        ).toBe(404);
        const media = await db.offeringMedia.create({
          data: {
            packageId: pkg.id,
            kind: 'IMAGE',
            storageKey: `synthetic/${randomUUID()}`,
            filename: 'fixture.png',
            contentType: 'image/png',
            sizeBytes: 8,
            isPublic: true,
          },
        });
        expect(
          (
            await api().get(
              `/inventory/public/${owner.profile.publicSlug}/packages/${pkg.id}/media/${media.id}`,
            )
          ).status,
        ).toBe(404);
      }
      const inspected = await auth(
        api().get(`/admin/listings/${kind}/${item.id}`),
        admin,
      );
      expect(inspected.body.moderationHidden).toBe(true);
      expect(
        (
          await auth(api().post(path), admin).send({
            hidden: false,
            reason: 'Content review cleared',
          })
        ).status,
      ).toBe(201);
      expect(
        (
          await auth(api().post('/messages'), buyer).send({
            contextType: context,
            contextId: item.id,
            message: 'Synthetic enquiry',
          })
        ).status,
      ).toBe(201);
    }
    expect(
      (await db.package.findUniqueOrThrow({ where: { id: pkg.id } }))
        .cancellationTerms,
    ).toBe(pkg.cancellationTerms);
    const audit = await auth(
      api().get(`/admin/audit?resourceId=${pkg.id}`),
      admin,
    );
    expect(audit.body.total).toBe(2);
    expect(
      (
        await auth(
          api().delete(`/admin/audit/${audit.body.items[0].id}`),
          admin,
        )
      ).status,
    ).toBe(404);
  });
  it('resolves reports with an audit reason without exposing private messages and degrades safely', async () => {
    const admin = await identity('ADMIN'),
      a = await supplier(),
      b = await supplier();
    const c = await auth(api().post('/messages'), a).send({
      contextType: 'BUSINESS',
      contextId: b.profile.publicSlug,
      message: 'PRIVATE_BODY_NOT_FOR_ADMIN',
    });
    expect(c.status).toBe(201);
    const conversation = await db.conversation.findFirstOrThrow({
      where: { participants: { some: { businessId: a.business.id } } },
    });
    const report = await db.conversationReport.create({
      data: {
        conversationId: conversation.id,
        reporterBusinessId: a.business.id,
        reason: 'Synthetic report for moderation',
      },
    });
    const listed = await auth(api().get('/admin/reports'), admin);
    expect(JSON.stringify(listed.body)).not.toContain(
      'PRIVATE_BODY_NOT_FOR_ADMIN',
    );
    expect(
      (
        await auth(
          api().post(`/admin/reports/${report.id}/resolve`),
          admin,
        ).send({ reason: 'Reviewed supplier conduct' })
      ).status,
    ).toBe(201);
    expect(
      (
        await db.conversationReport.findUniqueOrThrow({
          where: { id: report.id },
        })
      ).status,
    ).toBe('REVIEWED');
    expect(
      (await auth(api().get(`/messages/${conversation.id}`), admin)).status,
    ).toBe(403);
    const health = await auth(api().get('/admin/health'), admin);
    expect(health.status).toBe(200);
    for (const value of [
      'password',
      'redis://',
      'postgresql://',
      'payloadEncrypted',
      'storageKey',
      'PRIVATE_BODY',
    ])
      expect(JSON.stringify(health.body)).not.toContain(value);
    const original = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://127.0.0.1:1/7';
    try {
      const failed = await auth(api().get('/admin/health'), admin);
      expect(failed.status).toBe(200);
      expect(failed.body.jobs.status).toBe('unavailable');
    } finally {
      process.env.REDIS_URL = original;
    }
  }, 15000);
});
