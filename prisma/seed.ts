import { PrismaClient, type Position } from "@prisma/client";
import {
  generatePlayerAttributes,
  classYearForExperience,
  randomYearsPro,
  ageForYearsPro,
  randomInt,
  ROSTER_COMPOSITION,
} from "../lib/simulation/player-generator";
import { calculateTeamRatings, type RatedPlayer } from "../lib/simulation/team-ratings";
import { generateRoundRobinSchedule } from "../lib/simulation/schedule";

const prisma = new PrismaClient();

interface TeamSeed {
  name: string;
  abbreviation: string;
  city: string;
  state: string;
  primaryColor: string;
  secondaryColor: string;
  quality: number;
}

const TEAMS: TeamSeed[] = [
  { name: "Delaware Storm", abbreviation: "DLS", city: "Wilmington", state: "DE", primaryColor: "#0EA5E9", secondaryColor: "#0F172A", quality: 78 },
  { name: "Jersey Iron", abbreviation: "JYI", city: "Trenton", state: "NJ", primaryColor: "#94A3B8", secondaryColor: "#1E293B", quality: 74 },
  { name: "Atlanta Firebirds", abbreviation: "ATF", city: "Atlanta", state: "GA", primaryColor: "#F97316", secondaryColor: "#7C2D12", quality: 82 },
  { name: "Orlando Rockets", abbreviation: "ORR", city: "Orlando", state: "FL", primaryColor: "#6366F1", secondaryColor: "#1E1B4B", quality: 80 },
  { name: "Chicago Frost", abbreviation: "CHF", city: "Chicago", state: "IL", primaryColor: "#38BDF8", secondaryColor: "#0C4A6E", quality: 76 },
  { name: "Seattle Voltage", abbreviation: "SEV", city: "Seattle", state: "WA", primaryColor: "#22C55E", secondaryColor: "#052E16", quality: 79 },
  { name: "Houston Copperheads", abbreviation: "HOC", city: "Houston", state: "TX", primaryColor: "#B45309", secondaryColor: "#1C1917", quality: 77 },
  { name: "Philadelphia Founders", abbreviation: "PHF", city: "Philadelphia", state: "PA", primaryColor: "#EF4444", secondaryColor: "#1E293B", quality: 81 },
];

async function main() {
  console.log("Seeding Gridiron Franchise fictional league...");

  await prisma.gamePlay.deleteMany();
  await prisma.gamePlayerStats.deleteMany();
  await prisma.gameTeamStats.deleteMany();
  await prisma.game.deleteMany();
  await prisma.standing.deleteMany();
  await prisma.seasonTeam.deleteMany();
  await prisma.season.deleteMany();
  await prisma.depthChart.deleteMany();
  await prisma.playerRating.deleteMany();
  await prisma.player.deleteMany();
  await prisma.team.deleteMany();
  await prisma.league.deleteMany();

  const league = await prisma.league.create({
    data: {
      name: "Gridiron Franchise League",
      description: "An original, fictional football league built for the Gridiron Franchise simulator.",
    },
  });

  const usedNames = new Set<string>();

  for (const teamSeed of TEAMS) {
    const team = await prisma.team.create({
      data: {
        leagueId: league.id,
        name: teamSeed.name,
        abbreviation: teamSeed.abbreviation,
        city: teamSeed.city,
        state: teamSeed.state,
        primaryColor: teamSeed.primaryColor,
        secondaryColor: teamSeed.secondaryColor,
      },
    });

    const ratedPlayers: RatedPlayer[] = [];

    for (const slot of ROSTER_COMPOSITION) {
      for (let i = 0; i < slot.count; i++) {
        const attrs = generatePlayerAttributes(slot.position, teamSeed.quality, usedNames);
        const yearsPro = randomYearsPro();
        const age = ageForYearsPro(yearsPro);

        const player = await prisma.player.create({
          data: {
            teamId: team.id,
            firstName: attrs.firstName,
            lastName: attrs.lastName,
            jerseyNumber: randomInt(0, 99),
            position: slot.position,
            height: attrs.height,
            weight: attrs.weight,
            classYear: classYearForExperience(yearsPro),
            hometown: attrs.hometown,
            archetype: attrs.archetype,
            overall: attrs.overall,
            age,
            yearsPro,
            ratings: {
              create: Object.entries(attrs.ratings).map(([ratingName, ratingValue]) => ({
                ratingName,
                ratingValue,
              })),
            },
          },
        });

        ratedPlayers.push({
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          overall: player.overall,
        });
      }
    }

    // Fix jersey collisions within a team by reassigning sequentially where needed.
    const teamPlayers = await prisma.player.findMany({ where: { teamId: team.id } });
    const seenJerseys = new Set<number>();
    for (const p of teamPlayers) {
      let jersey = p.jerseyNumber;
      while (seenJerseys.has(jersey)) {
        jersey = randomInt(0, 99);
      }
      seenJerseys.add(jersey);
      if (jersey !== p.jerseyNumber) {
        await prisma.player.update({ where: { id: p.id }, data: { jerseyNumber: jersey } });
      }
    }

    const teamRatings = calculateTeamRatings(ratedPlayers);
    await prisma.team.update({
      where: { id: team.id },
      data: {
        overallRating: teamRatings.overallRating,
        offenseRating: teamRatings.offenseRating,
        defenseRating: teamRatings.defenseRating,
        specialTeamsRating: teamRatings.specialTeamsRating,
      },
    });

    // Seed a basic depth chart: top player per position as starter, next two as backups.
    const byPosition = new Map<Position, RatedPlayer[]>();
    for (const p of ratedPlayers) {
      const list = byPosition.get(p.position) ?? [];
      list.push(p);
      byPosition.set(p.position, list);
    }
    for (const [position, players] of byPosition.entries()) {
      const sorted = [...players].sort((a, b) => b.overall - a.overall);
      await prisma.depthChart.create({
        data: {
          teamId: team.id,
          position,
          starterPlayerId: sorted[0]?.id,
          backup1PlayerId: sorted[1]?.id,
          backup2PlayerId: sorted[2]?.id,
        },
      });
    }

    console.log(`  Seeded ${teamSeed.name} (${teamPlayers.length} players, OVR ${teamRatings.overallRating})`);
  }

  const allTeams = await prisma.team.findMany();
  const schedule = generateRoundRobinSchedule(allTeams.map((t) => t.id));
  const totalWeeks = Math.max(...schedule.map((m) => m.week));

  const season = await prisma.season.create({
    data: {
      leagueId: league.id,
      name: "Season 1",
      year: new Date().getFullYear(),
      status: "NOT_STARTED",
      currentWeek: 0,
      totalWeeks,
      seasonTeams: { create: allTeams.map((t) => ({ teamId: t.id })) },
      standings: {
        create: allTeams.map((t) => ({
          teamId: t.id,
          division: t.state === "DE" || t.state === "NJ" || t.state === "PA" ? "Atlantic" : "Frontier",
        })),
      },
      games: {
        create: schedule.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          week: m.week,
          status: "SCHEDULED",
        })),
      },
    },
  });

  console.log(
    `Seeded league "${league.name}" with ${allTeams.length} teams and "${season.name}" (${schedule.length} games across ${totalWeeks} weeks).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
