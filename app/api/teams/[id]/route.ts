import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { calculateTeamStrengths } from "@/lib/simulation/team-ratings";
import { toRatedPlayer } from "@/lib/football-mappers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const team = await prisma.team.findFirst({
    where: { id, leagueId: league.id },
    include: {
      players: { where: { retired: false }, orderBy: { overall: "desc" } },
      depthCharts: {
        include: { starter: true, backup1: true, backup2: true },
      },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const ratedPlayers = team.players.map(toRatedPlayer);
  const strengths = calculateTeamStrengths(ratedPlayers);

  const latestSeason = await prisma.season.findFirst({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
  });
  const standing = latestSeason
    ? await prisma.standing.findUnique({
        where: { seasonId_teamId: { seasonId: latestSeason.id, teamId: team.id } },
      })
    : null;

  return NextResponse.json({
    team: {
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
    },
    record: standing
      ? { wins: standing.wins, losses: standing.losses, ties: standing.ties }
      : { wins: 0, losses: 0, ties: 0 },
    players: team.players,
    depthCharts: team.depthCharts,
    strengths: strengths.strengths,
    weaknesses: strengths.weaknesses,
    topPlayers: team.players.slice(0, 5),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const team = await prisma.team.findFirst({ where: { id, leagueId: league.id } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Games reference Team without cascade, so they have to go before the team
  // itself; everything else (players, depth charts, standings, season-team
  // links) cascades from the Team delete.
  await prisma.game.deleteMany({ where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] } });
  await prisma.team.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
