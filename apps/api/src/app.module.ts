import { AdminModule } from './modules/admin/admin.module.js';
import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MarketplaceModule } from './modules/marketplace/marketplace.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { VerticalsModule } from './modules/verticals/verticals.module.js';
@Module({
  imports: [
    HealthModule,
    AdminModule,
    AuthModule,
    ApplicationsModule,
    InventoryModule,
    MarketplaceModule,
    MessagingModule,
    VerticalsModule,
  ],
})
export class AppModule {}
