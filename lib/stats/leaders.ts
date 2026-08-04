import { prisma } from "@/lib/prisma";
import type { Position } from "@/types/football";

const TOP_N = 10;

export interface StatLeaderRow {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  value: number;
}

export interface PassingLeaderRow {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  attempts: number;
  completions: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  rating: number;
}

export interface RushingLeaderRow {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  attempts: number;
  yards: number;
  avg: number;
  touchdowns: number;
}

export interface ReceivingLeaderRow {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  receptions: number;
  yards: number;
  avg: number;
  touchdowns: number;
}

// Standard NFL passer rating formula — each of the four components is
// clamped to [0, 2.375] before averaging, same as the official formula.
function passerRating(attempts: number, completions: number, yards: number, touchdowns: number, interceptions: number): number {
  if (attempts === 0) return 0;
  const clamp2375 = (n: number) => Math.min(2.375, Math.max(0, n));
  const a = clamp2375((completions / attempts - 0.3) * 5);
  const b = clamp2375((yards / attempts - 3) * 0.25);
  const c = clamp2375((touchdowns / attempts) * 20);
  const d = clamp2375(2.375 - (interceptions / attempts) * 25);
  return Math.round(((a + b + c + d) / 6) * 100 * 10) / 10;
}

export async function getStatLeaders(leagueId: string, seasonId?: string) {
  const grouped = await prisma.gamePlayerStats.groupBy({
    by: ["playerId"],
    where: {
      player: { team: { leagueId } },
      ...(seasonId ? { game: { seasonId } } : {}),
    },
    _sum: {
      passingAttempts: true,
      passingCompletions: true,
      passingYards: true,
      passingTouchdowns: true,
      rushingAttempts: true,
      rushingYards: true,
      rushingTouchdowns: true,
      receptions: true,
      receivingYards: true,
      receivingTouchdowns: true,
      tackles: true,
      sacks: true,
      forcedFumbles: true,
      interceptions: true,
      interceptionsMade: true,
      fieldGoalsMade: true,
      kickReturnYards: true,
      kickReturnTouchdowns: true,
      puntReturnYards: true,
      puntReturnTouchdowns: true,
    },
  });

  if (grouped.length === 0) {
    return {
      passing: [] as PassingLeaderRow[],
      rushing: [] as RushingLeaderRow[],
      receiving: [] as ReceivingLeaderRow[],
      defense: [] as StatLeaderRow[],
      kicking: [] as StatLeaderRow[],
      sacks: [] as StatLeaderRow[],
      interceptions: [] as StatLeaderRow[],
      points: [] as StatLeaderRow[],
      rushingTouchdowns: [] as StatLeaderRow[],
      receivingTouchdowns: [] as StatLeaderRow[],
      returns: [] as StatLeaderRow[],
    };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: grouped.map((g) => g.playerId) } },
    include: { team: { select: { abbreviation: true } } },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  function toRow(playerId: string, value: number): StatLeaderRow | null {
    const player = playerMap.get(playerId);
    if (!player) return null;
    return {
      playerId,
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
      teamAbbreviation: player.team.abbreviation,
      value,
    };
  }

  function topBy(selector: (g: (typeof grouped)[number]) => number) {
    return grouped
      .map((g) => toRow(g.playerId, selector(g)))
      .filter((row): row is StatLeaderRow => row !== null && row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);
  }

  const passing: PassingLeaderRow[] = grouped
    .map((g): PassingLeaderRow | null => {
      const player = playerMap.get(g.playerId);
      const yards = g._sum.passingYards ?? 0;
      if (!player || yards <= 0) return null;
      const attempts = g._sum.passingAttempts ?? 0;
      const completions = g._sum.passingCompletions ?? 0;
      const touchdowns = g._sum.passingTouchdowns ?? 0;
      const interceptions = g._sum.interceptions ?? 0;
      return {
        playerId: g.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        teamAbbreviation: player.team.abbreviation,
        attempts,
        completions,
        yards,
        touchdowns,
        interceptions,
        rating: passerRating(attempts, completions, yards, touchdowns, interceptions),
      };
    })
    .filter((row): row is PassingLeaderRow => row !== null)
    .sort((a, b) => b.yards - a.yards)
    .slice(0, TOP_N);

  const rushing: RushingLeaderRow[] = grouped
    .map((g): RushingLeaderRow | null => {
      const player = playerMap.get(g.playerId);
      const yards = g._sum.rushingYards ?? 0;
      if (!player || yards <= 0) return null;
      const attempts = g._sum.rushingAttempts ?? 0;
      return {
        playerId: g.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        teamAbbreviation: player.team.abbreviation,
        attempts,
        yards,
        avg: attempts > 0 ? Math.round((yards / attempts) * 10) / 10 : 0,
        touchdowns: g._sum.rushingTouchdowns ?? 0,
      };
    })
    .filter((row): row is RushingLeaderRow => row !== null)
    .sort((a, b) => b.yards - a.yards)
    .slice(0, TOP_N);

  const receiving: ReceivingLeaderRow[] = grouped
    .map((g): ReceivingLeaderRow | null => {
      const player = playerMap.get(g.playerId);
      const yards = g._sum.receivingYards ?? 0;
      if (!player || yards <= 0) return null;
      const receptions = g._sum.receptions ?? 0;
      return {
        playerId: g.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        teamAbbreviation: player.team.abbreviation,
        receptions,
        yards,
        avg: receptions > 0 ? Math.round((yards / receptions) * 10) / 10 : 0,
        touchdowns: g._sum.receivingTouchdowns ?? 0,
      };
    })
    .filter((row): row is ReceivingLeaderRow => row !== null)
    .sort((a, b) => b.yards - a.yards)
    .slice(0, TOP_N);

  return {
    passing,
    rushing,
    receiving,
    defense: topBy((g) => (g._sum.tackles ?? 0) + (g._sum.sacks ?? 0) * 2 + (g._sum.forcedFumbles ?? 0) * 3),
    kicking: topBy((g) => g._sum.fieldGoalsMade ?? 0),
    sacks: topBy((g) => g._sum.sacks ?? 0),
    interceptions: topBy((g) => g._sum.interceptionsMade ?? 0),
    // Points only counts scores the player personally crossed the goal line or kicked for —
    // passing touchdowns aren't included since the passer didn't score.
    points: topBy(
      (g) =>
        (g._sum.rushingTouchdowns ?? 0) * 6 +
        (g._sum.receivingTouchdowns ?? 0) * 6 +
        (g._sum.kickReturnTouchdowns ?? 0) * 6 +
        (g._sum.puntReturnTouchdowns ?? 0) * 6 +
        (g._sum.fieldGoalsMade ?? 0) * 3
    ),
    rushingTouchdowns: topBy((g) => g._sum.rushingTouchdowns ?? 0),
    receivingTouchdowns: topBy((g) => g._sum.receivingTouchdowns ?? 0),
    returns: topBy((g) => (g._sum.kickReturnYards ?? 0) + (g._sum.puntReturnYards ?? 0)),
  };
}
