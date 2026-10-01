import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesPolicy } from '../businesses/businesses.policy.js';
import { NotificationService } from '../notifications/notification.service.js';
import { AuditService } from '../audit/audit.service.js';
import { FilesService } from '../files/files.service.js';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
@Module({
  imports: [AuthModule],
  controllers: [ApplicationsController],
  exports: [ApplicationsService, BusinessesPolicy],
  providers: [
    ApplicationsService,
    BusinessesPolicy,
    NotificationService,
    AuditService,
    FilesService,
  ],
})
export class ApplicationsModule {}
