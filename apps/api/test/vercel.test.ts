import { afterEach, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const { dispatch, waitUntil } = vi.hoisted(() => ({
  dispatch: vi.fn(async () => 2),
  waitUntil: vi.fn(),
}));
vi.mock('../src/platform/vercel/outbox.js', () => ({
  dispatchOutbox: dispatch,
}));
vi.mock('@vercel/functions', () => ({ waitUntil }));
import { vercelMiddleware } from '../src/platform/vercel/middleware.js';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
function app() {
  const app = express();
  app.use(vercelMiddleware);
  app.post('/action', (_req, res) => res.json({ ok: true }));
  app.post('/denied', (_req, res) => res.status(403).end());
  return app;
}
it('preserves local routing and does not publish to Vercel locally', async () => {
  vi.stubEnv('DEPLOYMENT_MODE', '');
  await request(app()).post('/action').expect(200);
  expect(dispatch).not.toHaveBeenCalled();
});
it('publishes after a successful mutation but never after authorization failure', async () => {
  vi.stubEnv('DEPLOYMENT_MODE', 'vercel-services');
  await request(app()).post('/api/action').expect(200);
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(waitUntil).toHaveBeenCalledTimes(1);
  await request(app()).post('/api/denied').expect(403);
  expect(dispatch).toHaveBeenCalledTimes(1);
});
it('requires the recovery secret and rejects other methods', async () => {
  vi.stubEnv('DEPLOYMENT_MODE', 'vercel-services');
  vi.stubEnv('CRON_SECRET', 'synthetic-test-secret');
  await request(app()).get('/api/internal/outbox').expect(401);
  await request(app())
    .get('/api/internal/outbox')
    .set('Authorization', 'Bearer wrong')
    .expect(401);
  await request(app())
    .post('/api/internal/outbox')
    .set('Authorization', 'Bearer synthetic-test-secret')
    .expect(405);
  expect(dispatch).not.toHaveBeenCalled();
  await request(app())
    .get('/api/internal/outbox')
    .set('Authorization', 'Bearer synthetic-test-secret')
    .expect(200, { published: 2 });
});

it('trusts the platform IP header only inside the configured Vercel runtime', async () => {
  const { clientIp } = await import('../src/platform/security/client-ip.js');
  const req = {
    ip: '127.0.0.1',
    headers: { 'x-vercel-forwarded-for': '203.0.113.9' },
  } as unknown as import('express').Request;
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('DEPLOYMENT_MODE', 'vercel-services');
  expect(clientIp(req)).toBe('127.0.0.1');
  vi.stubEnv('VERCEL', '1');
  expect(clientIp(req)).toBe('203.0.113.9');
  req.headers['x-vercel-forwarded-for'] = 'invalid';
  expect(clientIp(req)).toBe('127.0.0.1');
});
