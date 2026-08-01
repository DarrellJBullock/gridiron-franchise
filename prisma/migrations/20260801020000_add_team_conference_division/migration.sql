-- AlterTable
ALTER TABLE "Team" ADD COLUMN "conference" TEXT NOT NULL DEFAULT 'Eastern Conference';
ALTER TABLE "Team" ADD COLUMN "division" TEXT NOT NULL DEFAULT 'Atlantic';

-- Backfill known template teams into 2 conferences x 3 divisions x 3 teams (18 total).
-- Eastern Conference
UPDATE "Team" SET "conference" = 'Eastern Conference', "division" = 'Atlantic' WHERE "abbreviation" IN ('DLS', 'JYI', 'PHF');
UPDATE "Team" SET "conference" = 'Eastern Conference', "division" = 'Southeast' WHERE "abbreviation" IN ('ATF', 'ORR', 'CLS');
UPDATE "Team" SET "conference" = 'Eastern Conference', "division" = 'North' WHERE "abbreviation" IN ('CHF', 'DET', 'PRP');
-- Western Conference
UPDATE "Team" SET "conference" = 'Western Conference', "division" = 'Pacific' WHERE "abbreviation" IN ('SEV', 'POR', 'SAM');
UPDATE "Team" SET "conference" = 'Western Conference', "division" = 'Southwest' WHERE "abbreviation" IN ('HOC', 'AUR', 'PXV');
UPDATE "Team" SET "conference" = 'Western Conference', "division" = 'Mountain' WHERE "abbreviation" IN ('DNB', 'MPB', 'NVI');
