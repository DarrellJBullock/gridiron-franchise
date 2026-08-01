import { prisma } from "@/lib/prisma";
import { simulateGame } from "./game-engine";
import { persistSimulatedGame } from "./persist-game";
import { toRatedPlayer } from "@/lib/football-mappers";

// A top-4, single-elimination playoff bracket seeded by regular-season record.
// The league's two divisions are uneven in size (3 vs 5 teams), so seeding is
// done across the whole league rather than per-division. This is entirely
// optional: a season can be advanced into the next year with or without ever
// running its playoffs, in which case the franchise history falls back to the
// best regular-season record as the season's "champion."

export interface PlayoffSeedTeam {
  seed: number;
  teamId: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  record: string;
}

export interface PlayoffMatchup {
  gameId: string;
  round: "Semifinal" | "Championship";
  status: string;
  home: PlayoffSeedTeam;
  away: PlayoffSeedTeam;
  homeScore: number;
  awayScore: number;
  winnerTeamId: string | null;
}

export interface PlayoffBracketResult {
  seasonId: string;
  seeds: PlayoffSeedTeam[];
  semifinals: PlayoffMatchup[];
  championship: PlayoffMatchup | null;
  championTeamId: string | null;
}

async function getSeeds(seasonId: string): Promise<PlayoffSeedTeam[]> {
  const standings = await prisma.standing.findMany({
    where: { seasonId },
    include: { team: true },
  });

  const ranked = [...standings].sort((a, b) => {
    const winPctA = a.wins / Math.max(1, a.wins + a.losses + a.ties);
    const winPctB = b.wins / Math.max(1, b.wins + b.losses + b.ties);
    return winPctB - winPctA || b.pointsFor - a.pointsFor;
  });

  return ranked.slice(0, 4).map((s, i) => ({
    seed: i + 1,
    teamId: s.teamId,
    name: s.team.name,
    abbreviation: s.team.abbreviation,
    primaryColor: s.team.primaryColor,
    secondaryColor: s.team.secondaryColor,
    record: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
  }));
}

async function simulateAndPersistPlayoffGame(
  seasonId: string,
  homeSeed: PlayoffSeedTeam,
  awaySeed: PlayoffSeedTeam,
  round: "Semifinal" | "Championship",
  week: number
) {
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: homeSeed.teamId }, include: { players: { where: { retired: false } } } }),
    prisma.team.findUnique({ where: { id: awaySeed.teamId }, include: { players: { where: { retired: false } } } }),
  ]);
  if (!homeTeam || !awayTeam) throw new Error("Playoff team not found");

  // Playoff games can't end in a tie. The engine doesn't model overtime, so on
  // the rare tied result we just re-simulate the game rather than patching the
  // score after the fact (which would leave the summary text describing a tie
  // that didn't match the persisted score).
  let result = simulateGame({
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeTeamAbbr: homeTeam.abbreviation,
    awayTeamAbbr: awayTeam.abbreviation,
    homePlayers: homeTeam.players.map(toRatedPlayer),
    awayPlayers: awayTeam.players.map(toRatedPlayer),
  });
  let attempts = 1;
  while (result.homeScore === result.awayScore && attempts < 10) {
    result = simulateGame({
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeTeamAbbr: homeTeam.abbreviation,
      awayTeamAbbr: awayTeam.abbreviation,
      homePlayers: homeTeam.players.map(toRatedPlayer),
      awayPlayers: awayTeam.players.map(toRatedPlayer),
    });
    attempts++;
  }

  const game = await persistSimulatedGame({
    homeTeamId: homeSeed.teamId,
    awayTeamId: awaySeed.teamId,
    seasonId,
    week,
    result,
    isPlayoff: true,
    playoffRound: round,
    countsForStandings: false,
  });

  return game;
}

function toMatchup(
  game: { id: string; status: string; homeScore: number; awayScore: number },
  round: "Semifinal" | "Championship",
  home: PlayoffSeedTeam,
  away: PlayoffSeedTeam
): PlayoffMatchup {
  const winnerTeamId =
    game.status === "FINAL"
      ? game.homeScore > game.awayScore
        ? home.teamId
        : away.teamId
      : null;
  return {
    gameId: game.id,
    round,
    status: game.status,
    home,
    away,
    homeScore: game.homeScore,
    awayScore: game.awayScore,
    winnerTeamId,
  };
}

