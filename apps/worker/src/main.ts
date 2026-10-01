import { Queue, Worker } from 'bullmq';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Redis } from 'ioredis';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { startTelemetry } from './telemetry.js';
import { processNotification } from './jobs/notification.js';

type DeliveryJob = { intentId: string };
async function main() {
  if (!process.env.REDIS_URL || !process.env.DATABASE_URL)
    throw new Error('Worker requires REDIS_URL and DATABASE_URL');
  if (!/^[a-fA-F0-9]{64}$/.test(process.env.AUTH_ENCRYPTION_KEY ?? ''))
    throw new Error('Worker requires a valid encryption key');
  startTelemetry();
  const log = pino();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const queue = new Queue<DeliveryJob>('notifications', {
    connection: new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    }),
  });
  const worker = new Worker<DeliveryJob>(
    'notifications',
    (job) =>
      trace
        .getTracer('b2b-worker')
        .startActiveSpan('notification.process', async (span) => {
          span.setAttribute('notification.id', job.data.intentId);
          try {
            await processNotification(db, job.data.intentId);
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw error;
          } finally {
            span.end();
          }
        }),
    {
      connection: new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
      }),
      concurrency: 4,
    },
  );
  worker.on('failed', (job) => {
    if (!job) return;
    log.warn(
      { intentId: job.data.intentId, attempts: job.attemptsMade },
      'Notification job failed',
    );
    if (job.attemptsMade >= 3)
      void db.notificationIntent
        .updateMany({
          where: { id: job.data.intentId, deliveryState: 'PENDING' },
          data: {
            deliveryState: 'FAILED',
            lastError: 'processor_failed',
            attempts: job.attemptsMade,
          },
        })
        .catch(() => undefined);
  });
  let dispatching = false;
  const dispatch = async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      const pending = await db.notificationIntent.findMany({
        where: { deliveryState: 'PENDING' },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      for (const intent of pending)
        await queue.add(
          'deliver',
          { intentId: intent.id },
          {
            jobId: intent.id,
            attempts: 3,
            backoff: { type: 'exponential', delay: 1000 },
            removeOnComplete: true,
          },
        );
    } catch {
      log.warn('Notification dispatch delayed');
    } finally {
      dispatching = false;
    }
  };
  await queue.waitUntilReady();
  await worker.waitUntilReady();
  await dispatch();
  const timer = setInterval(() => void dispatch(), 3000);
  log.info({ component: 'worker' }, 'Notification worker connected');
  const close = async () => {
    clearInterval(timer);
    await worker.close();
    await queue.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
void main();
