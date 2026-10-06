import { QueueClient } from '@vercel/queue';
import { getDatabase } from '../db/prisma.js';

// Only IDs leave the transactional outbox; recipients and encrypted payloads
// remain in PostgreSQL. A failed publish never removes the pending intent.
export async function dispatchOutbox() {
  const pending = await getDatabase().notificationIntent.findMany({
    where: { deliveryState: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
    take: 100,
  });
  const queue = new QueueClient();
  for (let index = 0; index < pending.length; index += 10) {
    await Promise.all(
      pending.slice(index, index + 10).map(({ id }) =>
        queue.send(
          'notifications',
          { intentId: id },
          {
            idempotencyKey: id,
            retentionSeconds: 86400,
          },
        ),
      ),
    );
  }
  return pending.length;
}
