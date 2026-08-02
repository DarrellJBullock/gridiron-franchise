import type { Position } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CORE_RATINGS, ratingGroupForPosition } from "@/types/football";
import {
  clamp,
  randomInt,
  generatePlayerAttributes,
  classYearForExperience,
  ageForYearsPro,
} from "./player-generator";
import { calculateTeamRatings, type RatedPlayer } from "./team-ratings";
import { generateRoundRobinSchedule } from "./schedule";

// Off-season progression: every active player ages a year, ratings drift up or
// down based on age, and some players retire and are replaced by rookies. This
// is what turns a single-season simulator into a multi-year franchise.

function ageDeltaRange(age: number): [number, number] {
  if (age <= 23) return [1, 4]; // still developing
  if (age <= 27) return [0, 2]; // prime years, mild growth
  if (age <= 30) return [-1, 1]; // plateau
  if (age <= 33) return [-3, -1]; // early decline
  return [-6, -2]; // steep decline
}

function retirementChance(age: number, overall: number): number {
  if (age >= 41) return 1;
  let chance = 0;
  if (age >= 30) chance += 0.05;
  if (age >= 32) chance += 0.1;
  if (age >= 34) chance += 0.2;
  if (age >= 36) chance += 0.25;
  if (age >= 38) chance += 0.3;
  if (age >= 27 && overall < 55) chance += 0.15;
  return Math.min(1, chance);
}

function progressRatings(position: Position, ratings: Record<string, number>, newAge: number) {
  const [minDelta, maxDelta] = ageDeltaRange(newAge);
  const updated: Record<string, number> = {};
  for (const [name, value] of Object.entries(ratings)) {
    updated[name] = clamp(value + randomInt(minDelta, maxDelta), 0, 99);
  }

  const positionGroup = ratingGroupForPosition(position);
  const coreNames = CORE_RATINGS.filter((r) => r !== "overall");
  const groupVals = positionGroup.map((n) => updated[n]).filter((v): v is number => v !== undefined);
  const coreVals = coreNames.map((n) => updated[n]).filter((v): v is number => v !== undefined);
  const groupAvg = groupVals.length ? groupVals.reduce((s, v) => s + v, 0) / groupVals.length : 50;
  const coreAvg = coreVals.length ? coreVals.reduce((s, v) => s + v, 0) / coreVals.length : 50;
  const overall = clamp(groupAvg * 0.6 + coreAvg * 0.4, 0, 99);

  return { ratings: updated, overall };
}

async function pickAvailableJersey(teamId: string): Promise<number> {
  const existing = await prisma.player.findMany({ where: { teamId }, select: { jerseyNumber: true } });
  const taken = new Set(existing.map((p) => p.jerseyNumber));
  let jersey = randomInt(0, 99);
  let attempts = 0;
  while (taken.has(jersey) && attempts < 200) {
    jersey = randomInt(0, 99);
    attempts++;
  }
  return jersey;
}

export interface FranchiseNote {
  name: string;
  position: Position;
  team: string;
  overall: number;
}

export interface AdvanceFranchiseResult {
  newSeasonId: string;
  newSeasonName: string;
  retiredCount: number;
  rookieCount: number;
  notableRetirements: FranchiseNote[];
  notableRookies: FranchiseNote[];
}

