-- CreateTable
CREATE TABLE "GamePlay" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "driveNumber" INTEGER NOT NULL,
    "offenseAbbr" TEXT NOT NULL,
    "down" INTEGER NOT NULL,
    "distance" INTEGER NOT NULL,
    "yardLine" INTEGER NOT NULL,
    "playType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "yards" INTEGER NOT NULL,
    "isScoring" BOOLEAN NOT NULL DEFAULT false,
    "isTurnover" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GamePlay_gameId_sequence_idx" ON "GamePlay"("gameId", "sequence");

-- AddForeignKey
ALTER TABLE "GamePlay" ADD CONSTRAINT "GamePlay_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
