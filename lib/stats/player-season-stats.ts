import { prisma } from "@/lib/prisma";

// Single source of truth for which GamePlayerStats columns get summed into
// a season/career line. Adding a new tracked stat is a one-line change here
// — the interface, the zeroed starting line, and both aggregation passes
// (per-season, then career) all derive from this list instead of each
// re-listing every field by hand.
const STAT_FIELDS = [
  "passingAttempts",
  "passingCompletions",
  "passingYards",
  "passingTouchdowns",
  "interceptions",
  "rushingAttempts",
  "rushingYards",
  "rushingTouchdowns",
  "receptions",
  "receivingYards",
  "receivingTouchdowns",
  "tackles",
  "sacks",
  "forcedFumbles",
  "interceptionsMade",
  "fieldGoalsMade",
  "punts",
  "puntYards",
  "kickReturnYards",
  "kickReturnTouchdowns",
  "puntReturnYards",
  "puntReturnTouchdowns",
] as const;

type StatFields = Record<(typeof STAT_FIELDS)[number], number>;

export interface PlayerSeasonStatLine extends StatFields {
  seasonId: string;
  seasonName: string;
  year: number;
  gamesPlayed: number;
}

const EMPTY_LINE: StatFields = Object.fromEntries(STAT_FIELDS.map((field) => [field, 0])) as StatFields;

function addStats(totals: StatFields, source: StatFields) {
  for (const field of STAT_FIELDS) totals[field] += source[field];
}

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
    addStats(line, row);
    bySeasonId.set(key, line);
  }

  // Newest real season first; the Exhibition bucket (year = Infinity) always sorts last.
  const seasons = Array.from(bySeasonId.values()).sort((a, b) =>
    a.year === Infinity ? 1 : b.year === Infinity ? -1 : b.year - a.year
  );

  const career = seasons.reduce(
    (totals, s) => {
      totals.gamesPlayed += s.gamesPlayed;
      addStats(totals, s);
      return totals;
    },
    { gamesPlayed: 0, ...EMPTY_LINE }
  );

  return { seasons, career };
}
