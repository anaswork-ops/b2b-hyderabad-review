import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditService } from '../audit/audit.service.js';
import { FilesService } from '../files/files.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingService } from './messaging.service.js';
@Module({
  imports: [AuthModule],
  controllers: [MessagingController],
  exports: [MessagingService],
  providers: [
    MessagingService,
    AuditService,
    FilesService,
    NotificationService,
  ],
})
export class MessagingModule {}
