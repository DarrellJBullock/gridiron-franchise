import { PrismaClient, type Position } from "@prisma/client";
import { FIRST_NAMES, LAST_NAMES, HOMETOWNS, CLASS_YEARS, ARCHETYPES } from "../data/seed-names";
import { ratingGroupForPosition, CORE_RATINGS } from "../types/football";
import { calculateTeamRatings, type RatedPlayer } from "../lib/simulation/team-ratings";
import { generateRoundRobinSchedule } from "../lib/simulation/schedule";

const prisma = new PrismaClient();

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(v)));
}

// Broad archetype adjustments so different position groups feel distinct
// (linemen strong and slow, corners fast and light, etc.).
const CORE_ADJUSTMENTS: Record<string, Partial<Record<(typeof CORE_RATINGS)[number], number>>> = {
  QB: { speed: -10, strength: -5, awareness: 10 },
  RB: { speed: 8, agility: 8, strength: 2 },
  FB: { strength: 10, speed: -8 },
  WR: { speed: 12, agility: 10, strength: -12 },
  TE: { strength: 4, speed: 0 },
  LT: { strength: 16, speed: -20 }, LG: { strength: 18, speed: -22 }, C: { strength: 14, speed: -20 },
  RG: { strength: 18, speed: -22 }, RT: { strength: 16, speed: -20 },
  LE: { strength: 10, speed: 4 }, RE: { strength: 10, speed: 4 }, DT: { strength: 18, speed: -14 },
  LOLB: { speed: 6, strength: 4 }, MLB: { strength: 8, awareness: 6 }, ROLB: { speed: 6, strength: 4 },
  CB: { speed: 14, agility: 12, strength: -14 },
  FS: { speed: 10, awareness: 8, strength: -8 }, SS: { strength: 4, speed: 6 },
  K: { strength: -10, speed: -15, awareness: 4 }, P: { strength: -10, speed: -15 },
};

function generateRatings(position: Position, teamQuality: number) {
  const isStar = Math.random() < 0.12;
  const base = clamp(teamQuality + randomInt(-14, 14) + (isStar ? randomInt(6, 14) : 0), 38, 99);

  const ratings: Record<string, number> = {};
  const adjustments = CORE_ADJUSTMENTS[position] ?? {};

  for (const stat of CORE_RATINGS) {
    if (stat === "overall") continue;
    const adj = adjustments[stat] ?? 0;
    ratings[stat] = clamp(base + adj + randomInt(-8, 8), 25, 99);
  }

  const positionGroup = ratingGroupForPosition(position);
  for (const stat of positionGroup) {
    ratings[stat] = clamp(base + randomInt(-6, 12), 30, 99);
  }

  const groupAvg =
    positionGroup.length > 0
      ? positionGroup.reduce((sum, s) => sum + ratings[s], 0) / positionGroup.length
      : base;
  const overall = clamp(groupAvg * 0.6 + base * 0.4, 35, 99);

  return { overall, ratings };
}

interface RosterSlot {
  position: Position;
  count: number;
}

const ROSTER_COMPOSITION: RosterSlot[] = [
  { position: "QB", count: 2 },
  { position: "RB", count: 3 },
  { position: "FB", count: 1 },
  { position: "WR", count: 5 },
  { position: "TE", count: 2 },
  { position: "LT", count: 2 },
  { position: "LG", count: 2 },
  { position: "C", count: 2 },
  { position: "RG", count: 2 },
  { position: "RT", count: 2 },
  { position: "LE", count: 2 },
  { position: "RE", count: 2 },
  { position: "DT", count: 2 },
  { position: "LOLB", count: 2 },
  { position: "MLB", count: 2 },
  { position: "ROLB", count: 2 },
  { position: "CB", count: 4 },
  { position: "FS", count: 2 },
  { position: "SS", count: 2 },
  { position: "K", count: 1 },
  { position: "P", count: 1 },
];

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

const HEIGHT_BY_GROUP: Record<string, [number, number]> = {
  QB: [72, 77], RB: [68, 72], FB: [70, 74], WR: [69, 75], TE: [74, 78],
  LT: [76, 80], LG: [75, 79], C: [74, 78], RG: [75, 79], RT: [76, 80],
  LE: [74, 78], RE: [74, 78], DT: [74, 78],
  LOLB: [72, 76], MLB: [72, 76], ROLB: [72, 76],
  CB: [69, 73], FS: [70, 74], SS: [70, 74], K: [69, 74], P: [70, 75],
};
const WEIGHT_BY_GROUP: Record<string, [number, number]> = {
  QB: [210, 235], RB: [195, 225], FB: [235, 255], WR: [175, 210], TE: [240, 260],
  LT: [305, 330], LG: [305, 335], C: [295, 320], RG: [305, 335], RT: [305, 330],
  LE: [255, 280], RE: [255, 280], DT: [300, 330],
  LOLB: [230, 255], MLB: [235, 260], ROLB: [230, 255],
  CB: [180, 200], FS: [190, 210], SS: [200, 220], K: [175, 200], P: [180, 205],
};

async function main() {
  console.log("Seeding Gridiron Franchise fictional league...");

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
        let fullName = "";
        let attempts = 0;
        do {
          fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
          attempts++;
        } while (usedNames.has(fullName) && attempts < 20);
        usedNames.add(fullName);
        const [firstName, lastName] = fullName.split(" ");

        const { overall, ratings } = generateRatings(slot.position, teamSeed.quality);
        const [hMin, hMax] = HEIGHT_BY_GROUP[slot.position] ?? [70, 76];
        const [wMin, wMax] = WEIGHT_BY_GROUP[slot.position] ?? [200, 250];

        const player = await prisma.player.create({
          data: {
            teamId: team.id,
            firstName,
            lastName,
            jerseyNumber: randomInt(0, 99),
            position: slot.position,
            height: randomInt(hMin, hMax),
            weight: randomInt(wMin, wMax),
            classYear: pick(CLASS_YEARS),
            hometown: pick(HOMETOWNS),
            archetype: pick(ARCHETYPES[slot.position] ?? ["Standard"]),
            overall: Math.round(overall),
            ratings: {
              create: Object.entries(ratings).map(([ratingName, ratingValue]) => ({
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
