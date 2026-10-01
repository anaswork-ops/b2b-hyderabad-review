import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { VerticalsModule } from '../verticals/verticals.module.js';
import { MessagingModule } from '../messaging/messaging.module.js';
import { HealthModule } from '../health/health.module.js';
import { UsersService } from '../users/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notifications/notification.service.js';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
@Module({
  imports: [
    AuthModule,
    ApplicationsModule,
    InventoryModule,
    VerticalsModule,
    MessagingModule,
    HealthModule,
  ],
  providers: [AdminService, UsersService, AuditService, NotificationService],
  controllers: [AdminController],
})
export class AdminModule {}
