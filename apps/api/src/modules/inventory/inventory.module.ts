import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuditService } from '../audit/audit.service.js';
import { BusinessProfilesController } from '../businesses/business-profiles.controller.js';
import { BusinessProfilesService } from '../businesses/business-profiles.service.js';
import { FilesService } from '../files/files.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BusinessProfilesController, InventoryController],
  exports: [InventoryService],
  providers: [
    BusinessProfilesService,
    InventoryService,
    AuditService,
    FilesService,
  ],
})
export class InventoryModule {}
