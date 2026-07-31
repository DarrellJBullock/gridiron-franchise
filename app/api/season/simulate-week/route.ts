import { NextResponse } from "next/server";
import { simulateSeasonWeek } from "@/lib/simulation/season-runner";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seasonId?: string };
  if (!body.seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  try {
    const { season, gamesSimulated } = await simulateSeasonWeek(body.seasonId);
    return NextResponse.json({ season, gamesSimulated });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
