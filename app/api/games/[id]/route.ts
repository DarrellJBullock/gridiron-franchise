import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
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
