import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UsersService } from '../users/users.service.js';
import { BusinessesPolicy } from '../businesses/businesses.policy.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationService } from '../notifications/notification.service.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersService,
    BusinessesPolicy,
    AuditService,
    NotificationService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
