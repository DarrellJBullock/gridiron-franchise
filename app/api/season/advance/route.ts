import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { advanceFranchise } from "@/lib/simulation/franchise-progression";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seasonId?: string };
  if (!body.seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  const season = await prisma.season.findUnique({ where: { id: body.seasonId } });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  try {
    const result = await advanceFranchise(season.leagueId);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
