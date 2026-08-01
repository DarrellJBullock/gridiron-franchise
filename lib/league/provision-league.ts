import type { PrismaClient, Position } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import {
  generatePlayerAttributes,
  classYearForExperience,
  randomYearsPro,
  ageForYearsPro,
  randomInt,
  ROSTER_COMPOSITION,
} from "@/lib/simulation/player-generator";
import { calculateTeamRatings, type RatedPlayer } from "@/lib/simulation/team-ratings";
import { generateRoundRobinSchedule } from "@/lib/simulation/schedule";

interface TeamTemplate {
  name: string;
  abbreviation: string;
  city: string;
  state: string;
  primaryColor: string;
  secondaryColor: string;
  quality: number;
}

export const TEAM_TEMPLATES: TeamTemplate[] = [
  { name: "Delaware Storm", abbreviation: "DLS", city: "Wilmington", state: "DE", primaryColor: "#0EA5E9", secondaryColor: "#0F172A", quality: 78 },
  { name: "Jersey Iron", abbreviation: "JYI", city: "Trenton", state: "NJ", primaryColor: "#94A3B8", secondaryColor: "#1E293B", quality: 74 },
  { name: "Atlanta Firebirds", abbreviation: "ATF", city: "Atlanta", state: "GA", primaryColor: "#F97316", secondaryColor: "#7C2D12", quality: 82 },
  { name: "Orlando Rockets", abbreviation: "ORR", city: "Orlando", state: "FL", primaryColor: "#6366F1", secondaryColor: "#1E1B4B", quality: 80 },
  { name: "Chicago Frost", abbreviation: "CHF", city: "Chicago", state: "IL", primaryColor: "#38BDF8", secondaryColor: "#0C4A6E", quality: 76 },
  { name: "Seattle Voltage", abbreviation: "SEV", city: "Seattle", state: "WA", primaryColor: "#22C55E", secondaryColor: "#052E16", quality: 79 },
  { name: "Houston Copperheads", abbreviation: "HOC", city: "Houston", state: "TX", primaryColor: "#B45309", secondaryColor: "#1C1917", quality: 77 },
  { name: "Philadelphia Founders", abbreviation: "PHF", city: "Philadelphia", state: "PA", primaryColor: "#EF4444", secondaryColor: "#1E293B", quality: 81 },
];

/**
 * Generates a full fictional league (teams, rosters, depth charts, a
 * round-robin season schedule) owned by the given user. Shared by the CLI
 * seed script and first-sign-in auto-provisioning so both paths produce
 * identical league content.
 */
export async function provisionLeagueForOwner(ownerId: string, client: PrismaClient = defaultPrisma) {
  const league = await client.league.create({
    data: {
      ownerId,
      name: "Gridiron Franchise League",
      description: "An original, fictional football league built for the Gridiron Franchise simulator.",
    },
  });

  const usedNames = new Set<string>();

  for (const teamTemplate of TEAM_TEMPLATES) {
    const team = await client.team.create({
      data: {
        leagueId: league.id,
        name: teamTemplate.name,
        abbreviation: teamTemplate.abbreviation,
        city: teamTemplate.city,
        state: teamTemplate.state,
        primaryColor: teamTemplate.primaryColor,
        secondaryColor: teamTemplate.secondaryColor,
      },
    });

    const ratedPlayers: RatedPlayer[] = [];

    for (const slot of ROSTER_COMPOSITION) {
      for (let i = 0; i < slot.count; i++) {
        const attrs = generatePlayerAttributes(slot.position, teamTemplate.quality, usedNames);
        const yearsPro = randomYearsPro();
        const age = ageForYearsPro(yearsPro);

        const player = await client.player.create({
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
    const teamPlayers = await client.player.findMany({ where: { teamId: team.id } });
    const seenJerseys = new Set<number>();
    for (const p of teamPlayers) {
      let jersey = p.jerseyNumber;
      while (seenJerseys.has(jersey)) {
        jersey = randomInt(0, 99);
      }
      seenJerseys.add(jersey);
      if (jersey !== p.jerseyNumber) {
        await client.player.update({ where: { id: p.id }, data: { jerseyNumber: jersey } });
      }
    }

    const teamRatings = calculateTeamRatings(ratedPlayers);
    await client.team.update({
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
      await client.depthChart.create({
        data: {
          teamId: team.id,
          position,
          starterPlayerId: sorted[0]?.id,
          backup1PlayerId: sorted[1]?.id,
          backup2PlayerId: sorted[2]?.id,
        },
      });
    }
  }

  const allTeams = await client.team.findMany({ where: { leagueId: league.id } });
  const schedule = generateRoundRobinSchedule(allTeams.map((t) => t.id));
  const totalWeeks = Math.max(...schedule.map((m) => m.week));

  await client.season.create({
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

  return league;
}
