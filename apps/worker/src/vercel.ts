import { QueueClient } from '@vercel/queue';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { processNotificationLocked } from '@b2b/notifications/notification';

let db: PrismaClient | undefined;
const queue = new QueueClient();
export default queue.handleNodeCallback<{ intentId: string }>(
  async (message) => {
    if (
      !message ||
      typeof message.intentId !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(message.intentId)
    )
      return;
    if (
      !process.env.DATABASE_URL ||
      !/^[a-f0-9]{64}$/i.test(process.env.AUTH_ENCRYPTION_KEY ?? '')
    )
      throw new Error('Notification runtime is not configured');
    db ??= new PrismaClient({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL,
        max: 2,
        connectionTimeoutMillis: 3000,
        statement_timeout: 5000,
      }),
    });
    await processNotificationLocked(db, message.intentId);
  },
  { retry: () => ({ afterSeconds: 30 }) },
);
