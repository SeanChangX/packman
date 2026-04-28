CREATE TYPE "AiTagJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'CANCELLED');

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
CREATE INDEX "AiTagJob_itemId_status_idx" ON "AiTagJob"("itemId", "status");

ALTER TABLE "AiTagJob" ADD CONSTRAINT "AiTagJob_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
