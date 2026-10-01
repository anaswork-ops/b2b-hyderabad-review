import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/platform/config/validate.js';
const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://db/b2b_production',
  REDIS_URL: 'redis://redis',
  S3_ENDPOINT: 'https://storage.example.test',
  AUTH_ENCRYPTION_KEY: 'a'.repeat(64),
  WEB_ORIGIN: 'https://travel.example.test',
  METRICS_TOKEN: 'x'.repeat(32),
  S3_BUCKET: 'production',
  S3_REGION: 'region',
  S3_ACCESS_KEY_ID: 'fixture',
  S3_SECRET_ACCESS_KEY: 'fixture',
};
describe('production configuration', () => {
  it('accepts dedicated configuration and rejects unsafe origins, proxies and demo targets', () => {
    expect(() => validateConfig(valid)).not.toThrow();
    for (const change of [
      { WEB_ORIGIN: 'https://travel.example.test/path' },
      { TRUSTED_PROXY_CIDRS: '0.0.0.0/0' },
      { DATABASE_URL: 'postgresql://db/b2btravelv2_phase6_demo' },
      { METRICS_TOKEN: '' },
      { DATABASE_URL: 'https://secret:password@host' },
    ])
      expect(() => validateConfig({ ...valid, ...change })).toThrow();
  });
});
