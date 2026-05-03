-- Add updatedAt column to Item, defaulting to now() so existing rows get a value.
ALTER TABLE "Item" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill: existing rows have no real "last updated" data, so seed it from createdAt.
UPDATE "Item" SET "updatedAt" = "createdAt";
