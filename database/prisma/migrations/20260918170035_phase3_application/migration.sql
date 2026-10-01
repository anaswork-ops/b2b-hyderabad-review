-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('TRAVEL_AGENCY', 'TOUR_OPERATOR', 'DMC');

-- CreateEnum
CREATE TYPE "ApplicationDocumentKind" AS ENUM ('REGISTRATION_LICENCE', 'SUPPORTING');

-- CreateTable
CREATE TABLE "business_applications" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "legal_name" VARCHAR(200),
    "trading_name" VARCHAR(200),
    "business_type" "BusinessType",
    "address" VARCHAR(500),
    "country" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "contact_email" VARCHAR(320),
    "contact_mobile" VARCHAR(32),
    "website" VARCHAR(500),
    "years_operating" INTEGER,
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "saudi_destinations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licence_number" VARCHAR(120),
    "licence_issuer" VARCHAR(200),
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requirements" (
    "id" UUID NOT NULL,
    "market" VARCHAR(100) NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "kind" "ApplicationDocumentKind" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "document_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "kind" "ApplicationDocumentKind" NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_reviews" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_status" "BusinessStatus" NOT NULL,
    "to_status" "BusinessStatus" NOT NULL,
    "note" VARCHAR(2000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_applications_business_id_key" ON "business_applications"("business_id");

-- CreateIndex
CREATE INDEX "business_applications_status_submitted_at_idx" ON "business_applications"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "business_applications_owner_id_created_at_idx" ON "business_applications"("owner_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_requirements_market_business_type_kind_key" ON "document_requirements"("market", "business_type", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "application_documents_storage_key_key" ON "application_documents"("storage_key");

-- CreateIndex
CREATE INDEX "application_documents_application_id_kind_idx" ON "application_documents"("application_id", "kind");

-- CreateIndex
CREATE INDEX "application_reviews_application_id_created_at_idx" ON "application_reviews"("application_id", "created_at");

-- AddForeignKey
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_applications" ADD CONSTRAINT "business_applications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "business_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "business_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_reviews" ADD CONSTRAINT "application_reviews_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "business_applications_owner_id_key" ON "business_applications"("owner_id");
INSERT INTO "document_requirements" ("id", "market", "business_type", "kind", "required", "enabled") VALUES
  (gen_random_uuid(), '*', 'TRAVEL_AGENCY', 'REGISTRATION_LICENCE', true, true),
  (gen_random_uuid(), '*', 'TOUR_OPERATOR', 'REGISTRATION_LICENCE', true, true),
  (gen_random_uuid(), '*', 'DMC', 'REGISTRATION_LICENCE', true, true);
