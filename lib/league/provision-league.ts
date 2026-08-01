import { randomUUID } from "crypto";
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

// Round-robin games-per-team = (team count) - 1, so a clean N-team league
// (no bye weeks) needs an even team count. 18 teams -> a 17-game season.
export const TEAM_TEMPLATES: TeamTemplate[] = [
  { name: "Delaware Storm", abbreviation: "DLS", city: "Wilmington", state: "DE", primaryColor: "#0EA5E9", secondaryColor: "#0F172A", quality: 78 },
  { name: "Jersey Iron", abbreviation: "JYI", city: "Trenton", state: "NJ", primaryColor: "#94A3B8", secondaryColor: "#1E293B", quality: 74 },
  { name: "Atlanta Firebirds", abbreviation: "ATF", city: "Atlanta", state: "GA", primaryColor: "#F97316", secondaryColor: "#7C2D12", quality: 82 },
  { name: "Orlando Rockets", abbreviation: "ORR", city: "Orlando", state: "FL", primaryColor: "#6366F1", secondaryColor: "#1E1B4B", quality: 80 },
  { name: "Chicago Frost", abbreviation: "CHF", city: "Chicago", state: "IL", primaryColor: "#38BDF8", secondaryColor: "#0C4A6E", quality: 76 },
  { name: "Seattle Voltage", abbreviation: "SEV", city: "Seattle", state: "WA", primaryColor: "#22C55E", secondaryColor: "#052E16", quality: 79 },
  { name: "Houston Copperheads", abbreviation: "HOC", city: "Houston", state: "TX", primaryColor: "#B45309", secondaryColor: "#1C1917", quality: 77 },
  { name: "Philadelphia Founders", abbreviation: "PHF", city: "Philadelphia", state: "PA", primaryColor: "#EF4444", secondaryColor: "#1E293B", quality: 81 },
  { name: "Denver Blaze", abbreviation: "DNB", city: "Denver", state: "CO", primaryColor: "#DC2626", secondaryColor: "#1C1917", quality: 80 },
  { name: "Phoenix Vipers", abbreviation: "PXV", city: "Phoenix", state: "AZ", primaryColor: "#EA580C", secondaryColor: "#422006", quality: 75 },
  { name: "Nashville Ironclads", abbreviation: "NVI", city: "Nashville", state: "TN", primaryColor: "#78716C", secondaryColor: "#1C1917", quality: 78 },
  { name: "Portland Cascade", abbreviation: "POR", city: "Portland", state: "OR", primaryColor: "#16A34A", secondaryColor: "#052E16", quality: 77 },
  { name: "Austin Renegades", abbreviation: "AUR", city: "Austin", state: "TX", primaryColor: "#F59E0B", secondaryColor: "#451A03", quality: 81 },
  { name: "Charlotte Sentinels", abbreviation: "CLS", city: "Charlotte", state: "NC", primaryColor: "#2563EB", secondaryColor: "#0F172A", quality: 76 },
  { name: "Detroit Forge", abbreviation: "DET", city: "Detroit", state: "MI", primaryColor: "#EA580C", secondaryColor: "#1C1917", quality: 79 },
  { name: "Minneapolis Blizzard", abbreviation: "MPB", city: "Minneapolis", state: "MN", primaryColor: "#0EA5E9", secondaryColor: "#0C4A6E", quality: 74 },
  { name: "Sacramento Miners", abbreviation: "SAM", city: "Sacramento", state: "CA", primaryColor: "#CA8A04", secondaryColor: "#422006", quality: 83 },
  { name: "Providence Privateers", abbreviation: "PRP", city: "Providence", state: "RI", primaryColor: "#7C3AED", secondaryColor: "#1E1B4B", quality: 78 },
];

