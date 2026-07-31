-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "awayQuarterScores" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "homeQuarterScores" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "playStyleSummary" TEXT,
ADD COLUMN     "turningPoint" TEXT;
