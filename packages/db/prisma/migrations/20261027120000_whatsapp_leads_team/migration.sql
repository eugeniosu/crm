ALTER TABLE "leadConversation" ADD COLUMN "teamRepliedAt" TIMESTAMP(3);

ALTER TABLE "leadMessage" ADD COLUMN "fromTeam" BOOLEAN NOT NULL DEFAULT false;