interface GeneratedTeamData {
  playerRows: {
    id: string;
    teamId: string;
    firstName: string;
    lastName: string;
    jerseyNumber: number;
    position: Position;
    height: number;
    weight: number;
    classYear: string;
    hometown: string;
    archetype: string;
    overall: number;
    age: number;
    yearsPro: number;
  }[];
  ratingRows: { id: string; playerId: string; ratingName: string; ratingValue: number }[];
  depthChartRows: {
    id: string;
    teamId: string;
    position: Position;
    starterPlayerId: string | undefined;
    backup1PlayerId: string | undefined;
    backup2PlayerId: string | undefined;
  }[];
  teamRatingUpdate: { id: string; overallRating: number; offenseRating: number; defenseRating: number; specialTeamsRating: number };
}

/** Generates a full roster (players, ratings, depth chart) for one team, in memory. */
function generateTeamRoster(teamId: string, quality: number, usedNames: Set<string>): GeneratedTeamData {
  const ratedPlayers: RatedPlayer[] = [];
  const usedJerseys = new Set<number>();
  const playerRows: GeneratedTeamData["playerRows"] = [];
  const ratingRows: GeneratedTeamData["ratingRows"] = [];

  for (const slot of ROSTER_COMPOSITION) {
    for (let i = 0; i < slot.count; i++) {
      const attrs = generatePlayerAttributes(slot.position, quality, usedNames);
      const yearsPro = randomYearsPro();
      const age = ageForYearsPro(yearsPro);
      const playerId = randomUUID();

      let jersey = randomInt(0, 99);
      while (usedJerseys.has(jersey)) {
        jersey = randomInt(0, 99);
      }
      usedJerseys.add(jersey);

      playerRows.push({
        id: playerId,
        teamId,
        firstName: attrs.firstName,
        lastName: attrs.lastName,
        jerseyNumber: jersey,
        position: slot.position,
        height: attrs.height,
        weight: attrs.weight,
        classYear: classYearForExperience(yearsPro),
        hometown: attrs.hometown,
        archetype: attrs.archetype,
        overall: attrs.overall,
        age,
        yearsPro,
      });

      for (const [ratingName, ratingValue] of Object.entries(attrs.ratings)) {
        ratingRows.push({ id: randomUUID(), playerId, ratingName, ratingValue });
      }

      ratedPlayers.push({
        id: playerId,
        firstName: attrs.firstName,
        lastName: attrs.lastName,
        position: slot.position,
        overall: attrs.overall,
      });
    }
  }

  const teamRatings = calculateTeamRatings(ratedPlayers);
  const depthChartRows: GeneratedTeamData["depthChartRows"] = [];
  const byPosition = new Map<Position, RatedPlayer[]>();
  for (const p of ratedPlayers) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }
  for (const [position, players] of byPosition.entries()) {
    const sorted = [...players].sort((a, b) => b.overall - a.overall);
    depthChartRows.push({
      id: randomUUID(),
      teamId,
      position,
      starterPlayerId: sorted[0]?.id,
      backup1PlayerId: sorted[1]?.id,
      backup2PlayerId: sorted[2]?.id,
    });
  }

  return {
    playerRows,
    ratingRows,
    depthChartRows,
    teamRatingUpdate: { id: teamId, ...teamRatings },
  };
}

/**
 * Generates a full fictional league (teams, rosters, depth charts, a
 * round-robin season schedule) owned by the given user. Shared by the CLI
 * seed script and first-sign-in auto-provisioning so both paths produce
 * identical league content.
 *
 * Everything is built in memory first and written with bulk createMany
 * calls inside one transaction: a single sequential await-per-row version
 * of this (~500+ round trips) took 60-70s against Neon and, worse, left a
 * half-built league (and Team/Player rows) visible to any concurrent
 * request that queried League.ownerId in the meantime. The transaction
 * means other queries see either no league or a complete one, never a
 * partial one.
 */
