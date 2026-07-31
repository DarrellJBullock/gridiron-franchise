import { prisma } from "@/lib/prisma";
import { simulateGame } from "./game-engine";
import { persistSimulatedGame } from "./persist-game";
import { toRatedPlayer } from "@/lib/football-mappers";

export async function simulateSeasonWeek(seasonId: string) {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found");
  if (season.status === "COMPLETED") return { season, gamesSimulated: 0 };

  const nextWeek = season.currentWeek + 1;
  const scheduledGames = await prisma.game.findMany({
    where: { seasonId, week: nextWeek, status: "SCHEDULED" },
    include: {
      homeTeam: { include: { players: { where: { retired: false } } } },
      awayTeam: { include: { players: { where: { retired: false } } } },
    },
  });

  for (const game of scheduledGames) {
    const result = simulateGame({
      homeTeamName: game.homeTeam.name,
      awayTeamName: game.awayTeam.name,
      homeTeamAbbr: game.homeTeam.abbreviation,
      awayTeamAbbr: game.awayTeam.abbreviation,
      homePlayers: game.homeTeam.players.map(toRatedPlayer),
      awayPlayers: game.awayTeam.players.map(toRatedPlayer),
    });
    await persistSimulatedGame({
      gameId: game.id,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      seasonId,
      week: nextWeek,
      result,
    });
  }

  const remainingWeeks = await prisma.game.count({
    where: { seasonId, week: { gt: nextWeek }, status: "SCHEDULED" },
  });

  const updatedSeason = await prisma.season.update({
    where: { id: seasonId },
    data: {
      currentWeek: nextWeek,
      status: nextWeek >= season.totalWeeks && remainingWeeks === 0 ? "COMPLETED" : "IN_PROGRESS",
    },
  });

  return { season: updatedSeason, gamesSimulated: scheduledGames.length };
}
