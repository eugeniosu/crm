-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "leadsKnowledgeDraft" TEXT,
ADD COLUMN     "leadsKnowledgeDraftUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "leadKnowledgeVersion" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leadKnowledgeVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "leadKnowledgeVersion_number_key" ON "leadKnowledgeVersion"("number");

-- AddForeignKey
ALTER TABLE "leadKnowledgeVersion" ADD CONSTRAINT "leadKnowledgeVersion_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

