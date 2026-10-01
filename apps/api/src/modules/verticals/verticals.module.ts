import { AuditService } from '../audit/audit.service.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VerticalsController } from './verticals.controller.js';
import { VerticalsService } from './verticals.service.js';
@Module({
  imports: [AuthModule],
  controllers: [VerticalsController],
  providers: [VerticalsService, AuditService],
  exports: [VerticalsService],
})
export class VerticalsModule {}
