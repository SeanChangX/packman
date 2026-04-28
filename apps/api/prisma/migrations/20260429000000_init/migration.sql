-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "ShippingMethod" AS ENUM ('CHECKED', 'CARRY_ON');
CREATE TYPE "PackingStatus" AS ENUM ('NOT_PACKED', 'PACKED', 'SEALED');
CREATE TYPE "SelectOptionType" AS ENUM ('SHIPPING_METHOD', 'USE_CATEGORY', 'BATTERY_TYPE');
CREATE TYPE "AiTagStatus" AS ENUM ('NONE', 'PENDING', 'DONE', 'FAILED');
CREATE TYPE "AiTagJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

-- CreateTable: Group
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "slackId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "groupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_slackId_key" ON "User"("slackId");
ALTER TABLE "User" ADD CONSTRAINT "User_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: Event
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Box
CREATE TABLE "Box" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "shippingMethod" "ShippingMethod" NOT NULL,
    "ownerId" TEXT,
    "status" "PackingStatus" NOT NULL DEFAULT 'NOT_PACKED',
    "notes" TEXT,
    "priority" INTEGER,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Box_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Box_label_eventId_key" ON "Box"("label", "eventId");
CREATE INDEX "Box_eventId_idx" ON "Box"("eventId");
CREATE INDEX "Box_eventId_shippingMethod_idx" ON "Box"("eventId", "shippingMethod");
ALTER TABLE "Box" ADD CONSTRAINT "Box_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Box" ADD CONSTRAINT "Box_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Item
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT,
    "shippingMethod" TEXT,
    "groupId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "PackingStatus" NOT NULL DEFAULT 'NOT_PACKED',
    "notes" TEXT,
    "boxId" TEXT,
    "useCategory" TEXT,
    "tags" TEXT[],
    "specialNotes" TEXT,
    "photoUrl" TEXT,
    "weightG" INTEGER,
    "aiTagStatus" "AiTagStatus" NOT NULL DEFAULT 'NONE',
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Item_eventId_createdAt_idx" ON "Item"("eventId", "createdAt");
CREATE INDEX "Item_eventId_status_idx"    ON "Item"("eventId", "status");
CREATE INDEX "Item_eventId_boxId_idx"     ON "Item"("eventId", "boxId");
CREATE INDEX "Item_eventId_groupId_idx"   ON "Item"("eventId", "groupId");
CREATE INDEX "Item_eventId_ownerId_idx"   ON "Item"("eventId", "ownerId");
CREATE INDEX "Item_tags_idx"      ON "Item" USING GIN ("tags");
CREATE INDEX "Item_name_trgm_idx" ON "Item" USING GIN ("name" gin_trgm_ops);
ALTER TABLE "Item" ADD CONSTRAINT "Item_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_boxId_fkey"
    FOREIGN KEY ("boxId") REFERENCES "Box"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Item" ADD CONSTRAINT "Item_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: Battery
CREATE TABLE "Battery" (
    "id" TEXT NOT NULL,
    "batteryId" TEXT NOT NULL,
    "ownerId" TEXT,
    "notes" TEXT,
    "batteryType" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Battery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Battery_batteryId_key" ON "Battery"("batteryId");
CREATE INDEX "Battery_eventId_idx" ON "Battery"("eventId");
CREATE INDEX "Battery_eventId_batteryType_idx" ON "Battery"("eventId", "batteryType");
CREATE INDEX "Battery_eventId_ownerId_idx" ON "Battery"("eventId", "ownerId");
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: SelectOption
CREATE TABLE "SelectOption" (
    "id" TEXT NOT NULL,
    "type" "SelectOptionType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SelectOption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SelectOption_type_value_key" ON "SelectOption"("type", "value");

-- CreateTable: BatteryRegulation
CREATE TABLE "BatteryRegulation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BatteryRegulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: SystemSetting
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable: OllamaEndpoint
CREATE TABLE "OllamaEndpoint" (
    "id" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "avgLatencyMs" DOUBLE PRECISION,
    "lastLatencyMs" INTEGER,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "healthAvgLatencyMs" DOUBLE PRECISION,
    "healthLastLatencyMs" INTEGER,
    "healthCheckCount" INTEGER NOT NULL DEFAULT 0,
    "healthFailureCount" INTEGER NOT NULL DEFAULT 0,
    "healthLastSuccessAt" TIMESTAMP(3),
    "healthLastErrorAt" TIMESTAMP(3),
    "healthLastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OllamaEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OllamaEndpoint_baseUrl_key" ON "OllamaEndpoint"("baseUrl");

-- CreateTable: AiTagJob
CREATE TABLE "AiTagJob" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "objectName" TEXT NOT NULL,
    "status" "AiTagJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiTagJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiTagJob_status_nextRunAt_idx" ON "AiTagJob"("status", "nextRunAt");
CREATE INDEX "AiTagJob_itemId_status_idx"    ON "AiTagJob"("itemId", "status");
ALTER TABLE "AiTagJob" ADD CONSTRAINT "AiTagJob_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
