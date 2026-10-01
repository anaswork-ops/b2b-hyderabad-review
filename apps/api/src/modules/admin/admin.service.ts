import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminQuery, ListingKind } from '@b2b/validation/admin';
import type { User } from '@prisma/client';
import { ApplicationsService } from '../applications/applications.service.js';
import { BusinessesPolicy } from '../businesses/businesses.policy.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { VerticalsService } from '../verticals/verticals.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersService } from '../users/users.service.js';
import { HealthService } from '../health/health.service.js';
import { NotificationService } from '../notifications/notification.service.js';
@Injectable()
export class AdminService {
  constructor(
    @Inject(ApplicationsService) readonly applications: ApplicationsService,
    @Inject(BusinessesPolicy) readonly businesses: BusinessesPolicy,
    @Inject(InventoryService) private readonly inventory: InventoryService,
    @Inject(VerticalsService) private readonly verticals: VerticalsService,
    @Inject(MessagingService) readonly messaging: MessagingService,
    @Inject(AuditService) readonly audit: AuditService,
    @Inject(UsersService) readonly users: UsersService,
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
  ) {}
  async health() {
    const [dependencies, jobs, notifications, messaging] =
      await Promise.allSettled([
        this.healthService.check(),
        this.healthService.jobs(),
        this.notifications.adminHealth(),
        this.messaging.adminHealth(),
      ]);
    return {
      api: 'up',
      dependencies:
        dependencies.status === 'fulfilled'
          ? dependencies.value
          : { status: 'unavailable' },
      jobs:
        jobs.status === 'fulfilled' ? jobs.value : { status: 'unavailable' },
      notifications:
        notifications.status === 'fulfilled'
          ? notifications.value
          : { status: 'unavailable' },
      messaging:
        messaging.status === 'fulfilled'
          ? messaging.value
          : { status: 'unavailable' },
    };
  }
  async dashboard() {
    const [applications, businesses, inventory, verticals, health] =
      await Promise.all([
        this.applications.adminCounts(),
        this.businesses.adminCounts(),
        this.inventory.adminCounts(),
        this.verticals.adminCounts(),
        this.health(),
      ]);
    return {
      applications,
      businesses,
      inventory: { ...inventory, ...verticals },
      health,
    };
  }
  listings(kind: ListingKind, q: AdminQuery) {
    return kind === 'tourism' || kind === 'visa'
      ? this.verticals.adminList(kind, q)
      : this.inventory.adminList(kind, q);
  }
  listing(kind: ListingKind, id: string) {
    return kind === 'tourism' || kind === 'visa'
      ? this.verticals.adminDetail(kind, id)
      : this.inventory.adminDetail(kind, id);
  }
  moderate(
    user: User,
    kind: ListingKind,
    id: string,
    hidden: boolean,
    reason: string,
  ) {
    return kind === 'tourism' || kind === 'visa'
      ? this.verticals.moderate(user, kind, id, hidden, reason)
      : this.inventory.moderate(user, kind, id, hidden, reason);
  }
  async business(id: string) {
    const item = await this.businesses.adminDetail(id);
    if (!item) throw new NotFoundException('Business not found');
    const securityHistory = await this.audit.query({
      page: 1,
      q: '',
      actorId: item.primaryOwnerId,
    });
    return { ...item, securityHistory: securityHistory.items };
  }
}
