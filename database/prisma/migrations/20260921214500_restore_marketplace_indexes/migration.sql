CREATE INDEX IF NOT EXISTS "packages_marketplace_filter_idx" ON "packages"("status", "subtype", "source_market", "departure_city", "total_nights", "price", "currency");
CREATE INDEX IF NOT EXISTS "services_marketplace_filter_idx" ON "services"("status", "subtype", "source_market", "service_country", "service_city", "price", "currency");
CREATE INDEX IF NOT EXISTS "availability_marketplace_filter_idx" ON "availability_rules"("kind", "start_date", "end_date", "capacity");
CREATE INDEX IF NOT EXISTS "packages_destination_cities_gin_idx" ON "packages" USING GIN ("destination_cities");
CREATE INDEX IF NOT EXISTS "packages_room_occupancy_gin_idx" ON "packages" USING GIN ("room_occupancy");
CREATE INDEX IF NOT EXISTS "packages_meals_gin_idx" ON "packages" USING GIN ("meals");
CREATE INDEX IF NOT EXISTS "packages_transport_gin_idx" ON "packages" USING GIN ("transport");
CREATE INDEX IF NOT EXISTS "business_profiles_markets_gin_idx" ON "business_profiles" USING GIN ("markets_served");
CREATE INDEX IF NOT EXISTS "business_profiles_service_countries_gin_idx" ON "business_profiles" USING GIN ("service_countries");
