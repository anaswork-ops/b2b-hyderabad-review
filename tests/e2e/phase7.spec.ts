import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
import { hashToken } from '../../apps/api/src/modules/auth/crypto';
process.loadEnvFile('.env');
if (
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
  '/b2btravelv2_phase2_test_phase7_20260930'
)
  throw new Error('Dedicated Phase 7 test database required');
const db = getDatabase();
test('Admin Console navigates all areas and safely moderates a disposable service', async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const id = randomUUID(),
    token = randomUUID(),
    csrf = randomUUID();
  const user = await db.user.create({
    data: {
      email: `p7-browser-${id}@example.test`,
      passwordHash: 'non-login fixture',
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      mfaEnabledAt: new Date(),
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
  const owner = await db.user.create({
    data: {
      email: `p7-owner-${id}@example.test`,
      passwordHash: 'non-login fixture',
      emailVerifiedAt: new Date(),
    },
  });
  const business = await db.business.create({
    data: { primaryOwnerId: owner.id, status: 'APPROVED' },
  });
  const profile = await db.businessProfile.create({
    data: {
      businessId: business.id,
      publicSlug: `p7-browser-${id}`,
      name: `P7 Browser ${id}`,
      businessType: 'DMC',
      description: 'Synthetic browser supplier',
      headquartersCountry: 'India',
      headquartersState: 'Telangana',
      headquartersCity: 'Hyderabad',
      privateEmail: owner.email,
      privatePhone: '+910000000000',
      yearsOperating: 1,
    },
  });
  const service = await db.service.create({
    data: {
      profileId: profile.id,
      name: `P7 Service ${id}`,
      subtype: 'UMRAH',
      status: 'PUBLISHED',
      description: 'Browser test service',
      sourceMarket: 'Phase7 browser',
      serviceCountry: 'Saudi Arabia',
      serviceCity: 'Makkah',
      pricingMode: 'ON_REQUEST',
    },
  });
  await context.addCookies([
    {
      name: 'b2b_session',
      value: token,
      url: 'http://localhost:3000',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'b2b_csrf',
      value: csrf,
      url: 'http://localhost:3000',
      sameSite: 'Lax',
    },
  ]);
  await page.goto('/admin');
  await expect(
    page.getByRole('heading', { name: 'Admin Console' }),
  ).toBeVisible();
  for (const area of [
    'Applications',
    'Businesses',
    'Users',
    'Reports',
    'Audit',
    'System Health',
    'Dashboard',
  ]) {
    await page.getByRole('button', { name: area, exact: true }).click();
    await expect(
      page.getByRole('heading', {
        name: area === 'Applications' ? 'Application review' : area,
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Marketplace', exact: true }).click();
  await page.getByLabel('Listing type').selectOption('services');
  await page.getByLabel('Search marketplace').fill(service.name);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: service.name, exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page
    .getByLabel('Reason for this decision')
    .fill('Synthetic browser moderation reason');
  await page.getByRole('button', { name: 'Hide listing', exact: true }).click();
  await expect
    .poll(
      async () =>
        (await db.service.findUniqueOrThrow({ where: { id: service.id } }))
          .moderationHidden,
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Inspect', exact: true }).click();
  await page
    .getByLabel('Reason for this decision')
    .fill('Synthetic browser review cleared');
  await page
    .getByRole('button', { name: 'Remove moderation restriction' })
    .click();
  await expect
    .poll(
      async () =>
        (await db.service.findUniqueOrThrow({ where: { id: service.id } }))
          .moderationHidden,
    )
    .toBe(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('heading', { name: 'Admin Console' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/phase7-admin-mobile.png',
    fullPage: true,
  });
});
