CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Session" (
  "tokenHash" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "AuthThrottle" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "hits" INTEGER NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AuthThrottle_expiresAt_idx" ON "AuthThrottle"("expiresAt");
ALTER TABLE "Match" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Match" ADD CONSTRAINT "Match_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Match_ownerId_createdAt_idx" ON "Match"("ownerId", "createdAt");
