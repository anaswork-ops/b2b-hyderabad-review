-- CreateEnum
CREATE TYPE "ConversationContextType" AS ENUM ('BUSINESS', 'PACKAGE', 'SERVICE', 'OFFER', 'CUSTOM_REQUEST');

-- CreateEnum
CREATE TYPE "CustomRequestStatus" AS ENUM ('OPEN', 'RESPONDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'DISMISSED');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "context_type" "ConversationContextType" NOT NULL,
    "context_business_id" UUID,
    "context_package_id" UUID,
    "context_service_id" UUID,
    "context_offer_id" UUID,
    "custom_request_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_message_at" TIMESTAMP(3),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "conversation_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "last_read_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("conversation_id","business_id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_business_id" UUID NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_attachments" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "filename" VARCHAR(120) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_blocks" (
    "blocker_business_id" UUID NOT NULL,
    "blocked_business_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_blocks_pkey" PRIMARY KEY ("blocker_business_id","blocked_business_id")
);

-- CreateTable
CREATE TABLE "conversation_reports" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "reporter_business_id" UUID NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_package_requests" (
    "id" UUID NOT NULL,
    "requester_business_id" UUID NOT NULL,
    "provider_business_id" UUID NOT NULL,
    "subtype" "PilgrimageSubtype" NOT NULL,
    "departure_city" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "group_size" INTEGER NOT NULL,
    "total_nights" INTEGER NOT NULL,
    "makkah_nights" INTEGER NOT NULL,
    "madinah_nights" INTEGER NOT NULL,
    "requirements" VARCHAR(4000) NOT NULL,
    "status" "CustomRequestStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_package_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_custom_request_id_key" ON "conversations"("custom_request_id");

-- CreateIndex
CREATE INDEX "conversations_last_message_at_created_at_idx" ON "conversations"("last_message_at", "created_at");

-- CreateIndex
CREATE INDEX "conversation_participants_business_id_last_read_at_idx" ON "conversation_participants"("business_id", "last_read_at");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "message_attachments_storage_key_key" ON "message_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "message_attachments_message_id_created_at_idx" ON "message_attachments"("message_id", "created_at");

-- CreateIndex
CREATE INDEX "conversation_reports_status_created_at_idx" ON "conversation_reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_reports_conversation_id_reporter_business_id_key" ON "conversation_reports"("conversation_id", "reporter_business_id");

-- CreateIndex
CREATE INDEX "custom_package_requests_requester_business_id_created_at_idx" ON "custom_package_requests"("requester_business_id", "created_at");

-- CreateIndex
CREATE INDEX "custom_package_requests_provider_business_id_status_created_idx" ON "custom_package_requests"("provider_business_id", "status", "created_at");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_custom_request_id_fkey" FOREIGN KEY ("custom_request_id") REFERENCES "custom_package_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_business_id_fkey" FOREIGN KEY ("sender_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_blocks" ADD CONSTRAINT "business_blocks_blocker_business_id_fkey" FOREIGN KEY ("blocker_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_blocks" ADD CONSTRAINT "business_blocks_blocked_business_id_fkey" FOREIGN KEY ("blocked_business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_reports" ADD CONSTRAINT "conversation_reports_reporter_business_id_fkey" FOREIGN KEY ("reporter_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_package_requests" ADD CONSTRAINT "custom_package_requests_requester_business_id_fkey" FOREIGN KEY ("requester_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_package_requests" ADD CONSTRAINT "custom_package_requests_provider_business_id_fkey" FOREIGN KEY ("provider_business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_blocks" ADD CONSTRAINT "business_blocks_distinct_businesses_check" CHECK ("blocker_business_id" <> "blocked_business_id");
ALTER TABLE "custom_package_requests" ADD CONSTRAINT "custom_package_requests_distinct_businesses_check" CHECK ("requester_business_id" <> "provider_business_id");
ALTER TABLE "custom_package_requests" ADD CONSTRAINT "custom_package_requests_dates_check" CHECK ("end_date" >= "start_date");
ALTER TABLE "custom_package_requests" ADD CONSTRAINT "custom_package_requests_nights_check" CHECK ("total_nights" = "makkah_nights" + "madinah_nights" AND "total_nights" > 0 AND "group_size" > 0);
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_context_check" CHECK (
  ("context_type" = 'BUSINESS' AND "context_business_id" IS NOT NULL AND "context_package_id" IS NULL AND "context_service_id" IS NULL AND "context_offer_id" IS NULL AND "custom_request_id" IS NULL) OR
  ("context_type" = 'PACKAGE' AND "context_business_id" IS NULL AND "context_package_id" IS NOT NULL AND "context_service_id" IS NULL AND "context_offer_id" IS NULL AND "custom_request_id" IS NULL) OR
  ("context_type" = 'SERVICE' AND "context_business_id" IS NULL AND "context_package_id" IS NULL AND "context_service_id" IS NOT NULL AND "context_offer_id" IS NULL AND "custom_request_id" IS NULL) OR
  ("context_type" = 'OFFER' AND "context_business_id" IS NULL AND "context_package_id" IS NULL AND "context_service_id" IS NULL AND "context_offer_id" IS NOT NULL AND "custom_request_id" IS NULL) OR
  ("context_type" = 'CUSTOM_REQUEST' AND "context_business_id" IS NULL AND "context_package_id" IS NULL AND "context_service_id" IS NULL AND "context_offer_id" IS NULL AND "custom_request_id" IS NOT NULL)
);
