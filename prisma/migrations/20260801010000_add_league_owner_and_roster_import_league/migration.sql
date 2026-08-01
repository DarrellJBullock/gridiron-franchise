-- Pre-auth demo data has no owner to backfill onto, so it is cleared here.
-- Games first (Team/Season FKs on Game have no ON DELETE action), then the
-- League itself, which cascades Team/Season/Player/etc. Fresh per-user
-- leagues are auto-provisioned on first sign-in going forward.
DELETE FROM "Game";
DELETE FROM "League";
DELETE FROM "RosterImport";

-- AlterTable
ALTER TABLE "League" ADD COLUMN "ownerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "RosterImport" ADD COLUMN "leagueId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "League_ownerId_key" ON "League"("ownerId");

-- CreateIndex
CREATE INDEX "RosterImport_leagueId_idx" ON "RosterImport"("leagueId");

-- AddForeignKey
ALTER TABLE "RosterImport" ADD CONSTRAINT "RosterImport_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
