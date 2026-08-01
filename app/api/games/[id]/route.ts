import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";

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
