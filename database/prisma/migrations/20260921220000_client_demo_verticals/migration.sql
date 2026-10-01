-- CreateEnum
CREATE TYPE "ServiceVertical" AS ENUM ('TOURISM', 'HAJJ_UMRAH', 'VISA_SERVICES');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConversationContextType" ADD VALUE 'TOURISM_PACKAGE';
ALTER TYPE "ConversationContextType" ADD VALUE 'VISA_SERVICE';

-- AlterTable
ALTER TABLE "availability_rules" ADD COLUMN     "tourism_package_id" UUID,
ADD COLUMN     "visa_service_id" UUID;

-- AlterTable
ALTER TABLE "business_profiles" ADD COLUMN     "verticals" "ServiceVertical"[] DEFAULT ARRAY['HAJJ_UMRAH']::"ServiceVertical"[];

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "context_tourism_id" UUID,
ADD COLUMN     "context_visa_id" UUID;

-- CreateTable
CREATE TABLE "tourism_packages" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "source_market" VARCHAR(100) NOT NULL,
    "departure_city" VARCHAR(100) NOT NULL,
    "destination_country" VARCHAR(100) NOT NULL,
    "destination_cities" TEXT[],
    "category" VARCHAR(100) NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "minimum_group_size" INTEGER,
    "maximum_group_size" INTEGER,
    "accommodation" VARCHAR(1000) NOT NULL,
    "transport" VARCHAR(1000) NOT NULL,
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "pricing_mode" "PricingMode" NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "tourism_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visa_services" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "source_market" VARCHAR(100) NOT NULL,
    "applicant_nationality" VARCHAR(100) NOT NULL,
    "destination_country" VARCHAR(100) NOT NULL,
    "visa_category" VARCHAR(100) NOT NULL,
    "processing_requirement" VARCHAR(1000) NOT NULL,
    "document_summary" VARCHAR(2000) NOT NULL,
    "appointment_assistance" BOOLEAN NOT NULL DEFAULT false,
    "government_fee_included" BOOLEAN NOT NULL DEFAULT false,
    "pricing_mode" "PricingMode" NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "visa_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tourism_packages_profile_id_status_updated_at_idx" ON "tourism_packages"("profile_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "tourism_packages_status_source_market_destination_country_c_idx" ON "tourism_packages"("status", "source_market", "destination_country", "category", "price");

-- CreateIndex
CREATE INDEX "visa_services_profile_id_status_updated_at_idx" ON "visa_services"("profile_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "visa_services_status_source_market_destination_country_visa_idx" ON "visa_services"("status", "source_market", "destination_country", "visa_category", "price");

-- CreateIndex
CREATE INDEX "availability_rules_tourism_package_id_start_date_end_date_idx" ON "availability_rules"("tourism_package_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "availability_rules_visa_service_id_start_date_end_date_idx" ON "availability_rules"("visa_service_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "tourism_packages" ADD CONSTRAINT "tourism_packages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visa_services" ADD CONSTRAINT "visa_services_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_tourism_package_id_fkey" FOREIGN KEY ("tourism_package_id") REFERENCES "tourism_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_visa_service_id_fkey" FOREIGN KEY ("visa_service_id") REFERENCES "visa_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "availability_rules" DROP CONSTRAINT "availability_exactly_one_subject";
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_single_owner_check" CHECK (num_nonnulls("package_id", "service_id", "tourism_package_id", "visa_service_id") = 1);
ALTER TABLE "tourism_packages" ADD CONSTRAINT "tourism_packages_pricing_check" CHECK (("pricing_mode" = 'ON_REQUEST' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_mode" <> 'ON_REQUEST' AND "price" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "visa_services" ADD CONSTRAINT "visa_services_pricing_check" CHECK (("pricing_mode" = 'ON_REQUEST' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_mode" <> 'ON_REQUEST' AND "price" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_context_check";
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_context_check" CHECK (
  ("context_type" = 'BUSINESS' AND "context_business_id" IS NOT NULL AND num_nonnulls("context_package_id", "context_service_id", "context_offer_id", "custom_request_id", "context_tourism_id", "context_visa_id") = 0) OR
  ("context_type" = 'PACKAGE' AND "context_package_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_service_id", "context_offer_id", "custom_request_id", "context_tourism_id", "context_visa_id") = 0) OR
  ("context_type" = 'SERVICE' AND "context_service_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_package_id", "context_offer_id", "custom_request_id", "context_tourism_id", "context_visa_id") = 0) OR
  ("context_type" = 'OFFER' AND "context_offer_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_package_id", "context_service_id", "custom_request_id", "context_tourism_id", "context_visa_id") = 0) OR
  ("context_type" = 'CUSTOM_REQUEST' AND "custom_request_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_package_id", "context_service_id", "context_offer_id", "context_tourism_id", "context_visa_id") = 0) OR
  ("context_type" = 'TOURISM_PACKAGE' AND "context_tourism_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_package_id", "context_service_id", "context_offer_id", "custom_request_id", "context_visa_id") = 0) OR
  ("context_type" = 'VISA_SERVICE' AND "context_visa_id" IS NOT NULL AND num_nonnulls("context_business_id", "context_package_id", "context_service_id", "context_offer_id", "custom_request_id", "context_tourism_id") = 0)
);
