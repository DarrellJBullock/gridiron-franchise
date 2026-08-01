import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { generateRoundRobinSchedule } from "@/lib/simulation/schedule";

interface CreateSeasonBody {
  name?: string;
  teamIds?: string[];
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const body = (await req.json().catch(() => ({}))) as CreateSeasonBody;

  const teams = body.teamIds?.length
    ? await prisma.team.findMany({ where: { id: { in: body.teamIds }, leagueId: league.id } })
    : await prisma.team.findMany({ where: { leagueId: league.id } });

  if (teams.length < 2) {
    return NextResponse.json({ error: "At least two teams are required to create a season" }, { status: 400 });
  }

  const schedule = generateRoundRobinSchedule(teams.map((t) => t.id));
  const totalWeeks = Math.max(...schedule.map((m) => m.week));

  const season = await prisma.season.create({
    data: {
      leagueId: league.id,
      name: body.name || `Season ${new Date().getFullYear()}`,
      year: new Date().getFullYear(),
      status: "NOT_STARTED",
      currentWeek: 0,
      totalWeeks,
      seasonTeams: { create: teams.map((t) => ({ teamId: t.id })) },
      standings: { create: teams.map((t) => ({ teamId: t.id })) },
      games: {
        create: schedule.map((m) => ({
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          week: m.week,
          status: "SCHEDULED",
        })),
      },
    },
  });

  return NextResponse.json({ season, gamesScheduled: schedule.length });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const seasons = await prisma.season.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ seasons });
}
