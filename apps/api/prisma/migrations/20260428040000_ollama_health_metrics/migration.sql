ALTER TABLE "OllamaEndpoint"
ADD COLUMN "healthAvgLatencyMs" DOUBLE PRECISION,
ADD COLUMN "healthLastLatencyMs" INTEGER,
ADD COLUMN "healthCheckCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "healthFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "healthLastSuccessAt" TIMESTAMP(3),
ADD COLUMN "healthLastErrorAt" TIMESTAMP(3),
ADD COLUMN "healthLastError" TEXT;
