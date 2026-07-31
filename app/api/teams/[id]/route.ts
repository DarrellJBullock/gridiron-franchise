import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateTeamStrengths } from "@/lib/simulation/team-ratings";
import { toRatedPlayer } from "@/lib/football-mappers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const team = await prisma.team.findUnique({
    where: { id },
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

  const latestSeason = await prisma.season.findFirst({ orderBy: { createdAt: "desc" } });
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
