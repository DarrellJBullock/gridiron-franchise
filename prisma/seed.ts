import { PrismaClient } from "@prisma/client";
import { provisionLeagueForOwner } from "../lib/league/provision-league";

const prisma = new PrismaClient();

// CLI seeding is scoped to a single fixed "owner" so it never touches real
// users' leagues in the shared dev/prod database. Override with
// SEED_OWNER_ID to seed a different demo league.
const SEED_OWNER_ID = process.env.SEED_OWNER_ID || "seed-demo-owner";

async function main() {
  console.log(`Seeding demo league for owner "${SEED_OWNER_ID}"...`);

  const existing = await prisma.league.findUnique({ where: { ownerId: SEED_OWNER_ID } });
  if (existing) {
    console.log("  Existing demo league found, deleting before reseed...");
    const teamIds = (await prisma.team.findMany({ where: { leagueId: existing.id }, select: { id: true } })).map(
      (t) => t.id
    );
    // Games reference Team without cascade, so they must be cleared before
    // the League->Team cascade can delete the teams themselves.
    await prisma.game.deleteMany({ where: { OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] } });
    await prisma.league.delete({ where: { id: existing.id } });
  }

  const league = await provisionLeagueForOwner(SEED_OWNER_ID, prisma);
  const teamCount = await prisma.team.count({ where: { leagueId: league.id } });
  const seasonCount = await prisma.season.count({ where: { leagueId: league.id } });

  console.log(`Seeded league "${league.name}" with ${teamCount} teams and ${seasonCount} season(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
