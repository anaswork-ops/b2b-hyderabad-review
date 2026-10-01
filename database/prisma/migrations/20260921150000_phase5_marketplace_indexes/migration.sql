CREATE INDEX "packages_marketplace_filter_idx" ON "packages"("status", "subtype", "source_market", "departure_city", "total_nights", "price", "currency");
CREATE INDEX "services_marketplace_filter_idx" ON "services"("status", "subtype", "source_market", "service_country", "service_city", "price", "currency");
CREATE INDEX "availability_marketplace_filter_idx" ON "availability_rules"("kind", "start_date", "end_date", "capacity");
CREATE INDEX "packages_destination_cities_gin_idx" ON "packages" USING GIN ("destination_cities");
CREATE INDEX "packages_room_occupancy_gin_idx" ON "packages" USING GIN ("room_occupancy");
CREATE INDEX "packages_meals_gin_idx" ON "packages" USING GIN ("meals");
CREATE INDEX "packages_transport_gin_idx" ON "packages" USING GIN ("transport");
CREATE INDEX "business_profiles_markets_gin_idx" ON "business_profiles" USING GIN ("markets_served");
CREATE INDEX "business_profiles_service_countries_gin_idx" ON "business_profiles" USING GIN ("service_countries");
