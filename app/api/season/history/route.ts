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

  const seasons = await prisma.season.findMany({
    where: { leagueId: league.id },
    orderBy: { year: "asc" },
    include: {
      standings: { include: { team: true } },
    },
  });

  const championshipGames = await prisma.game.findMany({
    where: {
      seasonId: { in: seasons.map((s) => s.id) },
      isPlayoff: true,
      playoffRound: "Championship",
      status: "FINAL",
    },
    include: { homeTeam: true, awayTeam: true },
  });
  const championshipBySeason = new Map(championshipGames.map((g) => [g.seasonId, g]));

  const history = seasons.map((season) => {
    const championshipGame = championshipBySeason.get(season.id);

    if (championshipGame) {
      const winnerTeam = championshipGame.homeScore > championshipGame.awayScore ? championshipGame.homeTeam : championshipGame.awayTeam;
      const winnerStanding = season.standings.find((s) => s.teamId === winnerTeam.id);
      return {
        id: season.id,
        name: season.name,
        year: season.year,
        status: season.status,
        champion: {
          teamId: winnerTeam.id,
          teamName: winnerTeam.name,
          abbreviation: winnerTeam.abbreviation,
          primaryColor: winnerTeam.primaryColor,
          secondaryColor: winnerTeam.secondaryColor,
          record: winnerStanding
            ? `${winnerStanding.wins}-${winnerStanding.losses}${winnerStanding.ties ? `-${winnerStanding.ties}` : ""}`
            : "",
          source: "playoff" as const,
        },
      };
    }

    const ranked = [...season.standings].sort((a, b) => {
      const winPctA = a.wins / Math.max(1, a.wins + a.losses + a.ties);
      const winPctB = b.wins / Math.max(1, b.wins + b.losses + b.ties);
      return winPctB - winPctA || b.pointsFor - a.pointsFor;
    });
    const bestRecord = season.status === "COMPLETED" ? ranked[0] : undefined;

    return {
      id: season.id,
      name: season.name,
      year: season.year,
      status: season.status,
      champion: bestRecord
        ? {
            teamId: bestRecord.teamId,
            teamName: bestRecord.team.name,
            abbreviation: bestRecord.team.abbreviation,
            primaryColor: bestRecord.team.primaryColor,
            secondaryColor: bestRecord.team.secondaryColor,
            record: `${bestRecord.wins}-${bestRecord.losses}${bestRecord.ties ? `-${bestRecord.ties}` : ""}`,
            source: "record" as const,
          }
        : null,
    };
  });

  return NextResponse.json({ history });
}
