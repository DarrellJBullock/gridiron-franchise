import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leagueId = searchParams.get("leagueId");

  const seasons = await prisma.season.findMany({
    where: leagueId ? { leagueId } : undefined,
    orderBy: { year: "asc" },
    include: {
      standings: { include: { team: true } },
    },
  });

  const history = seasons.map((season) => {
    const ranked = [...season.standings].sort((a, b) => {
      const winPctA = a.wins / Math.max(1, a.wins + a.losses + a.ties);
      const winPctB = b.wins / Math.max(1, b.wins + b.losses + b.ties);
      return winPctB - winPctA || b.pointsFor - a.pointsFor;
    });
    const champion = season.status === "COMPLETED" ? ranked[0] : undefined;

    return {
      id: season.id,
      name: season.name,
      year: season.year,
      status: season.status,
      champion: champion
        ? {
            teamId: champion.teamId,
            teamName: champion.team.name,
            abbreviation: champion.team.abbreviation,
            primaryColor: champion.team.primaryColor,
            secondaryColor: champion.team.secondaryColor,
            record: `${champion.wins}-${champion.losses}${champion.ties ? `-${champion.ties}` : ""}`,
          }
        : null,
    };
  });

  return NextResponse.json({ history });
}
