import { createHmac } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { connectTimeout: 1500, reconnectStrategy: false },
});
client.on('error', () => {});
let connecting: Promise<unknown> | undefined;
const policies: Record<string, [number, number]> = {
  '/login': [10, 900],
  '/register': [5, 3600],
  '/email/resend': [5, 3600],
  '/email/verify': [20, 900],
  '/password/forgot': [5, 3600],
  '/password/reset': [20, 900],
  '/mobile/request': [5, 3600],
  '/mobile/verify': [20, 900],
  '/mfa/setup': [10, 300],
  '/mfa/verify': [10, 300],
};
const script = `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n`;
function digest(value: string) {
  return createHmac(
    'sha256',
    Buffer.from(process.env.AUTH_ENCRYPTION_KEY!, 'hex'),
  )
    .update(value)
    .digest('hex');
}
async function increment(key: string, seconds: number): Promise<number> {
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  return Number(
    await client.eval(script, { keys: [key], arguments: [String(seconds)] }),
  );
}
export async function authLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const policy = policies[req.path];
  if (!policy || req.method !== 'POST') return next();
  const [limit, seconds] = policy;
  try {
    const ip = req.ip ?? 'unknown';
    const identities = [`ip:${ip}`];
    if (typeof req.body?.email === 'string')
      identities.push(`email:${req.body.email.trim().toLowerCase()}`);
    for (const identity of identities) {
      const count = await increment(
        `auth:${req.path}:${digest(identity)}`,
        seconds,
      );
      if (count > limit) {
        res.setHeader('Retry-After', String(seconds));
        res.status(429).json({ message: 'Too many requests' });
        return;
      }
    }
    next();
  } catch {
    res.status(503).json({ message: 'Authentication temporarily unavailable' });
  }
}
