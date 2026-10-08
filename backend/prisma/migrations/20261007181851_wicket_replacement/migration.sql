-- CreateEnum
CREATE TYPE "PendingBatsmanRole" AS ENUM ('STRIKER', 'NON_STRIKER');

-- AlterTable
ALTER TABLE "Innings" ADD COLUMN     "pendingBatsmanRole" "PendingBatsmanRole";
