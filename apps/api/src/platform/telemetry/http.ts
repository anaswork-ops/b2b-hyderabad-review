import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Histogram, Counter } from 'prom-client';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import pino from 'pino';

const latency = new Histogram({
  name: 'b2b_http_duration_seconds',
  help: 'API response latency',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
const responses = new Counter({
  name: 'b2b_http_responses_total',
  help: 'API responses',
  labelNames: ['method', 'route', 'status'],
});
const log = pino();
const tracer = trace.getTracer('b2b-api');
export function observeRequest(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.path === '/metrics' || req.path === '/health') return next();
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  const started = performance.now();
  tracer.startActiveSpan('http.request', (span) => {
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      // Express route templates contain no record IDs, query strings or recovery tokens.
      const route =
        typeof req.route?.path === 'string' ? req.route.path : 'unmatched';
      const method = [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
        'HEAD',
      ].includes(req.method)
        ? req.method
        : 'OTHER';
      const status = res.writableFinished ? String(res.statusCode) : '499';
      const seconds = (performance.now() - started) / 1000;
      const labels = { method, route, status };
      latency.observe(labels, seconds);
      responses.inc(labels);
      span.updateName(`${method} ${route}`);
      span.setAttributes({
        'http.request.method': method,
        'http.route': route,
        'http.response.status_code': Number(status),
        'request.id': requestId,
      });
      if (Number(status) >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
      log.info(
        { requestId, ...labels, durationMs: Math.round(seconds * 1000) },
        'HTTP response',
      );
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  });
}
