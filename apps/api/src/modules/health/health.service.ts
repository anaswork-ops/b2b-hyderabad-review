import { Injectable } from '@nestjs/common';
import { FilesService } from '../files/files.service.js';
import { createClient } from 'redis';
import { probeDatabase } from '../../platform/db/prisma.js';
@Injectable()
export class HealthService {
  private readonly files = new FilesService();
  async check() {
    const services: Record<string, 'up' | 'down'> = {
      postgres: 'down',
      redis: 'down',
      storage: 'down',
    };
    if (await probeDatabase()) services.postgres = 'up';
    if (process.env.REDIS_URL) {
      const redis = createClient({
        url: process.env.REDIS_URL,
        socket: { connectTimeout: 1500, reconnectStrategy: false },
      });
      redis.on('error', () => {});
      try {
        await redis.connect();
        await redis.ping();
        services.redis = 'up';
      } catch {
      } finally {
        if (redis.isOpen) await redis.quit();
      }
    }
    if (await this.files.healthy()) services.storage = 'up';
    return {
      status: Object.values(services).every((value) => value === 'up')
        ? 'ok'
        : 'degraded',
      services,
    };
  }

  async jobs() {
    if (process.env.DEPLOYMENT_MODE === 'vercel-services')
      return { status: 'managed', provider: 'vercel-queues', workers: 0 };
    if (!process.env.REDIS_URL) return { status: 'unavailable', workers: 0 };
    const { Queue } = await import('bullmq');
    const url = new URL(process.env.REDIS_URL);
    const queue = new Queue('notifications', {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
        db: Number(url.pathname.slice(1) || 0),
        connectTimeout: 1500,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      },
    });
    queue.on('error', () => {});
    try {
      const workers = await queue.getWorkersCount();
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'failed',
        'delayed',
      );
      return { status: workers ? 'up' : 'degraded', workers, ...counts };
    } catch {
      return { status: 'unavailable', workers: 0 };
    } finally {
      await queue.close().catch(() => undefined);
    }
  }
}
