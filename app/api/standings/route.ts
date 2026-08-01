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

  const season = seasonId
    ? await prisma.season.findFirst({ where: { id: seasonId, leagueId: league.id } })
    : await prisma.season.findFirst({ where: { leagueId: league.id }, orderBy: { createdAt: "desc" } });

  if (!season) {
    return NextResponse.json({ season: null, standings: [] });
  }

  const standings = await prisma.standing.findMany({
    where: { seasonId: season.id },
    include: { team: true },
  });

  return NextResponse.json({
    season,
    standings: standings.map((s) => ({
      teamId: s.teamId,
      teamName: s.team.name,
      abbreviation: s.team.abbreviation,
      primaryColor: s.team.primaryColor,
      secondaryColor: s.team.secondaryColor,
      conference: s.team.conference,
      division: s.division,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      streak: s.streak,
    })),
  });
}
