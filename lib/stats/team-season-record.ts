import { prisma } from "@/lib/prisma";

export interface TeamSeasonRecord {
  seasonId: string;
  seasonName: string;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
  division: string;
}

/** A team's win/loss record for every season it's been part of, newest first. */
export async function getTeamSeasonRecords(teamId: string): Promise<TeamSeasonRecord[]> {
  const standings = await prisma.standing.findMany({
    where: { teamId },
    include: { season: { select: { id: true, name: true, year: true } } },
    orderBy: { season: { year: "desc" } },
  });

  return standings.map((s) => ({
    seasonId: s.season.id,
    seasonName: s.season.name,
    year: s.season.year,
    wins: s.wins,
    losses: s.losses,
    ties: s.ties,
    pointsFor: s.pointsFor,
    pointsAgainst: s.pointsAgainst,
    streak: s.streak,
    division: s.division,
  }));
}
