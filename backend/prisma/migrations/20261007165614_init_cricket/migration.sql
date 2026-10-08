-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InningsStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PlayerType" AS ENUM ('BATSMAN', 'BOWLER');

-- CreateEnum
CREATE TYPE "ActivePlayerRole" AS ENUM ('STRIKER', 'NON_STRIKER', 'BOWLER');

-- CreateEnum
CREATE TYPE "BallEventType" AS ENUM ('DOT', 'ONE', 'TWO', 'THREE', 'FOUR', 'SIX', 'WICKET', 'WIDE', 'NO_BALL');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "team1Name" TEXT NOT NULL,
    "team2Name" TEXT NOT NULL,
    "oversLimit" INTEGER NOT NULL,
    "battingFirstTeam" TEXT,
    "currentInnings" INTEGER NOT NULL DEFAULT 1,
    "status" "MatchStatus" NOT NULL DEFAULT 'CREATED',
    "firstInningsRuns" INTEGER,
    "firstInningsWickets" INTEGER,
    "target" INTEGER,
    "winner" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Innings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "inningsNumber" INTEGER NOT NULL,
    "battingTeamName" TEXT NOT NULL,
    "bowlingTeamName" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "wickets" INTEGER NOT NULL DEFAULT 0,
    "completedOvers" INTEGER NOT NULL DEFAULT 0,
    "ballsInCurrentOver" INTEGER NOT NULL DEFAULT 0,
    "status" "InningsStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Innings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerInnings" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "playerType" "PlayerType" NOT NULL,
    "activeRole" "ActivePlayerRole",
    "runs" INTEGER NOT NULL DEFAULT 0,
    "ballsFaced" INTEGER NOT NULL DEFAULT 0,
    "wicketsTaken" INTEGER NOT NULL DEFAULT 0,
    "runsConceded" INTEGER NOT NULL DEFAULT 0,
    "ballsBowled" INTEGER NOT NULL DEFAULT 0,
    "isOut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PlayerInnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BallEvent" (
    "id" TEXT NOT NULL,
    "inningsId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "overNumber" INTEGER NOT NULL,
    "ballNumber" INTEGER NOT NULL,
    "batsmanName" TEXT NOT NULL,
    "bowlerName" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "eventType" "BallEventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_createdAt_idx" ON "Match"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Innings_matchId_inningsNumber_key" ON "Innings"("matchId", "inningsNumber");

-- CreateIndex
CREATE INDEX "PlayerInnings_inningsId_idx" ON "PlayerInnings"("inningsId");

-- CreateIndex
CREATE UNIQUE INDEX "BallEvent_inningsId_sequence_key" ON "BallEvent"("inningsId", "sequence");

-- AddForeignKey
ALTER TABLE "Innings" ADD CONSTRAINT "Innings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerInnings" ADD CONSTRAINT "PlayerInnings_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BallEvent" ADD CONSTRAINT "BallEvent_inningsId_fkey" FOREIGN KEY ("inningsId") REFERENCES "Innings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
