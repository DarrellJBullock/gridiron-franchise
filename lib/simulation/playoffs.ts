import { prisma } from "@/lib/prisma";
import { simulateGame } from "./game-engine";
import { persistSimulatedGame } from "./persist-game";
import { toRatedPlayer } from "@/lib/football-mappers";

// "Like the NFL", scaled to this league's 2 conferences x 3 divisions: each
// conference sends its 3 division winners plus the best remaining team (a
// wildcard) into a 4-team bracket. Conference semifinals -> conference
// championship -> the two conference champions play a League Championship.

export interface PlayoffSeedTeam {
  seed: number; // 1-4 within its conference
  conference: string;
  division: string;
  teamId: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  record: string;
  winPct: number;
  pointsFor: number;
}

export type PlayoffRound = "Conference Semifinal" | "Conference Championship" | "League Championship";

export interface PlayoffMatchup {
  gameId: string;
  round: PlayoffRound;
  conference: string | null; // null for the League Championship (cross-conference)
  status: string;
  home: PlayoffSeedTeam;
  away: PlayoffSeedTeam;
  homeScore: number;
  awayScore: number;
  winnerTeamId: string | null;
}

export interface ConferenceBracket {
  conference: string;
  seeds: PlayoffSeedTeam[];
  semifinals: PlayoffMatchup[];
  championship: PlayoffMatchup | null;
}

export interface PlayoffBracketResult {
  seasonId: string;
  conferences: ConferenceBracket[];
  leagueChampionship: PlayoffMatchup | null;
  championTeamId: string | null;
}

function winPct(s: { wins: number; losses: number; ties: number }) {
  return s.wins / Math.max(1, s.wins + s.losses + s.ties);
}

function byRecord<T extends { wins: number; losses: number; ties: number; pointsFor: number }>(a: T, b: T) {
  return winPct(b) - winPct(a) || b.pointsFor - a.pointsFor;
}

async function getConferenceSeeds(seasonId: string, conference: string): Promise<PlayoffSeedTeam[]> {
  const standings = await prisma.standing.findMany({
    where: { seasonId, team: { conference } },
    include: { team: true },
  });

  const byDivision = new Map<string, typeof standings>();
  for (const s of standings) {
    const list = byDivision.get(s.team.division) ?? [];
    list.push(s);
    byDivision.set(s.team.division, list);
  }

  const divisionWinners = Array.from(byDivision.values())
    .map((teams) => [...teams].sort(byRecord)[0])
    .filter((s): s is (typeof standings)[number] => s !== undefined)
    .sort(byRecord);

  const winnerIds = new Set(divisionWinners.map((s) => s.teamId));
  const wildcard = standings.filter((s) => !winnerIds.has(s.teamId)).sort(byRecord)[0];

  const seeded = wildcard ? [...divisionWinners, wildcard] : divisionWinners;

  return seeded.slice(0, 4).map((s, i) => ({
    seed: i + 1,
    conference,
    division: s.team.division,
    teamId: s.teamId,
    name: s.team.name,
    abbreviation: s.team.abbreviation,
    primaryColor: s.team.primaryColor,
    secondaryColor: s.team.secondaryColor,
    record: `${s.wins}-${s.losses}${s.ties ? `-${s.ties}` : ""}`,
    winPct: winPct(s),
    pointsFor: s.pointsFor,
  }));
}

async function simulateAndPersistPlayoffGame(
  seasonId: string,
  homeSeed: PlayoffSeedTeam,
  awaySeed: PlayoffSeedTeam,
  round: string,
  week: number
) {
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({
      where: { id: homeSeed.teamId },
      include: { players: { where: { retired: false }, include: { ratings: { where: { ratingName: "injury" } } } } },
    }),
    prisma.team.findUnique({
      where: { id: awaySeed.teamId },
      include: { players: { where: { retired: false }, include: { ratings: { where: { ratingName: "injury" } } } } },
    }),
  ]);
  if (!homeTeam || !awayTeam) throw new Error("Playoff team not found");

  // Playoff games can't end in a tie. The engine now plays sudden-death
  // overtime until someone scores, so a tie here should be virtually
  // impossible — this retry is just a defensive fallback for the capped
  // edge case, re-simulating the whole game rather than patching the score
  // after the fact (which would leave the summary text describing a tie
  // that didn't match the persisted score).
  let result = simulateGame({
    homeTeamName: homeTeam.name,
    awayTeamName: awayTeam.name,
    homeTeamAbbr: homeTeam.abbreviation,
    awayTeamAbbr: awayTeam.abbreviation,
    homePlayers: homeTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
    awayPlayers: awayTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
  });
  let attempts = 1;
  while (result.homeScore === result.awayScore && attempts < 10) {
    result = simulateGame({
      homeTeamName: homeTeam.name,
      awayTeamName: awayTeam.name,
      homeTeamAbbr: homeTeam.abbreviation,
      awayTeamAbbr: awayTeam.abbreviation,
      homePlayers: homeTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
      awayPlayers: awayTeam.players.map((p) => toRatedPlayer(p, p.ratings)),
    });
    attempts++;
  }

  return persistSimulatedGame({
    homeTeamId: homeSeed.teamId,
    awayTeamId: awaySeed.teamId,
    seasonId,
    week,
    result,
    isPlayoff: true,
    playoffRound: round,
    countsForStandings: false,
  });
}

function involvesTeams(game: { homeTeamId: string; awayTeamId: string }, teamA: string, teamB: string) {
  return (
    (game.homeTeamId === teamA && game.awayTeamId === teamB) ||
    (game.homeTeamId === teamB && game.awayTeamId === teamA)
  );
}

