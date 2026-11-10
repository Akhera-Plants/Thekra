-- Round 7 «صحبة» (docs/plan/2026-11-10-owner-round-7.md, R7-D5..D8). Additive: new tables and enums only.
--   D5  rounds: CircleRound (kind key, short label, minutes, «الجولة n اليوم», تم / لم يتم).
--   D6/D7  one feed: CircleMessage (preset lines by key, round start/end, preset replies), CircleMessageSave («احتفظ بها»).
--   D8  reports and mutes: CircleReport (member or message, words copied at report time), CircleMute.
-- The round-6 cheers are copied into the feed below; CircleCheer is left in place (unused) for a later migration to drop.

-- CreateEnum
CREATE TYPE "CircleMessageKind" AS ENUM ('PRESET', 'ROUND_START', 'ROUND_END', 'REPLY');

-- CreateEnum
CREATE TYPE "CircleRoundOutcome" AS ENUM ('DONE', 'NOT_DONE');

-- CreateEnum
CREATE TYPE "CircleReportKind" AS ENUM ('MEMBER', 'MESSAGE');

-- CreateTable
CREATE TABLE "CircleMessage" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT,
    "kind" "CircleMessageKind" NOT NULL,
    "key" TEXT,
    "roundId" TEXT,
    "data" JSONB,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleRound" (
    "id" TEXT NOT NULL,
    "circleId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "minutes" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "number" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "outcome" "CircleRoundOutcome",

    CONSTRAINT "CircleRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CircleMessageSave" (
    "memberId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMessageSave_pkey" PRIMARY KEY ("memberId","messageId")
);

-- CreateTable
CREATE TABLE "CircleMute" (
    "memberId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleMute_pkey" PRIMARY KEY ("memberId","mutedId")
);

-- CreateTable
CREATE TABLE "CircleReport" (
    "id" TEXT NOT NULL,
    "kind" "CircleReportKind" NOT NULL,
    "circleId" TEXT,
    "circleName" TEXT NOT NULL,
    "reporterId" TEXT,
    "reporterName" TEXT NOT NULL,
    "reportedMemberId" TEXT,
    "reportedUserId" TEXT,
    "reportedName" TEXT NOT NULL,
    "messageId" TEXT,
    "messageSnapshot" JSONB,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CircleReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CircleMessage_circleId_createdAt_idx" ON "CircleMessage"("circleId", "createdAt");

-- CreateIndex
CREATE INDEX "CircleMessage_senderId_day_idx" ON "CircleMessage"("senderId", "day");

-- CreateIndex
CREATE INDEX "CircleMessage_receiverId_idx" ON "CircleMessage"("receiverId");

-- CreateIndex
CREATE INDEX "CircleMessage_roundId_idx" ON "CircleMessage"("roundId");

-- CreateIndex
CREATE INDEX "CircleRound_circleId_startedAt_idx" ON "CircleRound"("circleId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CircleRound_memberId_day_number_key" ON "CircleRound"("memberId", "day", "number");

-- CreateIndex
CREATE INDEX "CircleMessageSave_messageId_idx" ON "CircleMessageSave"("messageId");

-- CreateIndex
CREATE INDEX "CircleMute_mutedId_idx" ON "CircleMute"("mutedId");

-- CreateIndex
CREATE INDEX "CircleReport_createdAt_idx" ON "CircleReport"("createdAt");

-- CreateIndex
CREATE INDEX "CircleReport_reporterId_createdAt_idx" ON "CircleReport"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "CircleReport_circleId_idx" ON "CircleReport"("circleId");

-- CreateIndex
CREATE INDEX "CircleReport_reportedMemberId_idx" ON "CircleReport"("reportedMemberId");

-- CreateIndex
CREATE INDEX "CircleReport_reportedUserId_idx" ON "CircleReport"("reportedUserId");

-- CreateIndex
CREATE INDEX "CircleReport_messageId_idx" ON "CircleReport"("messageId");

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessage" ADD CONSTRAINT "CircleMessage_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CircleRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleRound" ADD CONSTRAINT "CircleRound_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleRound" ADD CONSTRAINT "CircleRound_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessageSave" ADD CONSTRAINT "CircleMessageSave_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMessageSave" ADD CONSTRAINT "CircleMessageSave_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CircleMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMute" ADD CONSTRAINT "CircleMute_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleMute" ADD CONSTRAINT "CircleMute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "CircleMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleReport" ADD CONSTRAINT "CircleReport_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleReport" ADD CONSTRAINT "CircleReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleReport" ADD CONSTRAINT "CircleReport_reportedMemberId_fkey" FOREIGN KEY ("reportedMemberId") REFERENCES "CircleMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleReport" ADD CONSTRAINT "CircleReport_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CircleReport" ADD CONSTRAINT "CircleReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CircleMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Copy the round-6 cheers into the feed (same ids, same keys: thabat, jazak, dhakkarani).
INSERT INTO "CircleMessage" ("id", "circleId", "senderId", "receiverId", "kind", "key", "day", "createdAt")
SELECT "id", "circleId", "senderId", "receiverId", 'PRESET', "message", "day", "createdAt" FROM "CircleCheer"
ON CONFLICT ("id") DO NOTHING;
