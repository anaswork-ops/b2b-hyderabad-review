import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from '../../apps/api/node_modules/argon2';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
import { decrypt, totp } from '../../apps/api/src/modules/auth/crypto';
import { createClient } from '../../apps/api/node_modules/redis';
process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Phase 3 E2E requires disposable phase2_test database');
const db = getDatabase();
const base = 'http://localhost:3000';
const password = 'Synthetic-Only-Password-123!';
test.beforeAll(async () => {
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.sendCommand([
    'EVAL',
    "local k=redis.call('keys','auth:*'); if #k>0 then return redis.call('del',unpack(k)) end return 0",
    '0',
  ]);
  await redis.quit();
});
const email = () => `phase3-browser-${randomUUID()}@example.test`;
async function tokenFor(address: string, kind: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email: address } });
  const intent = await db.notificationIntent.findFirstOrThrow({
    where: { recipientUserId: user.id, kind },
    orderBy: { createdAt: 'desc' },
  });
  return decrypt(intent.payloadEncrypted);
}
test('Applicant correction and Admin approval browser journey', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const address = email();
  const businessName = `Synthetic Browser ${randomUUID()}`;
  const mobile =
    '+91' + String(Math.floor(1_000_000_000 + Math.random() * 9_000_000_000));
  await page.goto(`${base}/register`);
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(
    `${base}/verify-email#token=${encodeURIComponent(await tokenFor(address, 'EMAIL_VERIFICATION'))}`,
  );
  await page.getByRole('button', { name: 'Verify your email' }).click();
  await expect(page.getByRole('status')).toContainText('Email verified');
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(address);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/apply`);
  await page.getByLabel('Legal business name').fill(businessName);
  await page.getByLabel('Trading name').fill('Synthetic Browser');
  await page.getByLabel('Business email').fill(address);
  await page.getByLabel('Registered mobile').fill(mobile);
  await page.getByLabel('Business type').selectOption('TRAVEL_AGENCY');
  await page.getByRole('button', { name: 'Verify mobile' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Mobile verification queued',
  );
  await page
    .getByLabel('Mobile verification code')
    .fill(await tokenFor(address, 'MOBILE_VERIFICATION'));
  await page.getByRole('button', { name: 'Confirm code' }).click();
  await expect(page.getByRole('status')).toContainText('Mobile verified');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByLabel('Registered address').fill('Synthetic address');
  await page.getByLabel('Business country').fill('India');
  await page.getByLabel('State or region').fill('Telangana');
  await page.getByLabel('City').fill('Hyderabad');
  await page.getByLabel('Registration or licence number').fill('SYNTHETIC-1');
  await page.getByLabel('Licence issuer').fill('Synthetic issuer');
  await page.getByLabel('Years operating').fill('3');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.getByLabel('Hajj & Umrah capabilities').fill('Umrah');
  await page.getByLabel('Source markets').fill('India');
  await page.getByLabel('Saudi service destinations').fill('Makkah');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\nSynthetic document'),
  });
  await expect(page.getByRole('status')).toContainText('Document uploaded');
  await page.getByRole('button', { name: 'Preview and validate' }).click();
  await expect(page.getByText('Missing items: None')).toBeVisible();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await expect(page.getByRole('status')).toContainText('submitted for review');
  const applicant = await db.user.findUniqueOrThrow({
    where: { email: address },
  });
  const application = await db.businessApplication.findUniqueOrThrow({
    where: { ownerId: applicant.id },
  });
  const adminEmail = email();
  await db.user.create({
    data: {
      email: adminEmail,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
  });
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto(`${base}/login`);
  await admin.getByLabel('Email').fill(adminEmail);
  await admin.getByLabel('Password').fill(password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin).toHaveURL(`${base}/mfa`, { timeout: 15_000 });
  await admin.getByRole('button', { name: 'Set up authenticator' }).click();
  await expect(admin.getByText('Enter this setup secret')).toBeVisible();
  const staff = await db.user.findUniqueOrThrow({
    where: { email: adminEmail },
  });
  await admin
    .getByLabel('Six-digit code')
    .fill(totp(decrypt(staff.mfaSecretEncrypted!)));
  await admin.getByRole('button', { name: 'Authenticator code' }).click();
  await expect(admin).toHaveURL(`${base}/admin`, { timeout: 15_000 });
  await admin
    .getByRole('button', { name: 'Applications', exact: true })
    .click();
  await admin
    .getByRole('button', { name: `${businessName} — SUBMITTED` })
    .click();
  await expect(admin.getByText('SYNTHETIC-1')).toBeVisible();
  await admin
    .getByLabel('Internal note or information request')
    .fill('Clarify source market');
  await admin.getByRole('button', { name: 'REQUEST INFORMATION' }).click();
  await expect(admin.getByRole('status')).toContainText('REQUEST_INFORMATION');
  await page.reload();
  await expect(page.getByText('Clarify source market')).toBeVisible();
  await page.getByRole('button', { name: '3. Hajj & Umrah activity' }).click();
  await page.getByLabel('Source markets').fill('India, UAE');
  await page.getByRole('button', { name: '4. Documents & preview' }).click();
  await page.getByRole('button', { name: 'Preview and validate' }).click();
  await page.getByRole('button', { name: 'Submit application' }).click();
  await admin.reload();
  await admin
    .getByRole('button', { name: 'Applications', exact: true })
    .click();
  await admin
    .getByRole('button', { name: `${businessName} — SUBMITTED` })
    .click();
  await admin.getByRole('button', { name: 'APPROVE', exact: true }).click();
  await expect(admin.getByRole('status')).toContainText('APPROVE');
  expect(
    (
      await db.business.findUniqueOrThrow({
        where: { id: application.businessId },
      })
    ).status,
  ).toBe('APPROVED');
  await page.goto(`${base}/business`);
  await expect(page).toHaveURL(`${base}/business`);
  await adminContext.close();
});
