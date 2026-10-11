import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { QueueClient } from '@vercel/queue';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { processNotificationLocked } from '@b2b/notifications/notification';

let db: PrismaClient | undefined;
const queue = new QueueClient();
const callback = queue.handleCallback<{ intentId: string }>(
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

// Services supplies raw Node HTTP streams, not Express request/response objects.
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : [])
      headers.append(name, item);
  }
  const request = new Request('https://queue.internal/', {
    method: req.method,
    headers,
    ...(req.method === 'POST'
      ? {
          body: Readable.toWeb(req) as ReadableStream<Uint8Array>,
          duplex: 'half',
        }
      : {}),
  });
  const response = await callback(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}
