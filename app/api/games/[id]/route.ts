import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { simulateGame } from "@/lib/simulation/game-engine";
import { persistSimulatedGame } from "@/lib/simulation/persist-game";
import { toRatedPlayer } from "@/lib/football-mappers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const game = await prisma.game.findFirst({
    where: { id, homeTeam: { leagueId: league.id } },
    include: {
      homeTeam: true,
      awayTeam: true,
      teamStats: true,
      playerStats: {
        include: { player: true },
      },
      plays: {
        orderBy: { sequence: "asc" },
      },
      season: true,
    },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const homeStats = game.teamStats.find((s) => s.teamId === game.homeTeamId);
  const awayStats = game.teamStats.find((s) => s.teamId === game.awayTeamId);

  return NextResponse.json({ game, homeStats, awayStats });
}

/**
 * Simulates one specific SCHEDULED game (regular season or playoff) and
 * persists it in place — same result a bulk "Simulate Week" or "Run
 * Playoffs" call would produce for this matchup, just triggered for a
 * single game so the caller can animate it with LiveGamePlayer instead of
 * only seeing the instant final result.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const game = await prisma.game.findFirst({
    where: { id, homeTeam: { leagueId: league.id } },
    include: {
      homeTeam: { include: { players: { where: { retired: false }, include: { ratings: { where: { ratingName: "injury" } } } } } },
      awayTeam: { include: { players: { where: { retired: false }, include: { ratings: { where: { ratingName: "injury" } } } } } },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "SCHEDULED") {
    return NextResponse.json({ error: "This game has already been played." }, { status: 400 });
  }

  const result = simulateGame({
    homeTeamName: game.homeTeam.name,
    awayTeamName: game.awayTeam.name,
    homeTeamAbbr: game.homeTeam.abbreviation,
    awayTeamAbbr: game.awayTeam.abbreviation,
    homePlayers: game.homeTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
    awayPlayers: game.awayTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
  });

  await persistSimulatedGame({
    gameId: game.id,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    seasonId: game.seasonId ?? undefined,
    week: game.week,
    result,
    isPlayoff: game.isPlayoff,
    playoffRound: game.playoffRound ?? undefined,
    countsForStandings: !game.isPlayoff,
  });

  return NextResponse.json({ gameId: game.id, result });
}
