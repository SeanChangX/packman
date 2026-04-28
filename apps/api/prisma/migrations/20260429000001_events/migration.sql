-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Add eventId to Item, Box, Battery as nullable first
ALTER TABLE "Item" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Box" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Battery" ADD COLUMN "eventId" TEXT;

-- Create default event with a fixed ID
INSERT INTO "Event" ("id", "name", "updatedAt")
VALUES ('e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6', 'Default', NOW());

-- Link all existing data to the default event
UPDATE "Item" SET "eventId" = 'e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6' WHERE "eventId" IS NULL;
UPDATE "Box"  SET "eventId" = 'e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6' WHERE "eventId" IS NULL;
UPDATE "Battery" SET "eventId" = 'e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6' WHERE "eventId" IS NULL;

-- Make eventId NOT NULL
ALTER TABLE "Item" ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "Box"  ALTER COLUMN "eventId" SET NOT NULL;
ALTER TABLE "Battery" ALTER COLUMN "eventId" SET NOT NULL;

-- Add foreign key constraints
ALTER TABLE "Item" ADD CONSTRAINT "Item_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Box" ADD CONSTRAINT "Box_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Change Box.label uniqueness from global to per-event
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Box_label_key' AND table_name = 'Box'
  ) THEN
    ALTER TABLE "Box" DROP CONSTRAINT "Box_label_key";
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Box_label_eventId_key" ON "Box"("label", "eventId");

-- Set default active event in SystemSetting
INSERT INTO "SystemSetting" ("key", "value", "updatedAt")
VALUES ('activeEventId', 'e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6', NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = 'e1e2e3e4-0000-0000-0000-e1e2e3e4e5e6', "updatedAt" = NOW();