export async function advanceFranchise(leagueId: string): Promise<AdvanceFranchiseResult> {
  const latestSeason = await prisma.season.findFirst({
    where: { leagueId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestSeason) throw new Error("No season found for this league.");
  if (latestSeason.status !== "COMPLETED") {
    throw new Error("Complete the current season before advancing to the next one.");
  }

  const teams = await prisma.team.findMany({
    where: { leagueId },
    include: { players: { where: { retired: false }, include: { ratings: true } } },
  });

  const allNames = await prisma.player.findMany({ select: { firstName: true, lastName: true } });
  const usedNames = new Set(allNames.map((p) => `${p.firstName} ${p.lastName}`));

  let retiredCount = 0;
  let rookieCount = 0;
  const notableRetirements: FranchiseNote[] = [];
  const notableRookies: FranchiseNote[] = [];

  for (const team of teams) {
    for (const player of team.players) {
      const newAge = player.age + 1;
      const newYearsPro = player.yearsPro + 1;
      const retires = Math.random() < retirementChance(newAge, player.overall);

      if (retires) {
        await prisma.player.update({
          where: { id: player.id },
          data: { retired: true, retiredYear: latestSeason.year, age: newAge, yearsPro: newYearsPro },
        });
        retiredCount++;
        if (player.overall >= 85) {
          notableRetirements.push({
            name: `${player.firstName} ${player.lastName}`,
            position: player.position,
            team: team.name,
            overall: player.overall,
          });
        }

        const attrs = generatePlayerAttributes(player.position, team.overallRating, usedNames);
        const jerseyNumber = await pickAvailableJersey(team.id);
        const rookie = await prisma.player.create({
          data: {
            teamId: team.id,
            firstName: attrs.firstName,
            lastName: attrs.lastName,
            jerseyNumber,
            position: player.position,
            height: attrs.height,
            weight: attrs.weight,
            classYear: "Rookie",
            hometown: attrs.hometown,
            archetype: attrs.archetype,
            overall: attrs.overall,
            age: ageForYearsPro(0),
            yearsPro: 0,
            ratings: {
              create: Object.entries(attrs.ratings).map(([ratingName, ratingValue]) => ({
                ratingName,
                ratingValue,
              })),
            },
          },
        });
        rookieCount++;
        if (rookie.overall >= 80) {
          notableRookies.push({
            name: `${rookie.firstName} ${rookie.lastName}`,
            position: rookie.position,
            team: team.name,
            overall: rookie.overall,
          });
        }
      } else {
        const ratingsMap: Record<string, number> = {};
        for (const r of player.ratings) ratingsMap[r.ratingName] = r.ratingValue;
        const { ratings: newRatings, overall: newOverall } = progressRatings(player.position, ratingsMap, newAge);

        await prisma.player.update({
          where: { id: player.id },
          data: {
            age: newAge,
            yearsPro: newYearsPro,
            classYear: classYearForExperience(newYearsPro),
            overall: newOverall,
          },
        });
        for (const [ratingName, ratingValue] of Object.entries(newRatings)) {
          await prisma.playerRating.update({
            where: { playerId_ratingName: { playerId: player.id, ratingName } },
            data: { ratingValue },
          });
        }
      }
    }

    // Rebuild the depth chart from the refreshed, non-retired roster: best player per position starts.
    const refreshedPlayers = await prisma.player.findMany({ where: { teamId: team.id, retired: false } });
    const byPosition = new Map<Position, typeof refreshedPlayers>();
    for (const p of refreshedPlayers) {
      const list = byPosition.get(p.position) ?? [];
      list.push(p);
      byPosition.set(p.position, list);
    }
    for (const [position, positionPlayers] of byPosition.entries()) {
      const sorted = [...positionPlayers].sort((a, b) => b.overall - a.overall);
      await prisma.depthChart.upsert({
        where: { teamId_position: { teamId: team.id, position } },
        update: {
          starterPlayerId: sorted[0]?.id ?? null,
          backup1PlayerId: sorted[1]?.id ?? null,
          backup2PlayerId: sorted[2]?.id ?? null,
        },
        create: {
          teamId: team.id,
          position,
          starterPlayerId: sorted[0]?.id,
          backup1PlayerId: sorted[1]?.id,
          backup2PlayerId: sorted[2]?.id,
        },
      });
    }

    const ratedPlayers: RatedPlayer[] = refreshedPlayers.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      overall: p.overall,
    }));
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
  }

  const seasonCount = await prisma.season.count({ where: { leagueId } });
  const schedule = generateRoundRobinSchedule(teams.map((t) => t.id));
  const totalWeeks = Math.max(...schedule.map((m) => m.week));

  const newSeason = await prisma.season.create({
    data: {
      leagueId,
      name: `Season ${seasonCount + 1}`,
      year: latestSeason.year + 1,
      status: "NOT_STARTED",
      currentWeek: 0,
      totalWeeks,
      seasonTeams: { create: teams.map((t) => ({ teamId: t.id })) },
      standings: {
        create: teams.map((t) => ({
          teamId: t.id,
          division: t.division,
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

  await prisma.auditEvent.create({
    data: {
      eventType: "SEASON_ADVANCED",
      resourceType: "Season",
      resourceId: newSeason.id,
      message: `Advanced from ${latestSeason.name} to ${newSeason.name}: ${retiredCount} player(s) retired, ${rookieCount} rookie(s) drafted.`,
    },
  });

  return {
    newSeasonId: newSeason.id,
    newSeasonName: newSeason.name,
    retiredCount,
    rookieCount,
    notableRetirements,
    notableRookies,
  };
}