export async function runPlayoffs(seasonId: string): Promise<PlayoffBracketResult> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) throw new Error("Season not found");
  if (season.status !== "COMPLETED") {
    throw new Error("Finish the regular season before running the playoffs.");
  }

  const seeds = await getSeeds(seasonId);
  if (seeds.length < 4) {
    throw new Error("At least 4 teams with standings are required for a playoff bracket.");
  }
  const [seed1, seed2, seed3, seed4] = seeds;
  const semifinalWeek = season.totalWeeks + 1;
  const championshipWeek = season.totalWeeks + 2;

  const existingPlayoffGames = await prisma.game.findMany({ where: { seasonId, isPlayoff: true } });
  let sf1 = existingPlayoffGames.find((g) => g.playoffRound === "Semifinal" && g.week === semifinalWeek && involvesTeams(g, seed1.teamId, seed4.teamId));
  let sf2 = existingPlayoffGames.find((g) => g.playoffRound === "Semifinal" && g.week === semifinalWeek && involvesTeams(g, seed2.teamId, seed3.teamId));

  if (!sf1) sf1 = await simulateAndPersistPlayoffGame(seasonId, seed1, seed4, "Semifinal", semifinalWeek);
  if (!sf2) sf2 = await simulateAndPersistPlayoffGame(seasonId, seed2, seed3, "Semifinal", semifinalWeek);

  const sf1Matchup = toMatchup(sf1, "Semifinal", seed1, seed4);
  const sf2Matchup = toMatchup(sf2, "Semifinal", seed2, seed3);

  const finalistA = sf1Matchup.winnerTeamId === seed1.teamId ? seed1 : seed4;
  const finalistB = sf2Matchup.winnerTeamId === seed2.teamId ? seed2 : seed3;

  // The better remaining seed hosts the championship game.
  const [champHome, champAway] = finalistA.seed <= finalistB.seed ? [finalistA, finalistB] : [finalistB, finalistA];

  let championshipGame = existingPlayoffGames.find(
    (g) => g.playoffRound === "Championship" && g.week === championshipWeek
  );
  if (!championshipGame) {
    championshipGame = await simulateAndPersistPlayoffGame(seasonId, champHome, champAway, "Championship", championshipWeek);
  }
  const championshipMatchup = toMatchup(championshipGame, "Championship", champHome, champAway);

  return {
    seasonId,
    seeds,
    semifinals: [sf1Matchup, sf2Matchup],
    championship: championshipMatchup,
    championTeamId: championshipMatchup.winnerTeamId,
  };
}

function involvesTeams(game: { homeTeamId: string; awayTeamId: string }, teamA: string, teamB: string) {
  return (
    (game.homeTeamId === teamA && game.awayTeamId === teamB) ||
    (game.homeTeamId === teamB && game.awayTeamId === teamA)
  );
}

export async function getExistingBracket(seasonId: string): Promise<PlayoffBracketResult | null> {
  const games = await prisma.game.findMany({ where: { seasonId, isPlayoff: true } });
  if (games.length === 0) return null;

  const seeds = await getSeeds(seasonId);
  if (seeds.length < 4) return null;
  const [seed1, seed2, seed3, seed4] = seeds;

  const sf1 = games.find((g) => g.playoffRound === "Semifinal" && involvesTeams(g, seed1.teamId, seed4.teamId));
  const sf2 = games.find((g) => g.playoffRound === "Semifinal" && involvesTeams(g, seed2.teamId, seed3.teamId));
  if (!sf1 || !sf2) return null;

  const sf1Matchup = toMatchup(sf1, "Semifinal", seed1, seed4);
  const sf2Matchup = toMatchup(sf2, "Semifinal", seed2, seed3);

  const championshipGame = games.find((g) => g.playoffRound === "Championship");
  let championshipMatchup: PlayoffMatchup | null = null;
  if (championshipGame) {
    const finalistA = sf1Matchup.winnerTeamId === seed1.teamId ? seed1 : seed4;
    const finalistB = sf2Matchup.winnerTeamId === seed2.teamId ? seed2 : seed3;
    const [champHome, champAway] = finalistA.seed <= finalistB.seed ? [finalistA, finalistB] : [finalistB, finalistA];
    championshipMatchup = toMatchup(championshipGame, "Championship", champHome, champAway);
  }

  return {
    seasonId,
    seeds,
    semifinals: [sf1Matchup, sf2Matchup],
    championship: championshipMatchup,
    championTeamId: championshipMatchup?.winnerTeamId ?? null,
  };
}
