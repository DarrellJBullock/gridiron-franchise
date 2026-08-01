import { prisma } from "@/lib/prisma";

export interface PlayerSeasonStatLine {
  seasonId: string;
  seasonName: string;
  year: number;
  gamesPlayed: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptions: number;
  rushingYards: number;
  rushingTouchdowns: number;
  receivingYards: number;
  receivingTouchdowns: number;
  tackles: number;
  sacks: number;
  forcedFumbles: number;
  interceptionsMade: number;
  fieldGoalsMade: number;
}

const EMPTY_LINE: Omit<PlayerSeasonStatLine, "seasonId" | "seasonName" | "year" | "gamesPlayed"> = {
  passingYards: 0,
  passingTouchdowns: 0,
  interceptions: 0,
  rushingYards: 0,
  rushingTouchdowns: 0,
  receivingYards: 0,
  receivingTouchdowns: 0,
  tackles: 0,
  sacks: 0,
  forcedFumbles: 0,
  interceptionsMade: 0,
  fieldGoalsMade: 0,
};

/** Per-season stat lines for a player, newest season first, plus a career total. */
export async function getPlayerSeasonStats(playerId: string): Promise<{
  seasons: PlayerSeasonStatLine[];
  career: Omit<PlayerSeasonStatLine, "seasonId" | "seasonName" | "year">;
}> {
  const rows = await prisma.gamePlayerStats.findMany({
    where: { playerId },
    include: { game: { select: { seasonId: true, season: { select: { name: true, year: true } } } } },
  });

  const bySeasonId = new Map<string, PlayerSeasonStatLine>();
  for (const row of rows) {
    // One-off games simulated from the Matchup page aren't attached to a
    // season — group those under a synthetic "Exhibition" bucket rather
    // than silently dropping them from the career total.
    const key = row.game.seasonId ?? "exhibition";
    const line = bySeasonId.get(key) ?? {
      seasonId: key,
      seasonName: row.game.season?.name ?? "Exhibition",
      year: row.game.season?.year ?? Infinity,
      gamesPlayed: 0,
      ...EMPTY_LINE,
    };
    line.gamesPlayed += 1;
    line.passingYards += row.passingYards;
    line.passingTouchdowns += row.passingTouchdowns;
    line.interceptions += row.interceptions;
    line.rushingYards += row.rushingYards;
    line.rushingTouchdowns += row.rushingTouchdowns;
    line.receivingYards += row.receivingYards;
    line.receivingTouchdowns += row.receivingTouchdowns;
    line.tackles += row.tackles;
    line.sacks += row.sacks;
    line.forcedFumbles += row.forcedFumbles;
    line.interceptionsMade += row.interceptionsMade;
    line.fieldGoalsMade += row.fieldGoalsMade;
    bySeasonId.set(key, line);
  }

  // Newest real season first; the Exhibition bucket (year = Infinity) always sorts last.
  const seasons = Array.from(bySeasonId.values()).sort((a, b) =>
    a.year === Infinity ? 1 : b.year === Infinity ? -1 : b.year - a.year
  );

  const career = seasons.reduce(
    (totals, s) => ({
      gamesPlayed: totals.gamesPlayed + s.gamesPlayed,
      passingYards: totals.passingYards + s.passingYards,
      passingTouchdowns: totals.passingTouchdowns + s.passingTouchdowns,
      interceptions: totals.interceptions + s.interceptions,
      rushingYards: totals.rushingYards + s.rushingYards,
      rushingTouchdowns: totals.rushingTouchdowns + s.rushingTouchdowns,
      receivingYards: totals.receivingYards + s.receivingYards,
      receivingTouchdowns: totals.receivingTouchdowns + s.receivingTouchdowns,
      tackles: totals.tackles + s.tackles,
      sacks: totals.sacks + s.sacks,
      forcedFumbles: totals.forcedFumbles + s.forcedFumbles,
      interceptionsMade: totals.interceptionsMade + s.interceptionsMade,
      fieldGoalsMade: totals.fieldGoalsMade + s.fieldGoalsMade,
    }),
    { gamesPlayed: 0, ...EMPTY_LINE }
  );

  return { seasons, career };
}
