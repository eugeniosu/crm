ALTER TYPE "DealStage" ADD VALUE 'LEAD_NEW' BEFORE 'DEMO_BOOKED';
ALTER TYPE "DealStage" ADD VALUE 'TRIAL_ACTIVE' AFTER 'DEMO_BOOKED';

ALTER TYPE "RecordSource" ADD VALUE 'WHATSAPP';
ALTER TYPE "RecordSource" ADD VALUE 'DEMO';
ALTER TYPE "RecordSource" ADD VALUE 'WEB';

CREATE TABLE "intakeReceipt" (
    "key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contactId" TEXT,
    "outcome" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intakeReceipt_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "intakeReceipt_contactId_idx" ON "intakeReceipt"("contactId");

INSERT INTO "fieldDefinition" ("id", "entity", "key", "label", "type", "agentFilled", "showOnSheet", "showOnTable", "showOnFilter", "position", "createdAt", "updatedAt")
SELECT 'kontia_company_rut', 'COMPANY', 'rut', 'RUT', 'TEXT', false, true, true, true,
       COALESCE((SELECT MAX("position") + 1 FROM "fieldDefinition" WHERE "entity" = 'COMPANY'), 0),
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "fieldDefinition" WHERE "entity" = 'COMPANY' AND "key" = 'rut');
