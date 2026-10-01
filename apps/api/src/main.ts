import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import express from 'express';
import { sharedRateLimit } from './platform/security/rate-limit.js';
import { observeRequest } from './platform/telemetry/http.js';
import helmet from 'helmet';
import { collectDefaultMetrics } from 'prom-client';
import pino from 'pino';
import { AppModule } from './app.module.js';
import { authLimiter } from './platform/security/auth-limiter.js';
import { validateConfig } from './platform/config/validate.js';
import { startTelemetry } from './platform/telemetry/setup.js';
async function bootstrap() {
  validateConfig();
  startTelemetry();
  collectDefaultMetrics();
  const log = pino({ level: 'info' });
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
    bodyParser: false,
  });
  const uploadLimit = sharedRateLimit('uploads', 20);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // Only explicitly configured ingress networks may supply a forwarded client IP.
  if (process.env.TRUSTED_PROXY_CIDRS)
    app
      .getHttpAdapter()
      .getInstance()
      .set(
        'trust proxy',
        process.env.TRUSTED_PROXY_CIDRS.split(',').map((x) => x.trim()),
      );
  app.use(observeRequest);
  app.use(helmet());
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (
        /^\/(auth|admin|messages|applications|inventory)(\/|$)/.test(req.path)
      )
        res.setHeader('Cache-Control', 'private, no-store');
      next();
    },
  );
  app.use(
    sharedRateLimit('global', Number(process.env.GLOBAL_RATE_LIMIT_MAX ?? 120)),
  );
  app.use('/messages', sharedRateLimit('messages', 30));
  app.use(
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const type = req.headers['content-type']?.split(';')[0];
      if (
        type &&
        ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(
          type,
        )
      )
        return uploadLimit(req, res, next);
      next();
    },
  );
  app.use(
    '/applications/mine/documents',
    express.raw({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      limit: '5mb',
    }),
  );
  app.use(
    '/inventory/packages',
    express.raw({
      type: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'],
      limit: '5mb',
    }),
  );
  app.use(
    '/messages',
    express.raw({
      type: ['application/pdf', 'image/png', 'image/jpeg'],
      limit: '5mb',
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use('/auth', authLimiter);
  app.enableShutdownHooks();
  const server = await app.listen(
    Number(process.env.API_PORT ?? 3001),
    process.env.API_HOST ?? '127.0.0.1',
  );
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
  server.requestTimeout = 120000;
  log.info({ component: 'api' }, 'API listening');
}
void bootstrap();
