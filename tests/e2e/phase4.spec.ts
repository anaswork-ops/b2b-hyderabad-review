import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from '../../apps/api/node_modules/argon2';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Phase 4 E2E requires disposable phase2_test database');
const db = getDatabase(),
  base = 'http://localhost:3000',
  password = 'Synthetic-Only-Password-123!';
test('approved business creates profile and publishes complete Umrah package', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const email = 'phase4-browser-' + randomUUID() + '@example.test',
    slug = 'phase4-' + randomUUID();
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
  await db.business.create({
    data: { primaryOwnerId: user.id, status: 'APPROVED' },
  });
  await page.goto(base + '/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(base + '/business');
  await page.getByRole('button', { name: 'Manage packages' }).click();
  await page.getByRole('button', { name: 'profile' }).click();
  await page.getByLabel('Public URL slug').fill(slug);
  await page.getByLabel('Trading name').fill('Synthetic Umrah Network');
  await page
    .getByLabel('Description')
    .fill(
      'Approved synthetic business offering complete Umrah travel services.',
    );
  await page.getByLabel('Country').fill('India');
  await page.getByLabel('State').fill('Telangana');
  await page.getByLabel('City').fill('Hyderabad');
  await page.getByLabel('Private network email').fill(email);
  await page.getByLabel('Private network phone').fill('+919900000002');
  await page.getByLabel('Years operating').fill('8');
  await page.getByLabel('Languages').fill('English, Urdu');
  await page.getByLabel('Markets served').fill('India');
  await page.getByLabel('Capabilities').fill('Umrah packages, Ground handling');
  await page.getByLabel('Service countries').fill('Saudi Arabia');
  await page.getByLabel('Service cities').fill('Makkah, Madinah');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  await page.getByRole('button', { name: 'packages', exact: true }).click();
  await page.getByLabel('Package name').fill('Browser Umrah 12 Nights');
  await page.getByLabel('Source market').fill('India');
  await page.getByLabel('Departure city').fill('Hyderabad');
  await page.getByLabel('Destination cities').fill('Makkah, Madinah');
  await page.getByLabel('Valid from').fill('2027-01-01');
  await page.getByLabel('Valid to').fill('2027-12-31');
  await page.getByLabel('Total nights').fill('12');
  await page.getByLabel('Makkah nights').fill('7');
  await page.getByLabel('Madinah nights').fill('5');
  await page.getByLabel('Accommodation').fill('Four star hotels');
  await page.getByLabel('Room occupancy').fill('Double, Triple');
  await page.getByLabel('Transport').fill('Private coach');
  await page.getByLabel('Meals').fill('Breakfast');
  await page.getByLabel('Visa status').fill('Included');
  await page.getByLabel('Ziyarat').fill('Makkah, Madinah');
  await page.getByLabel('Assistance').fill('Airport, 24/7');
  await page.getByLabel('Inclusions').fill('Hotels, Transfers, Visa');
  await page.getByLabel('Exclusions').fill('Personal expenses');
  await page.getByLabel('Price').fill('125000');
  await page.getByLabel('Currency').fill('INR');
  await page
    .getByLabel('Cancellation terms')
    .fill('Refund schedule applies before departure.');
  await page.getByLabel('Start', { exact: true }).fill('2027-01-01');
  await page.getByLabel('End', { exact: true }).fill('2027-12-31');
  await page.getByLabel('Capacity').fill('40');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  const card = page
    .locator('article')
    .filter({ hasText: 'Browser Umrah 12 Nights' });
  await card.getByRole('button', { name: 'Publish' }).click();
  await expect(card).toContainText('PUBLISHED');
  await page.goto(base + '/businesses/' + slug);
  await expect(
    page.getByRole('heading', { name: 'Synthetic Umrah Network' }),
  ).toBeVisible();
  await expect(page.getByText('Browser Umrah 12 Nights')).toBeVisible();
});
test.afterAll(async () => {
  await db.$disconnect();
});
