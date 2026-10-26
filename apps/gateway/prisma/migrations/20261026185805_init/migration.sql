-- CreateEnum
CREATE TYPE "ConnectKind" AS ENUM ('whatsapp');

-- CreateTable
CREATE TABLE "Install" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relayUrl" TEXT NOT NULL,
    "relayTokenEncrypted" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "settingsUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "Install_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappNumber" (
    "id" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "displayPhoneNumber" TEXT NOT NULL,
    "verifiedName" TEXT NOT NULL,
    "qualityRating" TEXT,
    "tokenEncrypted" TEXT NOT NULL,
    "coexistence" BOOLEAN NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),

    CONSTRAINT "WhatsappNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectSession" (
    "id" TEXT NOT NULL,
    "installId" TEXT NOT NULL,
    "kind" "ConnectKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ConnectSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookReceipt" (
    "wamid" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("wamid")
);

-- CreateIndex
CREATE UNIQUE INDEX "Install_slug_key" ON "Install"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Install_apiKeyHash_key" ON "Install"("apiKeyHash");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_installId_key" ON "WhatsappNumber"("installId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappNumber_phoneNumberId_key" ON "WhatsappNumber"("phoneNumberId");

-- CreateIndex
CREATE INDEX "ConnectSession_installId_idx" ON "ConnectSession"("installId");

-- CreateIndex
CREATE INDEX "WebhookReceipt_receivedAt_idx" ON "WebhookReceipt"("receivedAt");

-- AddForeignKey
ALTER TABLE "WhatsappNumber" ADD CONSTRAINT "WhatsappNumber_installId_fkey" FOREIGN KEY ("installId") REFERENCES "Install"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConnectSession" ADD CONSTRAINT "ConnectSession_installId_fkey" FOREIGN KEY ("installId") REFERENCES "Install"("id") ON DELETE CASCADE ON UPDATE CASCADE;
