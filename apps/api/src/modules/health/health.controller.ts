import {
  Controller,
  Get,
  Header,
  Headers,
  UnauthorizedException,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { register, Gauge } from 'prom-client';
import { NotificationService } from '../notifications/notification.service.js';
const dependencies = new Gauge({
  name: 'b2b_dependency_up',
  help: 'Critical dependency readiness',
  labelNames: ['dependency'],
});
const queue = new Gauge({
  name: 'b2b_queue_jobs',
  help: 'Queue workers and job counts',
  labelNames: ['state'],
});
const delivery = new Gauge({
  name: 'b2b_notification_intents',
  help: 'Durable notification states',
  labelNames: ['state'],
});
import { timingSafeEqual } from 'node:crypto';
import { HealthService } from './health.service.js';
@Controller()
export class HealthController {
  constructor(
    @Inject(HealthService) private readonly health: HealthService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
  ) {}
  @Get('health')
  async check() {
    const state = await this.health.check();
    if (state.status !== 'ok') throw new ServiceUnavailableException(state);
    return state;
  }
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(@Headers('authorization') authorization?: string) {
    const secret = process.env.METRICS_TOKEN;
    if (secret) {
      const expected = Buffer.from(`Bearer ${secret}`),
        actual = Buffer.from(authorization ?? '');
      if (
        expected.length !== actual.length ||
        !timingSafeEqual(expected, actual)
      )
        throw new UnauthorizedException();
    }
    const [ready, jobs, intents] = await Promise.all([
      this.health.check(),
      this.health.jobs(),
      this.notifications.adminHealth().catch(() => null),
    ]);
    for (const [dependency, status] of Object.entries(ready.services))
      dependencies.set({ dependency }, status === 'up' ? 1 : 0);
    for (const state of ['workers', 'waiting', 'active', 'failed', 'delayed'])
      queue.set(
        { state },
        Number((jobs as Record<string, unknown>)[state] ?? 0),
      );
    if (intents)
      for (const [state, count] of Object.entries(intents))
        delivery.set({ state }, count);
    return register.metrics();
  }
}
