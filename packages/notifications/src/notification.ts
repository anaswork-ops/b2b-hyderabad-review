import { createDecipheriv, createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { deliver, DeliveryError, type Delivery } from './delivery.js';

function decrypt(value: string) {
  const bytes = Buffer.from(value, 'base64url');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex'),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString('utf8');
}

export async function processNotification(
  db: Pick<
    Prisma.TransactionClient,
    'notificationIntent' | 'user' | 'identityToken'
  >,
  id: string,
  send: (message: Delivery) => Promise<void> = deliver,
) {
  const intent = await db.notificationIntent.findUnique({ where: { id } });
  if (!intent || intent.deliveryState !== 'PENDING') return;
  const update = (data: {
    deliveryState?: string;
    lastError?: string | null;
    deliveredAt?: Date;
  }) =>
    db.notificationIntent.updateMany({
      where: { id, deliveryState: 'PENDING' },
      data,
    });
  if (intent.attempts >= 3) {
    await update({ deliveryState: 'FAILED', lastError: 'attempts_exhausted' });
    return;
  }
  await db.notificationIntent.updateMany({
    where: { id, deliveryState: 'PENDING' },
    data: { attempts: { increment: 1 } },
  });
  try {
    if (intent.channel !== 'IN_APP') {
      if (!['EMAIL', 'MOBILE'].includes(intent.channel))
        throw new DeliveryError('unsupported_channel', false);
      const user = await db.user.findUnique({
        where: { id: intent.recipientUserId },
        select: { email: true, mobile: true, mobileVerifiedAt: true },
      });
      const recipient = intent.channel === 'EMAIL' ? user?.email : user?.mobile;
      if (!recipient) throw new DeliveryError('recipient_unavailable', false);
      const payload = decrypt(intent.payloadEncrypted);
      let text: string;
      if (
        [
          'EMAIL_VERIFICATION',
          'PASSWORD_RESET',
          'MOBILE_VERIFICATION',
        ].includes(intent.kind)
      ) {
        const token = await db.identityToken.findUnique({
          where: {
            tokenHash: createHash('sha256').update(payload).digest('hex'),
          },
        });
        if (
          !token ||
          token.userId !== intent.recipientUserId ||
          token.purpose !== intent.kind ||
          token.consumedAt ||
          token.expiresAt <= new Date()
        )
          throw new DeliveryError('token_expired_or_consumed', false);
        const origin = new URL(
          process.env.WEB_ORIGIN ?? 'http://localhost:3000',
        ).origin;
        text =
          intent.kind === 'MOBILE_VERIFICATION'
            ? `B2B Hyderabad mobile verification code: ${payload}. Valid for 15 minutes. Do not share this code.`
            : `B2B Hyderabad: ${origin}/${intent.kind === 'PASSWORD_RESET' ? 'reset-password' : 'verify-email'}#token=${encodeURIComponent(payload)}`;
      } else if (intent.kind.startsWith('APPLICATION_')) {
        if (intent.channel === 'MOBILE' && !user?.mobileVerifiedAt)
          throw new DeliveryError('mobile_not_verified', false);
        text = `Your B2B Hyderabad application status is ${payload.replaceAll('_', ' ')}. Sign in to view the details.`;
      } else throw new DeliveryError('unsupported_notification', false);
      await send({
        id,
        channel: intent.channel,
        recipient,
        subject: 'B2B Hyderabad notification',
        text,
      });
    }
    await update({
      deliveryState: 'DELIVERED',
      deliveredAt: new Date(),
      lastError: null,
    });
  } catch (error) {
    const failure =
      error instanceof DeliveryError
        ? error
        : new DeliveryError('processor_failed', false);
    const terminal = !failure.retryable || intent.attempts + 1 >= 3;
    await update({
      lastError: failure.code,
      ...(terminal ? { deliveryState: 'FAILED' } : {}),
    });
    if (!terminal) throw failure;
  }
}

// A transaction-scoped lock works with pooled PostgreSQL and survives neither
// a crashed function nor a disconnected client. Provider idempotency covers the
// remaining crash window between external delivery and the database commit.
export async function processNotificationLocked(
  db: PrismaClient,
  id: string,
  send: (message: Delivery) => Promise<void> = deliver,
) {
  const failure = await db.$transaction(
    async (tx) => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtextextended(${id}, 0)) AS acquired`;
      if (!lock?.acquired) throw new Error('notification_busy');
      try {
        await processNotification(tx, id, send);
        return undefined;
      } catch (error) {
        // Commit the failed attempt before asking the queue to retry.
        return error;
      }
    },
    { timeout: 20000, maxWait: 3000 },
  );
  if (failure) throw failure;
}
