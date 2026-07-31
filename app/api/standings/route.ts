import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const season = seasonId
    ? await prisma.season.findUnique({ where: { id: seasonId } })
    : await prisma.season.findFirst({ orderBy: { createdAt: "desc" } });

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
