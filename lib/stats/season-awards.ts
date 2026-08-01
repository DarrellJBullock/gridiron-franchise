import { prisma } from "@/lib/prisma";

export interface SeasonAward {
  category: "MVP" | "Offensive Player of the Year" | "Defensive Player of the Year" | "Rookie of the Year";
  playerId: string;
  playerName: string;
  position: string;
  teamAbbreviation: string;
  valueLabel: string;
}

function offensiveScore(sum: {
  passingYards: number | null;
  passingTouchdowns: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}): number {
  return (
    (sum.passingYards ?? 0) * 0.04 +
    (sum.passingTouchdowns ?? 0) * 4 +
    (sum.rushingYards ?? 0) * 0.1 +
    (sum.rushingTouchdowns ?? 0) * 6 +
    (sum.receivingYards ?? 0) * 0.1 +
    (sum.receivingTouchdowns ?? 0) * 6
  );
}

function defensiveScore(sum: { tackles: number | null; sacks: number | null; forcedFumbles: number | null; interceptionsMade: number | null }): number {
  return (sum.tackles ?? 0) + (sum.sacks ?? 0) * 2 + (sum.forcedFumbles ?? 0) * 3 + (sum.interceptionsMade ?? 0) * 3;
}

/**
 * End-of-season awards computed from that season's own game stats (not
 * current player ratings, so these stay accurate forever even after the
 * player has aged/retired/been re-rated in later seasons).
 *
 * Rookie of the Year is skipped for a league's very first season, since
 * every player on the inaugural roster would technically qualify as having
 * "no prior stats" — that's not a meaningful rookie distinction yet.
 */
export async function getSeasonAwards(leagueId: string, seasonId: string): Promise<SeasonAward[]> {
  const grouped = await prisma.gamePlayerStats.groupBy({
    by: ["playerId"],
    where: { player: { team: { leagueId } }, game: { seasonId } },
    _sum: {
      passingYards: true,
      passingTouchdowns: true,
      rushingYards: true,
      rushingTouchdowns: true,
      receivingYards: true,
      receivingTouchdowns: true,
      tackles: true,
      sacks: true,
      forcedFumbles: true,
      interceptionsMade: true,
    },
  });
  if (grouped.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { id: { in: grouped.map((g) => g.playerId) } },
    include: { team: { select: { abbreviation: true } } },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  const candidates = grouped
    .map((g) => ({
      playerId: g.playerId,
      player: playerMap.get(g.playerId),
      off: offensiveScore(g._sum),
      def: defensiveScore(g._sum),
    }))
    .filter((c): c is typeof c & { player: NonNullable<typeof c.player> } => c.player !== undefined);

  function toAward(category: SeasonAward["category"], entry: (typeof candidates)[number], valueLabel: string): SeasonAward {
    return {
      category,
      playerId: entry.player.id,
      playerName: `${entry.player.firstName} ${entry.player.lastName}`,
      position: entry.player.position,
      teamAbbreviation: entry.player.team.abbreviation,
      valueLabel,
    };
  }

  const awards: SeasonAward[] = [];

  const mvp = [...candidates].sort((a, b) => b.off + b.def - (a.off + a.def))[0];
  if (mvp) awards.push(toAward("MVP", mvp, `${Math.round(mvp.off + mvp.def)} impact pts`));

  const opoy = [...candidates].sort((a, b) => b.off - a.off)[0];
  if (opoy && opoy.off > 0) awards.push(toAward("Offensive Player of the Year", opoy, `${Math.round(opoy.off)} off. pts`));

  const dpoy = [...candidates].sort((a, b) => b.def - a.def)[0];
  if (dpoy && dpoy.def > 0) awards.push(toAward("Defensive Player of the Year", dpoy, `${Math.round(dpoy.def)} def. pts`));

  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (season) {
    const earlierSeasons = await prisma.season.findMany({
      where: { leagueId, year: { lt: season.year } },
      select: { id: true },
    });
    if (earlierSeasons.length > 0) {
      const priorPlayerIds = new Set(
        (
          await prisma.gamePlayerStats.findMany({
            where: {
              playerId: { in: candidates.map((c) => c.playerId) },
              game: { seasonId: { in: earlierSeasons.map((s) => s.id) } },
            },
            select: { playerId: true },
            distinct: ["playerId"],
          })
        ).map((r) => r.playerId)
      );
      const rookies = candidates.filter((c) => !priorPlayerIds.has(c.playerId));
      const roy = [...rookies].sort((a, b) => b.off + b.def - (a.off + a.def))[0];
      if (roy) awards.push(toAward("Rookie of the Year", roy, `${Math.round(roy.off + roy.def)} impact pts`));
    }
  }

  return awards;
}
