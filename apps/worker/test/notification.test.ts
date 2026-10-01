import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCipheriv, randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { processNotification } from '../src/jobs/notification.js';
import { deliver, DeliveryError } from '../src/providers/delivery.js';
const key = randomBytes(32);
function fixture(channel = 'EMAIL') {
  vi.stubEnv('AUTH_ENCRYPTION_KEY', key.toString('hex'));
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update('APPROVED'), cipher.final()]);
  const intent = {
    id: 'fixture',
    recipientUserId: 'user',
    channel,
    kind: 'APPLICATION_APPROVED',
    attempts: 0,
    deliveryState: 'PENDING',
    payloadEncrypted: Buffer.concat([iv, cipher.getAuthTag(), data]).toString(
      'base64url',
    ),
    lastError: null,
  };
  const db = {
    notificationIntent: {
      findUnique: vi.fn(async () => ({ ...intent })),
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(intent, {
          ...data,
          attempts: data.attempts ? intent.attempts + 1 : intent.attempts,
        });
        return { count: 1 };
      }),
    },
    user: {
      findUnique: vi.fn(async () => ({
        email: 'test@example.test',
        mobile: '+910000000000',
        mobileVerifiedAt: new Date(),
      })),
    },
  };
  return { intent, db: db as unknown as PrismaClient };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('notification delivery guarantees', () => {
  it('does not resend a delivered intent', async () => {
    const { db, intent } = fixture(),
      send = vi.fn(async () => {});
    await processNotification(db, intent.id, send);
    await processNotification(db, intent.id, send);
    expect(send).toHaveBeenCalledTimes(1);
    expect(intent.deliveryState).toBe('DELIVERED');
  });
  it('retries outages at most three times and retains a safe terminal reason', async () => {
    const { db, intent } = fixture(),
      send = vi.fn(async () => {
        throw new DeliveryError('provider_unavailable', true);
      });
    await expect(processNotification(db, intent.id, send)).rejects.toThrow(
      'provider_unavailable',
    );
    await expect(processNotification(db, intent.id, send)).rejects.toThrow(
      'provider_unavailable',
    );
    await processNotification(db, intent.id, send);
    await processNotification(db, intent.id, send);
    expect(send).toHaveBeenCalledTimes(3);
    expect(intent.attempts).toBe(3);
    expect(intent.deliveryState).toBe('FAILED');
  });
  it('delivers in-app notifications without calling external providers', async () => {
    const { db, intent } = fixture('IN_APP'),
      send = vi.fn();
    await processNotification(db, intent.id, send);
    expect(send).not.toHaveBeenCalled();
    expect(intent.deliveryState).toBe('DELIVERED');
  });
  it('preserves configuration failures without retrying or disclosing credentials', async () => {
    vi.stubEnv('EMAIL_DELIVERY_URL', '');
    vi.stubEnv('EMAIL_DELIVERY_KEY', '');
    const { db, intent } = fixture();
    await processNotification(db, intent.id);
    expect(intent.deliveryState).toBe('FAILED');
    expect(intent.lastError).toBe('provider_not_configured');
  });
  it('sends a stable idempotency key and refuses redirects and provider body disclosure', async () => {
    vi.stubEnv('EMAIL_DELIVERY_URL', 'https://provider.example.test/send');
    vi.stubEnv('EMAIL_DELIVERY_KEY', 'private-test-value');
    const fetch = vi.fn(
      async () => new Response('secret echoed by provider', { status: 503 }),
    );
    vi.stubGlobal('fetch', fetch);
    await expect(
      deliver({
        id: 'stable-id',
        channel: 'EMAIL',
        recipient: 'test@example.test',
        subject: 'Test',
        text: 'Test',
      }),
    ).rejects.toThrow('provider_rejected');
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      headers: { 'Idempotency-Key': 'stable-id' },
    });
  });
});
