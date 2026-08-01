import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const teams = await prisma.team.findMany({
    where: { leagueId: league.id },
    include: {
      _count: { select: { players: { where: { retired: false } } } },
    },
    orderBy: { overallRating: "desc" },
  });

  const latestSeason = await prisma.season.findFirst({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
  });
  const standings = latestSeason
    ? await prisma.standing.findMany({ where: { seasonId: latestSeason.id } })
    : [];
  const standingByTeam = new Map(standings.map((s) => [s.teamId, s]));

  const payload = teams.map((team) => {
    const standing = standingByTeam.get(team.id);
    return {
      id: team.id,
      name: team.name,
      abbreviation: team.abbreviation,
      city: team.city,
      state: team.state,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor,
      overallRating: team.overallRating,
      offenseRating: team.offenseRating,
      defenseRating: team.defenseRating,
      specialTeamsRating: team.specialTeamsRating,
      rosterSize: team._count.players,
      wins: standing?.wins ?? 0,
      losses: standing?.losses ?? 0,
      ties: standing?.ties ?? 0,
    };
  });

  return NextResponse.json({ teams: payload, seasonId: latestSeason?.id ?? null });
}
