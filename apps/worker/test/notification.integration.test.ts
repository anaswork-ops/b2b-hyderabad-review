import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomBytes, randomUUID, createCipheriv } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { processNotification } from '../src/jobs/notification.js';
if (
  new URL(process.env.DATABASE_URL ?? 'http://invalid').pathname !==
  '/b2btravelv2_phase2_test_phase7_20260930'
)
  throw new Error('Dedicated isolated integration database required');
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
let calls = 0;
const keys: string[] = [];
const server = createServer((req, res) => {
  req.resume();
  calls++;
  keys.push(String(req.headers['idempotency-key']));
  res.writeHead(calls === 1 ? 503 : 202).end();
});
beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Listener missing');
  process.env.EMAIL_DELIVERY_URL = `http://127.0.0.1:${address.port}/deliver`;
  process.env.EMAIL_DELIVERY_KEY = 'synthetic-local-gateway';
});
afterAll(async () => {
  await db.$disconnect();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
it('persists retries and delivers once through a real HTTP gateway after recovery', async () => {
  const user = await db.user.create({
    data: {
      email: `worker-${randomUUID()}@example.test`,
      passwordHash: 'non-login fixture',
    },
  });
  const iv = randomBytes(12),
    cipher = createCipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex'),
      iv,
    );
  const payload = Buffer.concat([cipher.update('APPROVED'), cipher.final()]);
  const intent = await db.notificationIntent.create({
    data: {
      recipientUserId: user.id,
      kind: 'APPLICATION_APPROVED',
      channel: 'EMAIL',
      payloadEncrypted: Buffer.concat([
        iv,
        cipher.getAuthTag(),
        payload,
      ]).toString('base64url'),
    },
  });
  await expect(processNotification(db, intent.id)).rejects.toThrow(
    'provider_rejected',
  );
  expect(
    await db.notificationIntent.findUnique({ where: { id: intent.id } }),
  ).toMatchObject({
    deliveryState: 'PENDING',
    attempts: 1,
    lastError: 'provider_rejected',
  });
  await processNotification(db, intent.id);
  await processNotification(db, intent.id);
  expect(
    await db.notificationIntent.findUnique({ where: { id: intent.id } }),
  ).toMatchObject({ deliveryState: 'DELIVERED', attempts: 2, lastError: null });
  expect(calls).toBe(2);
  expect(keys).toEqual([intent.id, intent.id]);
}, 15000);
