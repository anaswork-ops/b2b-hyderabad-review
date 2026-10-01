import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import argon2 from '../../apps/api/node_modules/argon2';
import { getDatabase } from '../../apps/api/src/platform/db/prisma';
import { decrypt, totp } from '../../apps/api/src/modules/auth/crypto';
import { createClient } from '../../apps/api/node_modules/redis';

process.loadEnvFile('.env');
if (!process.env.DATABASE_URL?.includes('phase2_test'))
  throw new Error('Phase 2 E2E requires disposable phase2_test database');
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
const address = () => `browser-${randomUUID()}@example.test`;
async function linkFor(email: string, kind: string, path: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const intent = await db.notificationIntent.findFirstOrThrow({
    where: { recipientUserId: user.id, kind },
    orderBy: { createdAt: 'desc' },
  });
  return `${base}/${path}#token=${encodeURIComponent(decrypt(intent.payloadEncrypted))}`;
}

test('business identity browser journey and recovery', async ({ page }) => {
  const email = address();
  await page.goto(`${base}/register`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create an account' }).click();
  await expect(page.getByRole('status')).toContainText('Check your email');
  await page.goto(await linkFor(email, 'EMAIL_VERIFICATION', 'verify-email'));
  await page.getByRole('button', { name: 'Verify your email' }).click();
  await expect(page.getByRole('status')).toContainText('Email verified');
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/apply`);
  await expect(page.getByText(email)).toBeVisible();
  await page.getByRole('link', { name: 'Sign out' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(`${base}/login`);
  await page.goto(`${base}/forgot-password`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Reset your password' }).click();
  await expect(page.getByRole('status')).toContainText(
    'If this account exists',
  );
  await page.goto(await linkFor(email, 'PASSWORD_RESET', 'reset-password'));
  await page.getByLabel('Password').fill('New-Synthetic-Password-123!');
  await page.getByRole('button', { name: 'Choose a new password' }).click();
  await expect(page.getByRole('status')).toContainText('Password updated');
});

test('Admin MFA browser journey', async ({ page }) => {
  const email = address();
  await db.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      emailVerifiedAt: new Date(),
      role: 'ADMIN',
    },
  });
  await page.goto(`${base}/admin`);
  await expect(page).toHaveURL(`${base}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${base}/mfa`);
  await page.getByRole('button', { name: 'Set up authenticator' }).click();
  await expect(page.getByText('Enter this setup secret')).toBeVisible();
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  await page
    .getByLabel('Six-digit code')
    .fill(totp(decrypt(user.mfaSecretEncrypted!)));
  await page.getByRole('button', { name: 'Authenticator code' }).click();
  await expect(page).toHaveURL(`${base}/admin`);
  await expect(
    page.getByRole('heading', { name: 'Admin Console' }),
  ).toBeVisible();
});
