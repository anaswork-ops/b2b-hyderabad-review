import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';
import { ipKeyGenerator } from 'express-rate-limit';

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { connectTimeout: 1500, reconnectStrategy: false },
});
client.on('error', () => {});
let connecting: Promise<unknown> | undefined;
const script = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return {n, redis.call('TTL', KEYS[1])}`;
export function sharedRateLimit(scope: string, limit: number, seconds = 60) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (scope === 'global' && ['/health', '/metrics'].includes(req.path))
      return next();
    try {
      if (!client.isOpen) {
        connecting ??= client.connect().finally(() => {
          connecting = undefined;
        });
        await connecting;
      }
      const identity = createHmac(
        'sha256',
        Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex'),
      )
        .update(ipKeyGenerator(req.ip ?? 'unknown'))
        .digest('hex');
      const [count, ttl] = (await client.eval(script, {
        keys: [`limit:${scope}:${identity}`],
        arguments: [String(seconds)],
      })) as number[];
      if (count > limit) {
        res.setHeader('Retry-After', Math.max(ttl, 1));
        res.status(429).json({ message: 'Too many requests' });
        return;
      }
      next();
    } catch {
      res
        .status(503)
        .json({ message: 'Request protection temporarily unavailable' });
    }
  };
}
