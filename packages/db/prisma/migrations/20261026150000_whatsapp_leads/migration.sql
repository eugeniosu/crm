CREATE TYPE "LeadMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TYPE "LeadDeliveryStatus" AS ENUM ('SENT', 'SIMULATED', 'FAILED');

CREATE TYPE "LeadMeetingStatus" AS ENUM ('RESERVED', 'CREATED');

CREATE TABLE "leadConversation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileName" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "summarizedThrough" TIMESTAMP(3),
    "summarizeNow" BOOLEAN NOT NULL DEFAULT false,
    "summarizingSince" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leadConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leadMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "LeadMessageDirection" NOT NULL,
    "wamid" TEXT,
    "replyKey" TEXT,
    "type" TEXT NOT NULL,
    "text" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "turnKey" TEXT,
    "deliveryStatus" "LeadDeliveryStatus",
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leadMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leadMeeting" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "status" "LeadMeetingStatus" NOT NULL DEFAULT 'RESERVED',
    "externalEventId" TEXT,
    "videoLink" TEXT,
    "attendeeName" TEXT,
    "attendeeEmail" TEXT,
    "company" TEXT,
    "reason" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leadMeeting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "leadConversation_phone_key" ON "leadConversation"("phone");

CREATE INDEX "leadConversation_lastMessageAt_idx" ON "leadConversation"("lastMessageAt");

CREATE UNIQUE INDEX "leadMessage_wamid_key" ON "leadMessage"("wamid");

CREATE UNIQUE INDEX "leadMessage_replyKey_key" ON "leadMessage"("replyKey");

CREATE INDEX "leadMessage_conversationId_sentAt_idx" ON "leadMessage"("conversationId", "sentAt");

CREATE INDEX "leadMessage_conversationId_turnKey_idx" ON "leadMessage"("conversationId", "turnKey");

CREATE UNIQUE INDEX "leadMeeting_phone_start_key" ON "leadMeeting"("phone", "start");

CREATE INDEX "leadMeeting_status_start_idx" ON "leadMeeting"("status", "start");

ALTER TABLE "leadMessage" ADD CONSTRAINT "leadMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "leadConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
