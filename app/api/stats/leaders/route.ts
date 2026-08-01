import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { getStatLeaders } from "@/lib/stats/leaders";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId") ?? undefined;

  if (seasonId) {
    const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } });
    if (!season) {
      return NextResponse.json({ error: "Season not found" }, { status: 404 });
    }
  }

  const leaders = await getStatLeaders(league.id, seasonId);
  return NextResponse.json(leaders);
}
