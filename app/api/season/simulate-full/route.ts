import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { simulateSeasonWeek } from "@/lib/simulation/season-runner";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seasonId?: string };
  if (!body.seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
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
