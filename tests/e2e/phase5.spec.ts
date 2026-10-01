import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from '../../apps/api/node_modules/argon2';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Disposable phase2_test database required');
const db = getDatabase(),
  base = 'http://localhost:3000',
  password = 'Synthetic-Only-Password-123!';
test('guest date search and approved comparison', async ({ page }) => {
  test.setTimeout(90000);
  const s = randomUUID(),
    market = 'Browser-' + s,
    email = 'phase5-' + s + '@example.test',
    user = await db.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        emailVerifiedAt: new Date(),
        mobile:
          '+91' + String(Math.floor(1000000000 + Math.random() * 8999999999)),
        mobileVerifiedAt: new Date(),
      },
    }),
    business = await db.business.create({
      data: { primaryOwnerId: user.id, status: 'APPROVED' },
    }),
    profile = await db.businessProfile.create({
      data: {
        businessId: business.id,
        publicSlug: 'phase5-' + s,
        name: 'Browser Supplier',
        businessType: 'TOUR_OPERATOR',
        description:
          'Synthetic approved marketplace supplier for browser validation.',
        headquartersCountry: 'UAE',
        headquartersState: 'Dubai',
        headquartersCity: 'Dubai',
        privateEmail: email,
        privatePhone: user.mobile!,
        yearsOperating: 5,
        languages: ['English'],
        marketsServed: [market],
        capabilities: ['Umrah'],
        serviceCountries: ['Saudi Arabia'],
        serviceCities: ['Makkah'],
      },
    }),
    common = {
      profileId: profile.id,
      subtype: 'UMRAH' as const,
      sourceMarket: market,
      departureCity: 'Hyderabad',
      destinationCities: ['Makkah'],
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
      status: 'PUBLISHED' as const,
    };
  for (const [name, start, end] of [
    ['January Umrah', '2027-01-01', '2027-01-31'],
    ['February Umrah', '2027-02-01', '2027-02-28'],
  ] as const)
    await db.package.create({
      data: {
        ...common,
        name,
        availability: {
          create: {
            kind: 'DATE_RANGE',
            startDate: new Date(start),
            endDate: new Date(end),
            blackoutDates: [],
            capacity: 20,
          },
        },
      },
    });
  await page.goto(
    base + '/marketplace?mode=packages&market=' + encodeURIComponent(market),
  );
  await page.getByLabel('Travel start').fill('2027-01-10');
  await page.getByLabel('Travel end').fill('2027-01-12');
  await page.getByLabel('Travellers').fill('5');
  let searched = page.waitForResponse(
    (response) =>
      response.url().includes('/marketplace/search?') &&
      response.url().includes('startDate=2027-01-10'),
  );
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await searched;
  await expect(page).toHaveURL(/startDate=2027-01-10/);
  await expect(page.getByText('1 Matching Results')).toBeVisible();
  await expect(page.getByText('January Umrah')).toBeVisible();
  await expect(page.getByText('February Umrah')).toHaveCount(0);
  await page.getByLabel('Travel start').fill('2027-02-10');
  await page.getByLabel('Travel end').fill('2027-02-12');
  searched = page.waitForResponse(
    (response) =>
      response.url().includes('/marketplace/search?') &&
      response.url().includes('startDate=2027-02-10'),
  );
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await searched;
  await expect(page).toHaveURL(/startDate=2027-02-10/);
  await expect(page.getByText('1 Matching Results')).toBeVisible();
  await expect(page.getByText('February Umrah')).toBeVisible();
  await page.getByLabel('Travel start').fill('');
  await page.getByLabel('Travel end').fill('');
  searched = page.waitForResponse(
    (response) =>
      response.url().includes('/marketplace/search?') &&
      !response.url().includes('startDate='),
  );
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await searched;
  let boxes = page.getByLabel('Compare');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: /Compare 2 packages/ }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(base + '/business');
  await page.goto(
    base + '/marketplace?mode=packages&market=' + encodeURIComponent(market),
  );
  await expect(page.getByText('2 Matching Results')).toBeVisible();
  boxes = page.getByLabel('Compare');
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole('button', { name: /Compare 2 packages/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Package comparison' }),
  ).toBeVisible();
  const comparison = page.locator('.comparison');
  await expect(comparison.getByText('January Umrah')).toBeVisible();
  await expect(comparison.getByText('February Umrah')).toBeVisible();
});
test.afterAll(async () => {
  await db.$disconnect();
});
