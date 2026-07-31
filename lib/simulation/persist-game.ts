import { prisma } from "@/lib/prisma";
import type { SimulatedGameResult } from "@/types/football";

interface PersistGameInput {
  homeTeamId: string;
  awayTeamId: string;
  seasonId?: string;
  week: number;
  result: SimulatedGameResult;
  gameId?: string;
}

export async function persistSimulatedGame({ homeTeamId, awayTeamId, seasonId, week, result, gameId }: PersistGameInput) {
  const sharedData = {
    homeScore: result.homeScore,
    awayScore: result.awayScore,
    status: "FINAL" as const,
    summary: result.summary,
    turningPoint: result.turningPoint,
    playStyleSummary: result.playStyleSummary,
    homeQuarterScores: result.quarterScores.home,
    awayQuarterScores: result.quarterScores.away,
  };

  const game = gameId
    ? await prisma.game.update({ where: { id: gameId }, data: sharedData })
    : await prisma.game.create({
        data: { seasonId, homeTeamId, awayTeamId, week, ...sharedData },
      });

  await prisma.gameTeamStats.createMany({
    data: [
      { gameId: game.id, teamId: homeTeamId, ...result.homeStats },
      { gameId: game.id, teamId: awayTeamId, ...result.awayStats },
    ],
  });

  if (result.playerStats.length > 0) {
    await prisma.gamePlayerStats.createMany({
      data: result.playerStats.map((line) => ({
        gameId: game.id,
        playerId: line.playerId,
        passingYards: line.passingYards ?? 0,
        passingTouchdowns: line.passingTouchdowns ?? 0,
        interceptions: line.interceptions ?? 0,
        rushingYards: line.rushingYards ?? 0,
        rushingTouchdowns: line.rushingTouchdowns ?? 0,
        receivingYards: line.receivingYards ?? 0,
        receivingTouchdowns: line.receivingTouchdowns ?? 0,
        tackles: line.tackles ?? 0,
        sacks: line.sacks ?? 0,
        forcedFumbles: line.forcedFumbles ?? 0,
        fieldGoalsMade: line.fieldGoalsMade ?? 0,
      })),
    });
  }

  if (result.plays.length > 0) {
    await prisma.gamePlay.createMany({
      data: result.plays.map((play) => ({
        gameId: game.id,
        sequence: play.sequence,
        quarter: play.quarter,
        driveNumber: play.driveNumber,
        offenseAbbr: play.offenseAbbr,
        down: play.down,
        distance: play.distance,
        yardLine: play.yardLine,
        playType: play.playType,
        description: play.description,
        yards: play.yards,
        isScoring: play.isScoring,
        isTurnover: play.isTurnover,
      })),
    });
  }

  if (seasonId) {
    await updateStandingsForGame(seasonId, homeTeamId, awayTeamId, result.homeScore, result.awayScore);
  }

  return game;
}

async function updateStandingsForGame(
  seasonId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number
) {
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const tie = homeScore === awayScore;

  await applyStandingResult(seasonId, homeTeamId, homeScore, awayScore, homeWon, awayWon, tie);
  await applyStandingResult(seasonId, awayTeamId, awayScore, homeScore, awayWon, homeWon, tie);
}

async function applyStandingResult(
  seasonId: string,
  teamId: string,
  pointsFor: number,
  pointsAgainst: number,
  won: boolean,
  lost: boolean,
  tie: boolean
) {
  const standing = await prisma.standing.upsert({
    where: { seasonId_teamId: { seasonId, teamId } },
    update: {},
    create: { seasonId, teamId },
  });

  const streakChar = won ? "W" : lost ? "L" : "T";
  const currentStreakChar = standing.streak?.[0];
  const currentStreakCount = Number(standing.streak?.slice(1) || 0);
  const newStreak =
    currentStreakChar === streakChar ? `${streakChar}${currentStreakCount + 1}` : `${streakChar}1`;

  await prisma.standing.update({
    where: { seasonId_teamId: { seasonId, teamId } },
    data: {
      wins: { increment: won ? 1 : 0 },
      losses: { increment: lost ? 1 : 0 },
      ties: { increment: tie ? 1 : 0 },
      pointsFor: { increment: pointsFor },
      pointsAgainst: { increment: pointsAgainst },
      streak: newStreak,
    },
  });
}
