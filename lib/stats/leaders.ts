import { prisma } from "@/lib/prisma";

const TOP_N = 10;

export async function getStatLeaders() {
  const grouped = await prisma.gamePlayerStats.groupBy({
    by: ["playerId"],
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
      fieldGoalsMade: true,
    },
  });

  if (grouped.length === 0) {
    return {
      passing: [],
      rushing: [],
      receiving: [],
      defense: [],
      kicking: [],
      sacks: [],
      interceptions: [],
      points: [],
      rushingTouchdowns: [],
      receivingTouchdowns: [],
    };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: grouped.map((g) => g.playerId) } },
    include: { team: { select: { abbreviation: true } } },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  function toRow(playerId: string, value: number) {
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
      .filter((row): row is NonNullable<typeof row> => row !== null && row.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, TOP_N);
  }

  return {
    passing: topBy((g) => g._sum.passingYards ?? 0),
    rushing: topBy((g) => g._sum.rushingYards ?? 0),
    receiving: topBy((g) => g._sum.receivingYards ?? 0),
    defense: topBy((g) => (g._sum.tackles ?? 0) + (g._sum.sacks ?? 0) * 2 + (g._sum.forcedFumbles ?? 0) * 3),
    kicking: topBy((g) => g._sum.fieldGoalsMade ?? 0),
    sacks: topBy((g) => g._sum.sacks ?? 0),
    interceptions: topBy((g) => g._sum.interceptionsMade ?? 0),
    // Points only counts scores the player personally crossed the goal line or kicked for —
    // passing touchdowns aren't included since the passer didn't score.
    points: topBy((g) => (g._sum.rushingTouchdowns ?? 0) * 6 + (g._sum.receivingTouchdowns ?? 0) * 6 + (g._sum.fieldGoalsMade ?? 0) * 3),
    rushingTouchdowns: topBy((g) => g._sum.rushingTouchdowns ?? 0),
    receivingTouchdowns: topBy((g) => g._sum.receivingTouchdowns ?? 0),
  };
}
