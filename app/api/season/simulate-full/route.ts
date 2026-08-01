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

  const owningSeason = await prisma.season.findFirst({ where: { id: body.seasonId, leagueId: league.id } });
  if (!owningSeason) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  let totalGamesSimulated = 0;
  let weeksSimulated = 0;
  const maxIterations = 32;

  for (let i = 0; i < maxIterations; i++) {
    const season = await prisma.season.findUnique({ where: { id: body.seasonId } });
    if (!season || season.status === "COMPLETED") break;

    const { gamesSimulated } = await simulateSeasonWeek(body.seasonId);
    totalGamesSimulated += gamesSimulated;
    weeksSimulated += 1;
    if (gamesSimulated === 0 && weeksSimulated > 1) break;
  }

  const finalSeason = await prisma.season.findUnique({ where: { id: body.seasonId } });
  return NextResponse.json({ season: finalSeason, weeksSimulated, gamesSimulated: totalGamesSimulated });
}
