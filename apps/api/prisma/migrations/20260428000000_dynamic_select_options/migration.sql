-- AlterTable: change Item.shippingMethod from enum to text
ALTER TABLE "Item" ALTER COLUMN "shippingMethod" TYPE TEXT USING "shippingMethod"::TEXT;

-- AlterTable: change Item.useCategory from enum to text
ALTER TABLE "Item" ALTER COLUMN "useCategory" TYPE TEXT USING "useCategory"::TEXT;

-- AlterTable: change Battery.batteryType from enum to text
ALTER TABLE "Battery" ALTER COLUMN "batteryType" TYPE TEXT USING "batteryType"::TEXT;

-- DropEnum (no longer used by any column)
DROP TYPE "UseCategory";
DROP TYPE "BatteryType";

-- CreateEnum
CREATE TYPE "SelectOptionType" AS ENUM ('SHIPPING_METHOD', 'USE_CATEGORY', 'BATTERY_TYPE');

-- CreateTable
CREATE TABLE "SelectOption" (
    "id" TEXT NOT NULL,
    "type" "SelectOptionType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SelectOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SelectOption_type_value_key" ON "SelectOption"("type", "value");
