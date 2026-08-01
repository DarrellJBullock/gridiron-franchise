-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "isPlayoff" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playoffRound" TEXT;
