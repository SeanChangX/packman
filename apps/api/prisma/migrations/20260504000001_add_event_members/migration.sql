-- Per-event user membership. An event with zero members is treated as
-- unrestricted (all users available in owner pickers); admin opts in to
-- restriction by selecting a subset.
CREATE TABLE "EventMember" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventMember_pkey" PRIMARY KEY ("eventId", "userId")
);

CREATE INDEX "EventMember_userId_idx" ON "EventMember"("userId");

ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventMember" ADD CONSTRAINT "EventMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
