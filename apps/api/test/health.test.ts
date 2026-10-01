import { afterEach, expect, it } from 'vitest';
import { HealthService } from '../src/modules/health/health.service';
const original = {
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
};
afterEach(() => Object.assign(process.env, original));
it('reports degraded when critical dependencies are not configured', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.S3_ENDPOINT;
  expect(await new HealthService().check()).toEqual({
    status: 'degraded',
    services: { postgres: 'down', redis: 'down', storage: 'down' },
  });
});
