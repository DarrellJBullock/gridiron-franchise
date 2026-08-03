import { prisma } from "@/lib/prisma";
import type { Position } from "@/types/football";

export interface SingleGameRecord {
  category: string;
  unit: string;
  value: number;
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  seasonLabel: string;
  week: number;
  gameId: string;
}

export interface TeamGameRecord {
  category: string;
  unit: string;
  value: number;
  teamName: string;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  seasonLabel: string;
  week: number;
  gameId: string;
}

export interface HallOfFameInductee {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  careerScore: number;
  highlightLine: string;
}

function seasonLabel(season: { name: string; year: number } | null): string {
  return season ? `${season.name} (${season.year})` : "Exhibition";
}

/** The single best individual game ever recorded in each major stat category. */
export async function getSingleGameRecords(leagueId: string): Promise<SingleGameRecord[]> {
  const rows = await prisma.gamePlayerStats.findMany({
    where: { player: { team: { leagueId } } },
    include: {
      player: { select: { firstName: true, lastName: true, position: true, team: { select: { abbreviation: true } } } },
      game: {
        select: {
          week: true,
          homeTeam: { select: { abbreviation: true } },
          awayTeam: { select: { abbreviation: true } },
          season: { select: { name: true, year: true } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  type Row = (typeof rows)[number];

  function opponentAbbr(row: Row, teamAbbr: string) {
    return row.game.homeTeam.abbreviation === teamAbbr ? row.game.awayTeam.abbreviation : row.game.homeTeam.abbreviation;
  }

  function best(category: string, unit: string, selector: (r: Row) => number): SingleGameRecord | null {
    const top = [...rows].filter((r) => selector(r) > 0).sort((a, b) => selector(b) - selector(a))[0];
    if (!top) return null;
    const teamAbbr = top.player.team.abbreviation;
    return {
      category,
      unit,
      value: selector(top),
      playerId: top.playerId,
      playerName: `${top.player.firstName} ${top.player.lastName}`,
      position: top.player.position,
      teamAbbreviation: teamAbbr,
      opponentAbbreviation: opponentAbbr(top, teamAbbr),
      seasonLabel: seasonLabel(top.game.season),
      week: top.game.week,
      gameId: top.gameId,
    };
  }

  const records = [
    best("Passing Yards", "yds", (r) => r.passingYards),
    best("Passing Touchdowns", "TD", (r) => r.passingTouchdowns),
    best("Rushing Yards", "yds", (r) => r.rushingYards),
    best("Rushing Touchdowns", "TD", (r) => r.rushingTouchdowns),
    best("Receiving Yards", "yds", (r) => r.receivingYards),
    best("Receiving Touchdowns", "TD", (r) => r.receivingTouchdowns),
    best("Tackles", "tkl", (r) => r.tackles),
    best("Sacks", "sacks", (r) => r.sacks),
    best("Interceptions", "INT", (r) => r.interceptionsMade),
    best("Forced Fumbles", "FF", (r) => r.forcedFumbles),
    best("Field Goals Made", "FG", (r) => r.fieldGoalsMade),
    best("Return Yards", "yds", (r) => r.kickReturnYards + r.puntReturnYards),
  ];
  return records.filter((r): r is SingleGameRecord => r !== null);
}

/** The single best team performance ever recorded in each major team category. */
export async function getTeamGameRecords(leagueId: string): Promise<TeamGameRecord[]> {
  const rows = await prisma.gameTeamStats.findMany({
    where: { team: { leagueId } },
    include: {
      team: { select: { name: true, abbreviation: true } },
      game: {
        select: {
          week: true,
          homeScore: true,
          awayScore: true,
          homeTeam: { select: { abbreviation: true } },
          awayTeam: { select: { abbreviation: true } },
          season: { select: { name: true, year: true } },
        },
      },
    },
  });
  if (rows.length === 0) return [];

  type Row = (typeof rows)[number];

  function ownScore(row: Row) {
    return row.game.homeTeam.abbreviation === row.team.abbreviation ? row.game.homeScore : row.game.awayScore;
  }
  function opponentScore(row: Row) {
    return row.game.homeTeam.abbreviation === row.team.abbreviation ? row.game.awayScore : row.game.homeScore;
  }
  function opponentAbbr(row: Row) {
    return row.game.homeTeam.abbreviation === row.team.abbreviation ? row.game.awayTeam.abbreviation : row.game.homeTeam.abbreviation;
  }

  function best(category: string, unit: string, selector: (r: Row) => number): TeamGameRecord | null {
    const top = [...rows].filter((r) => selector(r) > 0).sort((a, b) => selector(b) - selector(a))[0];
    if (!top) return null;
    return {
      category,
      unit,
      value: selector(top),
      teamName: top.team.name,
      teamAbbreviation: top.team.abbreviation,
      opponentAbbreviation: opponentAbbr(top),
      seasonLabel: seasonLabel(top.game.season),
      week: top.game.week,
      gameId: top.gameId,
    };
  }

  const records = [
    best("Points Scored", "pts", ownScore),
    best("Margin of Victory", "pts", (r) => ownScore(r) - opponentScore(r)),
    best("Total Yards", "yds", (r) => r.totalYards),
    best("Passing Yards", "yds", (r) => r.passingYards),
    best("Rushing Yards", "yds", (r) => r.rushingYards),
  ];
  return records.filter((r): r is TeamGameRecord => r !== null);
}

/** Top-5 all-time by a career-wide version of the same impact score used for in-game top performers. */
export async function getHallOfFameInductees(leagueId: string): Promise<HallOfFameInductee[]> {
  const grouped = await prisma.gamePlayerStats.groupBy({
    by: ["playerId"],
    where: { player: { team: { leagueId } } },
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
  if (grouped.length === 0) return [];

  const players = await prisma.player.findMany({
    where: { id: { in: grouped.map((g) => g.playerId) } },
    include: { team: { select: { abbreviation: true } } },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  function score(sum: (typeof grouped)[number]["_sum"]): number {
    return (
      (sum.passingYards ?? 0) * 0.04 +
      (sum.passingTouchdowns ?? 0) * 4 +
      (sum.rushingYards ?? 0) * 0.1 +
      (sum.rushingTouchdowns ?? 0) * 6 +
      (sum.receivingYards ?? 0) * 0.1 +
      (sum.receivingTouchdowns ?? 0) * 6 +
      (sum.tackles ?? 0) * 1 +
      (sum.sacks ?? 0) * 2 +
      (sum.forcedFumbles ?? 0) * 3 +
      (sum.interceptionsMade ?? 0) * 4 +
      (sum.fieldGoalsMade ?? 0) * 3
    );
  }

  function highlightLine(position: string, sum: (typeof grouped)[number]["_sum"]): string {
    const parts: string[] = [];
    if ((sum.passingYards ?? 0) > 0) parts.push(`${sum.passingYards} pass yds`, `${sum.passingTouchdowns ?? 0} pass TD`);
    if ((sum.rushingYards ?? 0) > 0) parts.push(`${sum.rushingYards} rush yds`, `${sum.rushingTouchdowns ?? 0} rush TD`);
    if ((sum.receivingYards ?? 0) > 0) parts.push(`${sum.receivingYards} rec yds`, `${sum.receivingTouchdowns ?? 0} rec TD`);
    if ((sum.tackles ?? 0) > 0) parts.push(`${sum.tackles} tkl`);
    if ((sum.sacks ?? 0) > 0) parts.push(`${sum.sacks} sacks`);
    if ((sum.interceptionsMade ?? 0) > 0) parts.push(`${sum.interceptionsMade} INT`);
    if ((sum.fieldGoalsMade ?? 0) > 0) parts.push(`${sum.fieldGoalsMade} FG`);
    return parts.slice(0, 3).join(" · ") || `${position} — career honoree`;
  }

  return grouped
    .map((g) => {
      const player = playerMap.get(g.playerId);
      if (!player) return null;
      return {
        playerId: g.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        teamAbbreviation: player.team.abbreviation,
        careerScore: score(g._sum),
        highlightLine: highlightLine(player.position, g._sum),
      };
    })
    .filter((r): r is HallOfFameInductee => r !== null && r.careerScore > 0)
    .sort((a, b) => b.careerScore - a.careerScore)
    .slice(0, 5);
}
