import { expect, test } from '@playwright/test';
import argon2 from '../../apps/api/node_modules/argon2';
import { randomUUID } from 'node:crypto';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';

process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Disposable phase2_test database required');

const db = getDatabase();
const password = 'Synthetic-Only-Password-123!';

async function agency(label: string) {
  const id = randomUUID();
  const email = `vertical-browser-${label}-${id}@example.test`;
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
      publicSlug: `vertical-browser-${label}-${id}`,
      name: `Vertical Browser ${label}`,
      businessType: 'DMC',
      description: 'Synthetic approved supplier for vertical browser testing.',
      headquartersCountry: 'India',
      headquartersState: 'Telangana',
      headquartersCity: 'Hyderabad',
      privateEmail: email,
      privatePhone: user.mobile!,
      yearsOperating: 7,
      languages: ['English'],
      marketsServed: ['India'],
      capabilities: ['Tourism', 'Hajj & Umrah', 'Visa Services'],
      serviceCountries: ['Turkey', 'Saudi Arabia'],
      serviceCities: ['Istanbul', 'Makkah'],
      verticals: ['TOURISM', 'HAJJ_UMRAH', 'VISA_SERVICES'],
    },
  });
  return { email, profile };
}

async function signIn(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/business$/);
}

test('supplier creates and publishes independent tourism and visa inventory', async ({
  page,
}) => {
  test.setTimeout(120000);
  const supplier = await agency('supplier');
  const tourismName = `Istanbul Culture ${randomUUID().slice(0, 8)}`;
  const visaName = `Turkey Visa Help ${randomUUID().slice(0, 8)}`;
  await db.package.create({
    data: {
      profileId: supplier.profile.id,
      name: `Umrah Journey ${randomUUID().slice(0, 8)}`,
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
      visaStatus: 'Assistance only',
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
  await signIn(page, supplier.email);
  await page.goto('/business/verticals');
  const tourism = page.locator('form').filter({
    has: page.getByRole('button', { name: 'Create Tourism draft' }),
  });
  for (const [name, value] of Object.entries({
    name: tourismName,
    sourceMarket: 'India',
    departureCity: 'Hyderabad',
    destinationCountry: 'Turkey',
    destinationCities: 'Istanbul',
    category: 'CULTURE',
    durationDays: '7',
    accommodation: 'Demo hotel',
    transport: 'Coach',
    inclusions: 'Hotel, Transfers',
    exclusions: 'Flights',
    currency: 'INR',
    price: '50000',
    description:
      'A complete synthetic tourism package for reliable browser testing.',
  }))
    await tourism.getByLabel(name, { exact: true }).fill(value);
  await tourism.getByRole('button', { name: 'Create Tourism draft' }).click();
  const tourismCard = page
    .getByRole('article')
    .filter({ hasText: tourismName });
  await expect(tourismCard).toContainText('DRAFT');
  await tourismCard.getByRole('button', { name: 'Publish' }).click();
  await expect(tourismCard).toContainText('PUBLISHED');

  const visa = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Create Visa draft' }) });
  for (const [name, value] of Object.entries({
    name: visaName,
    sourceMarket: 'India',
    applicantNationality: 'Indian',
    destinationCountry: 'Turkey',
    visaCategory: 'TOURIST',
    currency: 'INR',
    price: '2500',
    description:
      'Synthetic visa assistance service for reliable browser testing.',
    processingRequirement:
      'Intended travel dates and complete documents are required.',
    documentSummary:
      'Passport, photograph and supporting documents are required.',
  }))
    await visa.getByLabel(name, { exact: true }).fill(value);
  await visa.getByRole('button', { name: 'Create Visa draft' }).click();
  const visaCard = page.getByRole('article').filter({ hasText: visaName });
  await expect(visaCard).toContainText('DRAFT');
  await visaCard.getByRole('button', { name: 'Publish' }).click();
  await expect(visaCard).toContainText('PUBLISHED');

  await page.goto('/logout');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/marketplace?mode=tourism&market=India&destination=Turkey');
  await expect(
    page.getByRole('heading', { name: 'Tourism Packages' }),
  ).toBeVisible();
  const publicTourism = page
    .getByRole('article')
    .filter({ hasText: tourismName });
  await publicTourism.getByRole('link', { name: 'View Details' }).click();
  await expect(page.getByRole('heading', { name: tourismName })).toBeVisible();
  await page.goto('/marketplace?mode=visa&market=India&destination=Turkey');
  await expect(
    page.getByRole('heading', { name: 'Visa Services' }),
  ).toBeVisible();
  const publicVisa = page.getByRole('article').filter({ hasText: visaName });
  await expect(publicVisa.getByText(/never guaranteed/)).toBeVisible();
  await publicVisa.getByRole('link', { name: 'View Details' }).click();
  await expect(page.locator('.visa-disclaimer')).toBeVisible();
  await page.goto('/marketplace?mode=packages&market=India');
  await expect(page.getByText(/Umrah Journey/).first()).toBeVisible();
});

test.afterAll(async () => db.$disconnect());
