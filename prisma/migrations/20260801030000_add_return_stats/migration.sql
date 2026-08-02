-- AlterTable
ALTER TABLE "GamePlayerStats" ADD COLUMN "kickReturnYards" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GamePlayerStats" ADD COLUMN "kickReturnTouchdowns" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GamePlayerStats" ADD COLUMN "puntReturnYards" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GamePlayerStats" ADD COLUMN "puntReturnTouchdowns" INTEGER NOT NULL DEFAULT 0;