function toMatchup(
  game: { id: string; status: string; homeScore: number; awayScore: number },
  round: PlayoffRound,
  conference: string | null,
  home: PlayoffSeedTeam,
  away: PlayoffSeedTeam
): PlayoffMatchup {
  const winnerTeamId = game.status === "FINAL" ? (game.homeScore > game.awayScore ? home.teamId : away.teamId) : null;
  return { gameId: game.id, round, conference, status: game.status, home, away, homeScore: game.homeScore, awayScore: game.awayScore, winnerTeamId };
}

type PlayoffGame = Awaited<ReturnType<typeof simulateAndPersistPlayoffGame>>;

async function resolveMatchupGame(
  pool: PlayoffGame[],
  seasonId: string,
  round: string,
  home: PlayoffSeedTeam,
  away: PlayoffSeedTeam,
  week: number,
  simulate: boolean
): Promise<PlayoffGame | null> {
  const existing = pool.find((g) => g.playoffRound === round && involvesTeams(g, home.teamId, away.teamId));
  if (existing) return existing;
  if (!simulate) return null;
  const created = await simulateAndPersistPlayoffGame(seasonId, home, away, round, week);
  pool.push(created);
  return created;
}

async function buildBracket(seasonId: string, simulate: boolean): Promise<PlayoffBracketResult | null> {
  const season = await prisma.season.findUnique({ where: { id: seasonId } });
  if (!season) return null;
  if (simulate && season.status !== "COMPLETED") {
    throw new Error("Finish the regular season before running the playoffs.");
  }

  const conferenceNames = Array.from(
    new Set((await prisma.team.findMany({ where: { leagueId: season.leagueId }, select: { conference: true } })).map((t) => t.conference))
  );
  if (conferenceNames.length < 2) {
    if (simulate) throw new Error("At least two conferences are required for playoffs.");
    return null;
  }

  const gamePool = await prisma.game.findMany({ where: { seasonId, isPlayoff: true } });
  if (!simulate && gamePool.length === 0) return null;

  const semifinalWeek = season.totalWeeks + 1;
  const confChampWeek = season.totalWeeks + 2;
  const leagueChampWeek = season.totalWeeks + 3;

  const conferences: ConferenceBracket[] = [];

  for (const conference of conferenceNames) {
    const seeds = await getConferenceSeeds(seasonId, conference);
    if (seeds.length < 4) {
      if (simulate) throw new Error(`${conference} needs at least 4 playoff-eligible teams.`);
      conferences.push({ conference, seeds, semifinals: [], championship: null });
      continue;
    }
    const [s1, s2, s3, s4] = seeds;

    const sf1Game = await resolveMatchupGame(gamePool, seasonId, `${conference} Semifinal`, s1, s4, semifinalWeek, simulate);
    const sf2Game = await resolveMatchupGame(gamePool, seasonId, `${conference} Semifinal`, s2, s3, semifinalWeek, simulate);
    if (!sf1Game || !sf2Game) {
      conferences.push({ conference, seeds, semifinals: [], championship: null });
      continue;
    }

    const sf1Matchup = toMatchup(sf1Game, "Conference Semifinal", conference, s1, s4);
    const sf2Matchup = toMatchup(sf2Game, "Conference Semifinal", conference, s2, s3);

    let championship: PlayoffMatchup | null = null;
    if (sf1Matchup.winnerTeamId && sf2Matchup.winnerTeamId) {
      const finalistA = sf1Matchup.winnerTeamId === s1.teamId ? s1 : s4;
      const finalistB = sf2Matchup.winnerTeamId === s2.teamId ? s2 : s3;
      const [home, away] = finalistA.seed <= finalistB.seed ? [finalistA, finalistB] : [finalistB, finalistA];
      const champGame = await resolveMatchupGame(gamePool, seasonId, `${conference} Championship`, home, away, confChampWeek, simulate);
      if (champGame) championship = toMatchup(champGame, "Conference Championship", conference, home, away);
    }

    conferences.push({ conference, seeds, semifinals: [sf1Matchup, sf2Matchup], championship });
  }

  let leagueChampionship: PlayoffMatchup | null = null;
  const finalists = conferences.map((cb) =>
    cb.championship?.status === "FINAL"
      ? cb.championship.winnerTeamId === cb.championship.home.teamId
        ? cb.championship.home
        : cb.championship.away
      : null
  );
  if (conferences.length === 2 && finalists[0] && finalists[1]) {
    const teamA = finalists[0];
    const teamB = finalists[1];
    const aHosts = teamA.winPct > teamB.winPct || (teamA.winPct === teamB.winPct && teamA.pointsFor >= teamB.pointsFor);
    const [home, away] = aHosts ? [teamA, teamB] : [teamB, teamA];
    const finalGame = await resolveMatchupGame(gamePool, seasonId, "League Championship", home, away, leagueChampWeek, simulate);
    if (finalGame) leagueChampionship = toMatchup(finalGame, "League Championship", null, home, away);
  }

  return {
    seasonId,
    conferences,
    leagueChampionship,
    championTeamId: leagueChampionship?.status === "FINAL" ? leagueChampionship.winnerTeamId : null,
  };
}

export async function runPlayoffs(seasonId: string): Promise<PlayoffBracketResult> {
  const result = await buildBracket(seasonId, true);
  if (!result) throw new Error("Season not found");
  return result;
}

export async function getExistingBracket(seasonId: string): Promise<PlayoffBracketResult | null> {
  return buildBracket(seasonId, false);
}
