import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { runPlayoffs, getExistingBracket } from "@/lib/simulation/playoffs";

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
    const bracket = await runPlayoffs(body.seasonId);
    return NextResponse.json(bracket);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  if (!seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  const season = await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } });
  if (!season) {
    return NextResponse.json({ error: "Season not found" }, { status: 404 });
  }

  const bracket = await getExistingBracket(seasonId);
  return NextResponse.json({ bracket });
}
