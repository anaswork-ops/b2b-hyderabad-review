import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { waitUntil } from '@vercel/functions';
import { FilesService } from '../../modules/files/files.service.js';
import { dispatchOutbox } from './outbox.js';

export function vercelMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.DEPLOYMENT_MODE !== 'vercel-services') return next();
  req.url = req.url.replace(/^\/api(?=\/|\?|$)/, '') || '/';
  if (req.path === '/internal/outbox') {
    const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ''}`);
    const actual = Buffer.from(req.headers.authorization ?? '');
    if (
      !process.env.CRON_SECRET ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      res.status(401).end();
      return;
    }
    if (req.method !== 'GET') {
      res.status(405).end();
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    void Promise.all([
      dispatchOutbox(),
      new FilesService().cleanupTemporary(),
    ]).then(
      ([published]) => res.json({ published }),
      () => res.status(503).json({ error: 'Notification dispatch delayed' }),
    );
    return;
  }
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    const finished = new Promise<boolean>((resolve) => {
      res.once('finish', () => resolve(res.statusCode < 400));
      res.once('close', () => resolve(false));
    });
    waitUntil(
      finished
        .then(async (success) => {
          if (success) await dispatchOutbox();
        })
        .catch(() => {
          console.warn('Notification dispatch delayed; outbox retained');
        }),
    );
  }
  next();
}
