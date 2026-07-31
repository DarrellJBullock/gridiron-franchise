-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "age" INTEGER NOT NULL DEFAULT 22,
ADD COLUMN     "retired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retiredYear" INTEGER,
ADD COLUMN     "yearsPro" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Player_teamId_retired_idx" ON "Player"("teamId", "retired");
