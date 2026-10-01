import { Module } from '@nestjs/common';
import { NotificationService } from '../notifications/notification.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';
@Module({
  controllers: [HealthController],
  providers: [HealthService, NotificationService],
  exports: [HealthService],
})
export class HealthModule {}
