import { isIP } from 'node:net';
export function validateConfig(env: NodeJS.ProcessEnv = process.env) {
  const stage = env.NODE_ENV ?? 'development';
  if (env.STORAGE_DRIVER && !['s3', 'vercel-blob'].includes(env.STORAGE_DRIVER))
    throw new Error('Invalid STORAGE_DRIVER');
  if (
    env.DEPLOYMENT_MODE === 'vercel-services' &&
    (env.CRON_SECRET?.length ?? 0) < 32
  )
    throw new Error('CRON_SECRET must have at least 32 characters');
  if (!['development', 'test', 'production'].includes(stage))
    throw new Error('Invalid NODE_ENV');
  for (const [name, protocols] of Object.entries({
    DATABASE_URL: ['postgres:', 'postgresql:'],
    REDIS_URL: ['redis:', 'rediss:'],
    ...(env.STORAGE_DRIVER === 'vercel-blob'
      ? {}
      : { S3_ENDPOINT: ['http:', 'https:'] }),
  })) {
    try {
      if (!protocols.includes(new URL(env[name] ?? '').protocol))
        throw new Error();
    } catch {
      throw new Error(`Invalid ${name}`);
    }
  }
  if (!/^[a-fA-F0-9]{64}$/.test(env.AUTH_ENCRYPTION_KEY ?? ''))
    throw new Error('AUTH_ENCRYPTION_KEY must be 32 bytes of hex');
  const limit = Number(env.GLOBAL_RATE_LIMIT_MAX ?? 120);
  if (!Number.isInteger(limit) || limit < 120 || limit > 10000)
    throw new Error('GLOBAL_RATE_LIMIT_MAX must be between 120 and 10000');
  if (stage === 'production') {
    let origin: URL;
    try {
      origin = new URL(env.WEB_ORIGIN ?? '');
    } catch {
      throw new Error('Invalid production WEB_ORIGIN');
    }
    if (
      origin.protocol !== 'https:' ||
      origin.origin !== env.WEB_ORIGIN ||
      origin.username ||
      origin.password
    )
      throw new Error('Production WEB_ORIGIN must be an HTTPS origin');
    if ((env.METRICS_TOKEN?.length ?? 0) < 32)
      throw new Error(
        'Production METRICS_TOKEN must have at least 32 characters',
      );
    if (env.STORAGE_DRIVER === 'vercel-blob') {
      if (!env.BLOB_STORE_ID && !env.BLOB_READ_WRITE_TOKEN)
        throw new Error('Missing Blob store configuration');
    } else
      for (const name of [
        'S3_BUCKET',
        'S3_REGION',
        'S3_ACCESS_KEY_ID',
        'S3_SECRET_ACCESS_KEY',
      ])
        if (!env[name]) throw new Error(`Missing ${name}`);
    if (/demo|test|_dev(?:$|_)/i.test(new URL(env.DATABASE_URL!).pathname))
      throw new Error('Production must use a dedicated non-demo database');
  }
  if (env.TRUSTED_PROXY_CIDRS && stage === 'production') {
    for (const entry of env.TRUSTED_PROXY_CIDRS.split(',')) {
      const [address, bits] = entry.trim().split('/');
      const family = isIP(address);
      if (
        !family ||
        (bits !== undefined &&
          (!/^\d+$/.test(bits) ||
            Number(bits) < 1 ||
            Number(bits) > (family === 4 ? 32 : 128)))
      )
        throw new Error(
          'Trusted proxies must be explicit IP addresses or bounded CIDRs',
        );
    }
  }
}
