import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const games = await prisma.game.findMany({
    where: {
      homeTeam: { leagueId: league.id },
      ...(seasonId ? { seasonId } : {}),
    },
    include: {
      homeTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
      awayTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
    },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ games });
}
