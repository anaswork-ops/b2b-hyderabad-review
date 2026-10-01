-- CreateEnum
CREATE TYPE "OfferingStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PilgrimageSubtype" AS ENUM ('HAJJ', 'UMRAH');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('FIXED', 'STARTING_FROM', 'ON_REQUEST');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('FIXED_DEPARTURE', 'DATE_RANGE', 'RECURRING', 'YEAR_ROUND', 'ON_REQUEST');

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "public_slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "business_type" "BusinessType" NOT NULL,
    "description" VARCHAR(3000) NOT NULL,
    "logo_key" VARCHAR(200),
    "headquarters_country" VARCHAR(100) NOT NULL,
    "headquarters_state" VARCHAR(100) NOT NULL,
    "headquarters_city" VARCHAR(100) NOT NULL,
    "public_email" VARCHAR(320),
    "public_phone" VARCHAR(32),
    "private_email" VARCHAR(320) NOT NULL,
    "private_phone" VARCHAR(32) NOT NULL,
    "website" VARCHAR(500),
    "years_operating" INTEGER NOT NULL,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "markets_served" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_countries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "service_cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "licence_number" VARCHAR(120),
    "licence_issuer" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subtype" "PilgrimageSubtype" NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "source_market" VARCHAR(100) NOT NULL,
    "departure_city" VARCHAR(100) NOT NULL,
    "destination_cities" TEXT[],
    "valid_from" DATE,
    "valid_to" DATE,
    "total_nights" INTEGER NOT NULL,
    "makkah_nights" INTEGER NOT NULL,
    "madinah_nights" INTEGER NOT NULL,
    "minimum_group_size" INTEGER,
    "maximum_group_size" INTEGER,
    "accommodation" JSONB NOT NULL,
    "room_occupancy" TEXT[],
    "transport" JSONB NOT NULL,
    "flights" JSONB,
    "meals" TEXT[],
    "visa_status" VARCHAR(80) NOT NULL,
    "ziyarat" TEXT[],
    "assistance" TEXT[],
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "pricing_mode" "PricingMode" NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "cancellation_terms" VARCHAR(3000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subtype" "PilgrimageSubtype" NOT NULL,
    "status" "OfferingStatus" NOT NULL DEFAULT 'DRAFT',
    "description" VARCHAR(3000) NOT NULL,
    "source_market" VARCHAR(100) NOT NULL,
    "service_country" VARCHAR(100) NOT NULL,
    "service_city" VARCHAR(100) NOT NULL,
    "pricing_mode" "PricingMode" NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "package_id" UUID,
    "service_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "pricing_mode" "PricingMode" NOT NULL,
    "price" DECIMAL(14,2),
    "currency" CHAR(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "businessProfileId" UUID,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability_rules" (
    "id" UUID NOT NULL,
    "package_id" UUID,
    "service_id" UUID,
    "kind" "AvailabilityKind" NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "recurrence" VARCHAR(120),
    "blackout_dates" DATE[],
    "capacity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offering_media" (
    "id" UUID NOT NULL,
    "package_id" UUID,
    "service_id" UUID,
    "kind" VARCHAR(16) NOT NULL,
    "storage_key" VARCHAR(200) NOT NULL,
    "filename" VARCHAR(200) NOT NULL,
    "content_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offering_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_business_id_key" ON "business_profiles"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_public_slug_key" ON "business_profiles"("public_slug");

-- CreateIndex
CREATE INDEX "business_profiles_business_type_headquarters_country_idx" ON "business_profiles"("business_type", "headquarters_country");

-- CreateIndex
CREATE INDEX "packages_profile_id_status_updated_at_idx" ON "packages"("profile_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "packages_subtype_source_market_status_idx" ON "packages"("subtype", "source_market", "status");

-- CreateIndex
CREATE INDEX "services_profile_id_status_updated_at_idx" ON "services"("profile_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "offers_profile_id_active_valid_to_idx" ON "offers"("profile_id", "active", "valid_to");

-- CreateIndex
CREATE INDEX "availability_rules_package_id_start_date_end_date_idx" ON "availability_rules"("package_id", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "availability_rules_service_id_start_date_end_date_idx" ON "availability_rules"("service_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "offering_media_storage_key_key" ON "offering_media"("storage_key");

-- CreateIndex
CREATE INDEX "offering_media_package_id_created_at_idx" ON "offering_media"("package_id", "created_at");

-- CreateIndex
CREATE INDEX "offering_media_service_id_created_at_idx" ON "offering_media"("service_id", "created_at");

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "business_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_businessProfileId_fkey" FOREIGN KEY ("businessProfileId") REFERENCES "business_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_media" ADD CONSTRAINT "offering_media_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offering_media" ADD CONSTRAINT "offering_media_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Domain integrity guards that Prisma cannot express.
ALTER TABLE "offers" ADD CONSTRAINT "offers_exactly_one_subject" CHECK (("package_id" IS NOT NULL)::int + ("service_id" IS NOT NULL)::int = 1);
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_exactly_one_subject" CHECK (("package_id" IS NOT NULL)::int + ("service_id" IS NOT NULL)::int = 1);
ALTER TABLE "packages" ADD CONSTRAINT "packages_nights_consistent" CHECK ("total_nights" = "makkah_nights" + "madinah_nights");
ALTER TABLE "packages" ADD CONSTRAINT "packages_pricing_consistent" CHECK (("pricing_mode" = 'ON_REQUEST' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_mode" <> 'ON_REQUEST' AND "price" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "services" ADD CONSTRAINT "services_pricing_consistent" CHECK (("pricing_mode" = 'ON_REQUEST' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_mode" <> 'ON_REQUEST' AND "price" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "offers" ADD CONSTRAINT "offers_pricing_consistent" CHECK (("pricing_mode" = 'ON_REQUEST' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_mode" <> 'ON_REQUEST' AND "price" > 0 AND "currency" IS NOT NULL));
ALTER TABLE "offering_media" ADD CONSTRAINT "offering_media_kind_allowed" CHECK ("kind" IN ('IMAGE', 'BROCHURE', 'DOCUMENT'));
