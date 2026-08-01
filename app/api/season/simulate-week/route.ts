import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { simulateSeasonWeek } from "@/lib/simulation/season-runner";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const body = (await req.json().catch(() => ({}))) as { seasonId?: string };
  if (!body.seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  const season = await prisma.season.findFirst({ where: { id: body.seasonId, leagueId: league.id } });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  try {
    const { season, gamesSimulated } = await simulateSeasonWeek(body.seasonId);
    return NextResponse.json({ season, gamesSimulated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
