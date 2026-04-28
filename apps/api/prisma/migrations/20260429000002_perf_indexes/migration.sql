-- Enable pg_trgm for fast ILIKE search on Item.name
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Item indexes (event-scoped queries dominate the workload)
CREATE INDEX IF NOT EXISTS "Item_eventId_createdAt_idx" ON "Item"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "Item_eventId_status_idx"    ON "Item"("eventId", "status");
CREATE INDEX IF NOT EXISTS "Item_eventId_boxId_idx"     ON "Item"("eventId", "boxId");
CREATE INDEX IF NOT EXISTS "Item_eventId_groupId_idx"   ON "Item"("eventId", "groupId");
CREATE INDEX IF NOT EXISTS "Item_eventId_ownerId_idx"   ON "Item"("eventId", "ownerId");

-- GIN index on tags array — supports tags && / @> / ANY operators in O(log n)
CREATE INDEX IF NOT EXISTS "Item_tags_idx" ON "Item" USING GIN ("tags");

-- Trigram GIN index on name for ILIKE '%foo%' queries (becomes index-backed)
CREATE INDEX IF NOT EXISTS "Item_name_trgm_idx" ON "Item" USING GIN ("name" gin_trgm_ops);

-- Box / Battery event-scoped indexes
CREATE INDEX IF NOT EXISTS "Box_eventId_idx"                ON "Box"("eventId");
CREATE INDEX IF NOT EXISTS "Box_eventId_shippingMethod_idx" ON "Box"("eventId", "shippingMethod");
CREATE INDEX IF NOT EXISTS "Battery_eventId_idx"            ON "Battery"("eventId");
CREATE INDEX IF NOT EXISTS "Battery_eventId_batteryType_idx" ON "Battery"("eventId", "batteryType");
CREATE INDEX IF NOT EXISTS "Battery_eventId_ownerId_idx"    ON "Battery"("eventId", "ownerId");
