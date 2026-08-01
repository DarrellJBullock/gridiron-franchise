import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { simulateGame } from "@/lib/simulation/game-engine";
import { toRatedPlayer } from "@/lib/football-mappers";
import { persistSimulatedGame } from "@/lib/simulation/persist-game";

interface SimulateBody {
  homeTeamId: string;
  awayTeamId: string;
  seasonId?: string;
  week?: number;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const body = (await req.json()) as SimulateBody;
  if (!body.homeTeamId || !body.awayTeamId || body.homeTeamId === body.awayTeamId) {
    return NextResponse.json({ error: "Two distinct teams are required" }, { status: 400 });
  }

  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findFirst({
      where: { id: body.homeTeamId, leagueId: league.id },
      include: { players: { where: { retired: false } } },
    }),
    prisma.team.findFirst({
      where: { id: body.awayTeamId, leagueId: league.id },
      include: { players: { where: { retired: false } } },
    }),
  ]);

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const result = simulateGame({
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeTeamAbbr: homeTeam.abbreviation,
    awayTeamAbbr: awayTeam.abbreviation,
    homePlayers: homeTeam.players.map(toRatedPlayer),
    awayPlayers: awayTeam.players.map(toRatedPlayer),
  });

  const game = await persistSimulatedGame({
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    seasonId: body.seasonId,
    week: body.week ?? 1,
    result,
  });

  return NextResponse.json({ gameId: game.id, result });
}
