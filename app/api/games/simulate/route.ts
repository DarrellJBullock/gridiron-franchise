import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  const body = (await req.json()) as SimulateBody;
  if (!body.homeTeamId || !body.awayTeamId || body.homeTeamId === body.awayTeamId) {
    return NextResponse.json({ error: "Two distinct teams are required" }, { status: 400 });
  }

  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: body.homeTeamId }, include: { players: true } }),
    prisma.team.findUnique({ where: { id: body.awayTeamId }, include: { players: true } }),
  ]);

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const result = simulateGame({
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
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
