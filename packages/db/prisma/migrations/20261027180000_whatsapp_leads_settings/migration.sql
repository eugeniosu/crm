-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "leadsAssistantEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "leadsCloseMinute" INTEGER NOT NULL DEFAULT 1080,
ADD COLUMN     "leadsMeetingMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "leadsNoticeMinutes" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "leadsOpenMinute" INTEGER NOT NULL DEFAULT 540,
ADD COLUMN     "leadsOwnerId" TEXT,
ADD COLUMN     "leadsWeekdays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[];

-- AddForeignKey
ALTER TABLE "appSetting" ADD CONSTRAINT "appSetting_leadsOwnerId_fkey" FOREIGN KEY ("leadsOwnerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