export async function provisionLeagueForOwner(ownerId: string, client: PrismaClient = defaultPrisma) {
  return client.$transaction(
    async (tx) => {
      const league = await tx.league.create({
        data: {
          ownerId,
          name: "Gridiron Franchise League",
          description: "An original, fictional football league built for the Gridiron Franchise simulator.",
        },
      });

      const teamRows = TEAM_TEMPLATES.map((t) => ({
        id: randomUUID(),
        leagueId: league.id,
        name: t.name,
        abbreviation: t.abbreviation,
        city: t.city,
        state: t.state,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
      }));
      await tx.team.createMany({ data: teamRows });

      const usedNames = new Set<string>();
      const playerRows: GeneratedTeamData["playerRows"] = [];
      const ratingRows: GeneratedTeamData["ratingRows"] = [];
      const depthChartRows: GeneratedTeamData["depthChartRows"] = [];
      const teamRatingUpdates: GeneratedTeamData["teamRatingUpdate"][] = [];

      TEAM_TEMPLATES.forEach((teamTemplate, teamIndex) => {
        const generated = generateTeamRoster(teamRows[teamIndex].id, teamTemplate.quality, usedNames);
        playerRows.push(...generated.playerRows);
        ratingRows.push(...generated.ratingRows);
        depthChartRows.push(...generated.depthChartRows);
        teamRatingUpdates.push(generated.teamRatingUpdate);
      });

      await tx.player.createMany({ data: playerRows });
      await tx.playerRating.createMany({ data: ratingRows });
      await tx.depthChart.createMany({ data: depthChartRows });

      for (const update of teamRatingUpdates) {
        await tx.team.update({
          where: { id: update.id },
          data: {
            overallRating: update.overallRating,
            offenseRating: update.offenseRating,
            defenseRating: update.defenseRating,
            specialTeamsRating: update.specialTeamsRating,
          },
        });
      }

      const schedule = generateRoundRobinSchedule(teamRows.map((t) => t.id));
      const totalWeeks = Math.max(...schedule.map((m) => m.week));

      await tx.season.create({
        data: {
          leagueId: league.id,
          name: "Season 1",
          year: new Date().getFullYear(),
          status: "NOT_STARTED",
          currentWeek: 0,
          totalWeeks,
          seasonTeams: { create: teamRows.map((t) => ({ teamId: t.id })) },
          standings: {
            create: teamRows.map((t) => ({
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
    },
    { timeout: 30_000, maxWait: 10_000 }
  );
}

/**
 * Adds fully-rostered teams (players, ratings, depth chart) to an existing
 * league. Does not touch any season/schedule — a team added this way only
 * appears in seasons created after it joins the league, same as a team
 * created via roster upload.
 */
export async function addTeamsToLeague(leagueId: string, templates: TeamTemplate[], client: PrismaClient = defaultPrisma) {
  return client.$transaction(
    async (tx) => {
      const teamRows = templates.map((t) => ({
        id: randomUUID(),
        leagueId,
        name: t.name,
        abbreviation: t.abbreviation,
        city: t.city,
        state: t.state,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
      }));
      await tx.team.createMany({ data: teamRows });

      const usedNames = new Set<string>();
      const playerRows: GeneratedTeamData["playerRows"] = [];
      const ratingRows: GeneratedTeamData["ratingRows"] = [];
      const depthChartRows: GeneratedTeamData["depthChartRows"] = [];
      const teamRatingUpdates: GeneratedTeamData["teamRatingUpdate"][] = [];

      templates.forEach((template, index) => {
        const generated = generateTeamRoster(teamRows[index].id, template.quality, usedNames);
        playerRows.push(...generated.playerRows);
        ratingRows.push(...generated.ratingRows);
        depthChartRows.push(...generated.depthChartRows);
        teamRatingUpdates.push(generated.teamRatingUpdate);
      });

      await tx.player.createMany({ data: playerRows });
      await tx.playerRating.createMany({ data: ratingRows });
      await tx.depthChart.createMany({ data: depthChartRows });

      for (const update of teamRatingUpdates) {
        await tx.team.update({
          where: { id: update.id },
          data: {
            overallRating: update.overallRating,
            offenseRating: update.offenseRating,
            defenseRating: update.defenseRating,
            specialTeamsRating: update.specialTeamsRating,
          },
        });
      }

      return teamRows;
    },
    { timeout: 30_000, maxWait: 10_000 }
  );
}
