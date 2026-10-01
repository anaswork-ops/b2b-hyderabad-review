import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from '../../apps/api/node_modules/argon2';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Disposable phase2_test database required');
const db = getDatabase(),
  password = 'Synthetic-Only-Password-123!';

async function agency(label: string, market = 'India') {
  const id = randomUUID(),
    email = `phase6-${label.toLowerCase()}-${id}@example.test`;
  const user = await db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
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
      publicSlug: `phase6-${label.toLowerCase()}-${id}`,
      name: `Browser ${label}`,
      businessType: 'TRAVEL_AGENCY',
      description: 'Synthetic browser agency for Phase 6 messaging validation.',
      headquartersCountry: 'India',
      headquartersState: 'Telangana',
      headquartersCity: 'Hyderabad',
      privateEmail: email,
      privatePhone: user.mobile!,
      yearsOperating: 5,
      languages: ['English'],
      marketsServed: [market],
      capabilities: ['Umrah'],
      serviceCountries: ['Saudi Arabia'],
      serviceCities: ['Makkah'],
    },
  });
  return { email, profile };
}

test('approved agencies enquire and reply with retained package context', async ({
  page,
}) => {
  test.setTimeout(90000);
  const market = 'Phase6-' + randomUUID(),
    buyer = await agency('Buyer', market),
    supplier = await agency('Supplier', market),
    packageName = 'Phase 6 Umrah ' + supplier.profile.publicSlug.slice(-8);
  await db.package.create({
    data: {
      profileId: supplier.profile.id,
      name: packageName,
      subtype: 'UMRAH',
      sourceMarket: market,
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
      availability: { create: { kind: 'YEAR_ROUND', blackoutDates: [] } },
    },
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Build better journeys, together.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: /Join the Network/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Explore Businesses' }),
  ).toBeVisible();
  await expect(
    page.locator('.vertical-tile[href*="mode=tourism"]'),
  ).toBeVisible();
  await expect(
    page.locator('.vertical-tile[href*="mode=packages"]'),
  ).toBeVisible();
  await expect(page.locator('.vertical-tile[href*="mode=visa"]')).toBeVisible();
  await expect(
    page.locator('.vertical-tile[href*="mode=services"]'),
  ).toBeVisible();
  await expect(page.getByLabel('Current market')).toHaveValue('India');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole('heading', { name: 'Build better journeys, together.' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/login');
  await page.getByLabel('Email').fill(buyer.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/business$/);
  await expect(
    page.getByRole('heading', { name: 'Good to see you.' }),
  ).toBeVisible();
  await expect(page.getByText('Active packages')).toBeVisible();
  await expect(page.getByText('Messages needing attention')).toBeVisible();
  await expect(page.getByText('Recent marketplace activity')).toBeVisible();
  await expect(
    page.getByRole('button', { name: '+ New package' }),
  ).toBeVisible();
  await expect(page.getByLabel('Market')).toHaveValue('India');
  await page.goto(
    '/marketplace?mode=packages&market=' + encodeURIComponent(market),
  );
  const card = page.getByRole('article').filter({ hasText: packageName });
  await card.getByRole('button', { name: 'Message Supplier' }).click();
  await expect(page).toHaveURL(/\/messages/);
  await page.getByRole('button', { name: /PACKAGE/ }).click();
  await expect(page.getByRole('heading', { name: 'PACKAGE' })).toBeVisible();
  await expect(
    page.locator('.message-history').getByText('Enquiry about ' + packageName),
  ).toBeVisible();
  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Email').fill(supplier.email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/business$/);
  await page.goto('/messages');
  await expect(page.getByText('1 unread')).toBeVisible();
  await page.getByRole('button', { name: /PACKAGE/ }).click();
  await page.getByLabel('Message').fill('Supplier response from browser test');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(
    page
      .locator('.message-history')
      .getByText('Supplier response from browser test'),
  ).toBeVisible();
});

test.afterAll(async () => {
  await db.$disconnect();
});
