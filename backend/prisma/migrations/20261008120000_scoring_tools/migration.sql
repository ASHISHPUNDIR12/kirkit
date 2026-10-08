CREATE TABLE "Team" (
 "id" TEXT PRIMARY KEY, "ownerId" TEXT NOT NULL, "name" TEXT NOT NULL, "nameKey" TEXT NOT NULL,
 CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Team_ownerId_nameKey_key" ON "Team"("ownerId", "nameKey");
CREATE TABLE "Player" (
 "id" TEXT PRIMARY KEY, "teamId" TEXT NOT NULL, "name" TEXT NOT NULL, "nameKey" TEXT NOT NULL,
 CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Player_teamId_nameKey_key" ON "Player"("teamId", "nameKey");
ALTER TABLE "Match" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "team1Id" TEXT, ADD COLUMN "team2Id" TEXT;
ALTER TABLE "Match" ADD CONSTRAINT "Match_team1Id_fkey" FOREIGN KEY ("team1Id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Match" ADD CONSTRAINT "Match_team2Id_fkey" FOREIGN KEY ("team2Id") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerInnings" ADD COLUMN "playerId" TEXT;
ALTER TABLE "PlayerInnings" ADD CONSTRAINT "PlayerInnings_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PlayerInnings_playerId_idx" ON "PlayerInnings"("playerId");
ALTER TABLE "BallEvent" ADD COLUMN "batsmanId" TEXT, ADD COLUMN "nonStrikerName" TEXT;
CREATE TABLE "MatchAction" (
 "id" TEXT PRIMARY KEY, "matchId" TEXT NOT NULL, "inningsId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
 "fingerprint" TEXT NOT NULL, "kind" TEXT NOT NULL, "revision" INTEGER NOT NULL,
 "snapshot" JSONB, "undoneAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MatchAction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MatchAction_matchId_requestId_key" ON "MatchAction"("matchId", "requestId");
CREATE UNIQUE INDEX "MatchAction_matchId_revision_key" ON "MatchAction"("matchId", "revision");
