import { isIP } from 'node:net';
import type { Request } from 'express';
export function clientIp(req: Request) {
  // Vercel overwrites this header at its ingress. Never trust it locally.
  if (
    process.env.VERCEL === '1' &&
    process.env.DEPLOYMENT_MODE === 'vercel-services'
  ) {
    const value = req.headers['x-vercel-forwarded-for'];
    if (typeof value === 'string' && isIP(value)) return value;
  }
  return req.ip ?? 'unknown';
}
