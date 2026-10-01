ALTER TABLE "packages" ADD COLUMN "moderation_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "services" ADD COLUMN "moderation_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "offers" ADD COLUMN "moderation_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tourism_packages" ADD COLUMN "moderation_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "visa_services" ADD COLUMN "moderation_hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "audit_events" ADD COLUMN "resource_id" UUID, ADD COLUMN "reason" VARCHAR(2000);
CREATE INDEX "audit_events_resource_id_created_at_idx" ON "audit_events"("resource_id", "created_at");
