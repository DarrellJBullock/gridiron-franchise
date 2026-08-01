import type {
  GamePlayerStatLine,
  GameTeamStatLine,
  PlayByPlayEntry,
  QuarterScores,
  SimulatedGameResult,
} from "@/types/football";
import { calculateTeamRatings, type RatedPlayer } from "./team-ratings";
import { bestPlayerAt, topPlayersAt, PlayerStatAccumulator, selectTopPerformers } from "./player-stats";
import { generateDrivePlays } from "./play-by-play";

// This is a franchise-style statistical simulation, not a physics engine.
// Every drive resolves probabilistically from team ratings; the play-by-play log is
// flavor text generated from that result, not a separate down-by-down simulation.

export interface SimulateGameInput {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homePlayers: RatedPlayer[];
  awayPlayers: RatedPlayer[];
  homeFieldAdvantage?: boolean;
}

interface TeamContext {
  name: string;
  abbr: string;
  players: RatedPlayer[];
  offenseRating: number;
  defenseRating: number;
  specialTeamsRating: number;
  qb?: RatedPlayer;
  rbs: RatedPlayer[];
  receivers: RatedPlayer[];
  kicker?: RatedPlayer;
  defenders: RatedPlayer[];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickWeighted<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[randomInt(0, items.length - 1)];
}

function buildContext(name: string, abbr: string, players: RatedPlayer[]): TeamContext {
  const ratings = calculateTeamRatings(players);
  return {
    name,
    abbr,
    players,
    offenseRating: ratings.offenseRating,
    defenseRating: ratings.defenseRating,
    specialTeamsRating: ratings.specialTeamsRating,
    qb: bestPlayerAt(players, ["QB"]),
    rbs: topPlayersAt(players, ["RB", "FB"], 3),
    receivers: topPlayersAt(players, ["WR", "TE"], 5),
    kicker: bestPlayerAt(players, ["K"]),
    defenders: topPlayersAt(players, ["LE", "RE", "DT", "LOLB", "MLB", "ROLB", "CB", "FS", "SS"], 9),
  };
}

interface DriveResult {
  points: number;
  yards: number;
  turnover: boolean;
  bigPlay: boolean;
  quarter: number;
  plays: Omit<PlayByPlayEntry, "sequence">[];
}

function simulateDrive(
  offense: TeamContext,
  defense: TeamContext,
  quarter: number,
  driveNumber: number,
  homeBonus: number,
  stats: PlayerStatAccumulator,
  teamLine: GameTeamStatLine,
  thirdDowns: { attempts: number; conversions: number }
): DriveResult {
  const offEff = offense.offenseRating + homeBonus;
  const defEff = defense.defenseRating;
  const diff = offEff - defEff;

  const attempts = randomInt(1, 3);
  const convChance = clamp(0.38 + diff * 0.006, 0.15, 0.7);
  let conversions = 0;
  for (let i = 0; i < attempts; i++) {
    if (Math.random() < convChance) conversions++;
  }
  thirdDowns.attempts += attempts;
  thirdDowns.conversions += conversions;

  const rb = pickWeighted(offense.rbs);
  const receiver = pickWeighted(offense.receivers);

  const turnoverChance = clamp(0.14 - diff * 0.0022, 0.04, 0.26);
  if (Math.random() < turnoverChance) {
    const yards = randomInt(5, 30);
    teamLine.totalYards += yards;
    const isInterception = Math.random() < 0.55 && offense.qb;
    if (isInterception && offense.qb) {
      stats.addPassing(offense.qb, yards, false, true);
      // Interceptions are mostly made by defensive backs, occasionally a linebacker.
      const defensiveBacks = defense.defenders.filter((d) => d.position === "CB" || d.position === "FS" || d.position === "SS");
      const interceptor = pickWeighted(defensiveBacks.length > 0 ? defensiveBacks : defense.defenders);
      if (interceptor) stats.addInterceptionMade(interceptor);
    } else {
      const defender = pickWeighted(defense.defenders);
      if (defender) stats.addForcedFumble(defender);
    }
    const plays = generateDrivePlays({
      quarter,
      driveNumber,
      offenseAbbr: offense.abbr,
      qb: offense.qb,
      rb,
      receiver,
      kicker: offense.kicker,
      defenders: defense.defenders,
      outcome: "turnover",
      rushYards: 0,
      passYards: 0,
      turnoverYards: yards,
      turnoverType: isInterception ? "interception" : "fumble",
      scoredOnGround: false,
    });
    return { points: 0, yards, turnover: true, bigPlay: false, quarter, plays };
  }

  const bigPlayChance = clamp(0.16 + diff * 0.0035, 0.05, 0.4);
  const bigPlay = Math.random() < bigPlayChance;

  const reachesRedZone = Math.random() < clamp(0.52 + diff * 0.0045, 0.2, 0.88);
  const driveYards = reachesRedZone
    ? randomInt(45, 85) + (bigPlay ? randomInt(10, 25) : 0)
    : randomInt(15, 44);

  teamLine.totalYards += driveYards;

  const rbRating = offense.rbs[0]?.overall ?? 50;
  const recRating = offense.receivers[0]?.overall ?? 50;
  const runRatio = clamp(0.42 + (rbRating - recRating) * 0.004, 0.25, 0.68);
  const rushYards = Math.round(driveYards * runRatio);
  const passYards = driveYards - rushYards;

  teamLine.rushingYards += rushYards;
  teamLine.passingYards += passYards;

  let points = 0;
  let scoredOnGround = false;
  let outcome: "touchdown" | "field_goal" | "missed_field_goal" | "punt" = "punt";
  if (reachesRedZone) {
    const tdChance = clamp(0.5 + diff * 0.0055, 0.22, 0.85);
    if (Math.random() < tdChance) {
      points = 7;
      // Which play scored isn't the same question as which type of yardage dominated the
      // drive as a whole (a drive can be mostly passing yards and still end on a short
      // rushing score at the goal line), so this is an independent roll nudged by how
      // run-heavy the offense leans, not a hard cutoff on the drive's run/pass split.
      const rushTdChance = clamp(0.35 + (runRatio - 0.42) * 0.6, 0.2, 0.6);
      scoredOnGround = !receiver || Math.random() < rushTdChance;
      outcome = "touchdown";
    } else {
      const kickerRating = offense.kicker?.overall ?? 55;
      const fgChance = clamp(kickerRating / 115, 0.45, 0.95);
      if (Math.random() < fgChance && offense.kicker) {
        points = 3;
        stats.addFieldGoal(offense.kicker);
        outcome = "field_goal";
      } else {
        outcome = "missed_field_goal";
      }
    }
  }

  if (rb && rushYards > 0) stats.addRushing(rb, rushYards, points === 7 && scoredOnGround);
  if (offense.qb && passYards > 0) {
    stats.addPassing(offense.qb, passYards, points === 7 && !scoredOnGround, false);
  }
  if (receiver && passYards > 0) {
    stats.addReceiving(receiver, passYards, points === 7 && !scoredOnGround);
  }

  // Defensive flavor: sacks and tackles happen on most drives regardless of outcome.
  if (Math.random() < clamp(0.28 - diff * 0.002, 0.08, 0.4)) {
    const sacker = pickWeighted(defense.defenders.slice(0, 5));
    if (sacker) stats.addSack(sacker);
  }
  const tackleCount = randomInt(1, 2);
  for (let i = 0; i < tackleCount; i++) {
    const tackler = pickWeighted(defense.defenders);
    if (tackler) stats.addTackle(tackler);
  }

  const plays = generateDrivePlays({
    quarter,
    driveNumber,
    offenseAbbr: offense.abbr,
    qb: offense.qb,
    rb,
    receiver,
    kicker: offense.kicker,
    defenders: defense.defenders,
    outcome,
    rushYards,
    passYards,
    turnoverYards: 0,
    turnoverType: "fumble",
    scoredOnGround,
  });

  return { points, yards: driveYards, turnover: false, bigPlay, quarter, plays };
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function simulateGame(input: SimulateGameInput): SimulatedGameResult {
  const home = buildContext(input.homeTeamName, input.homeTeamAbbr ?? input.homeTeamName, input.homePlayers);
  const away = buildContext(input.awayTeamName, input.awayTeamAbbr ?? input.awayTeamName, input.awayPlayers);
  const homeBonus = input.homeFieldAdvantage === false ? 0 : 2.5;

  const stats = new PlayerStatAccumulator();
  const quarterScores: QuarterScores = {
    home: [0, 0, 0, 0],
    away: [0, 0, 0, 0],
  };

  const homeLine: GameTeamStatLine = {
    totalYards: 0,
    passingYards: 0,
    rushingYards: 0,
    turnovers: 0,
    firstDowns: 0,
    thirdDownConversions: "0/0",
    timeOfPossession: "0:00",
  };
  const awayLine: GameTeamStatLine = {
    totalYards: 0,
    passingYards: 0,
    rushingYards: 0,
    turnovers: 0,
    firstDowns: 0,
    thirdDownConversions: "0/0",
    timeOfPossession: "0:00",
  };

  const homeThirdDowns = { attempts: 0, conversions: 0 };
  const awayThirdDowns = { attempts: 0, conversions: 0 };

  let homeScore = 0;
  let awayScore = 0;
  let homePossessionSeconds = 0;
  let awayPossessionSeconds = 0;

  const drivesPerQuarterPerTeam = 3;
  const bigPlays: { team: string; quarter: number; yards: number }[] = [];
  let biggestSwing = { quarter: 1, delta: 0, team: "" };
  const allPlays: Omit<PlayByPlayEntry, "sequence">[] = [];
  let driveNumber = 0;

  for (let quarter = 1; quarter <= 4; quarter++) {
    for (let drive = 0; drive < drivesPerQuarterPerTeam; drive++) {
      const homeStarts = (quarter + drive) % 2 === 0;
      driveNumber += 1;

      const offense = homeStarts ? home : away;
      const defense = homeStarts ? away : home;
      const offenseLine = homeStarts ? homeLine : awayLine;
      const offenseThirdDowns = homeStarts ? homeThirdDowns : awayThirdDowns;
      const bonus = homeStarts ? homeBonus : 0;

      const result = simulateDrive(
        offense,
        defense,
        quarter,
        driveNumber,
        bonus,
        stats,
        offenseLine,
        offenseThirdDowns
      );
      allPlays.push(...result.plays);
      const driveSeconds = randomInt(90, 210);
      if (homeStarts) homePossessionSeconds += driveSeconds;
      else awayPossessionSeconds += driveSeconds;

      offenseLine.firstDowns += Math.max(1, Math.round(result.yards / 9.5));
      if (result.turnover) offenseLine.turnovers += 1;

      if (result.points > 0) {
        if (homeStarts) {
          homeScore += result.points;
          quarterScores.home[quarter - 1] += result.points;
        } else {
          awayScore += result.points;
          quarterScores.away[quarter - 1] += result.points;
        }
        if (result.points >= biggestSwing.delta) {
          biggestSwing = { quarter, delta: result.points, team: offense.name };
        }
      }
      if (result.bigPlay) {
        bigPlays.push({ team: offense.name, quarter, yards: result.yards });
      }
    }
  }

  // Sudden-death overtime: teams alternate single drives (home gets the
  // first possession) and the first score of any kind wins immediately.
  // Capped well beyond what's statistically plausible to need — every drive
  // has a real chance to score, so exhausting the cap is not expected to
  // happen in practice, but the loop still terminates either way.
  const maxOvertimeDrives = 30;
  let overtimeDrives = 0;
  let overtimeWinner: { team: string; points: number } | null = null;
  if (homeScore === awayScore) {
    quarterScores.home.push(0);
    quarterScores.away.push(0);
  }
  while (homeScore === awayScore && overtimeDrives < maxOvertimeDrives) {
    overtimeDrives += 1;
    const homeStarts = overtimeDrives % 2 === 1;
    driveNumber += 1;

    const offense = homeStarts ? home : away;
    const defense = homeStarts ? away : home;
    const offenseLine = homeStarts ? homeLine : awayLine;
    const offenseThirdDowns = homeStarts ? homeThirdDowns : awayThirdDowns;
    const bonus = homeStarts ? homeBonus : 0;

    const result = simulateDrive(offense, defense, 5, driveNumber, bonus, stats, offenseLine, offenseThirdDowns);
    allPlays.push(...result.plays);
    const driveSeconds = randomInt(90, 210);
    if (homeStarts) homePossessionSeconds += driveSeconds;
    else awayPossessionSeconds += driveSeconds;

    offenseLine.firstDowns += Math.max(1, Math.round(result.yards / 9.5));
    if (result.turnover) offenseLine.turnovers += 1;

    if (result.points > 0) {
      if (homeStarts) {
        homeScore += result.points;
        quarterScores.home[4] += result.points;
      } else {
        awayScore += result.points;
        quarterScores.away[4] += result.points;
      }
      overtimeWinner = { team: offense.name, points: result.points };
    }
    if (result.bigPlay) {
      bigPlays.push({ team: offense.name, quarter: 5, yards: result.yards });
    }
  }

  homeLine.thirdDownConversions = `${homeThirdDowns.conversions}/${homeThirdDowns.attempts}`;
  awayLine.thirdDownConversions = `${awayThirdDowns.conversions}/${awayThirdDowns.attempts}`;

  const totalPossession = homePossessionSeconds + awayPossessionSeconds || 1;
  const normalizedHome = (homePossessionSeconds / totalPossession) * 3600;
  const normalizedAway = 3600 - normalizedHome;
  homeLine.timeOfPossession = formatClock(normalizedHome);
  awayLine.timeOfPossession = formatClock(normalizedAway);

  const playerStats = stats.values();
  const topPerformers = selectTopPerformers(playerStats, 3);

  const winner = homeScore === awayScore ? null : homeScore > awayScore ? home.name : away.name;
  const margin = Math.abs(homeScore - awayScore);
  const wentToOvertime = overtimeDrives > 0;

  const summary =
    winner === null
      ? `${home.name} and ${away.name} battled to a ${homeScore}-${awayScore} tie.`
      : `${winner} defeated ${winner === home.name ? away.name : home.name} ${Math.max(
          homeScore,
          awayScore
        )}-${Math.min(homeScore, awayScore)}${
          wentToOvertime ? " in overtime" : margin <= 3 ? " in a nail-biter" : margin >= 21 ? " in a blowout" : ""
        }.`;

  const biggestBigPlay = bigPlays.sort((a, b) => b.yards - a.yards)[0];
  const turningPoint = overtimeWinner
    ? `${overtimeWinner.team} won it with a ${overtimeWinner.points}-point drive in sudden-death overtime.`
    : biggestBigPlay
      ? `A ${biggestBigPlay.yards}-yard explosive play by ${biggestBigPlay.team} in the Q${biggestBigPlay.quarter} shifted momentum.`
      : `${biggestSwing.team || home.name} took control with a scoring drive in the Q${biggestSwing.quarter}.`;

  const homeRunHeavy = homeLine.rushingYards >= homeLine.passingYards;
  const awayRunHeavy = awayLine.rushingYards >= awayLine.passingYards;
  const playStyleSummary = `${home.name} leaned ${homeRunHeavy ? "on the ground game" : "on the passing attack"} (${homeLine.rushingYards} rush / ${homeLine.passingYards} pass yds) while ${away.name} ${awayRunHeavy ? "pounded the rock" : "attacked through the air"} (${awayLine.rushingYards} rush / ${awayLine.passingYards} pass yds).`;

  const plays: PlayByPlayEntry[] = allPlays.map((play, index) => ({ ...play, sequence: index + 1 }));

  return {
    homeScore,
    awayScore,
    quarterScores,
    homeStats: homeLine,
    awayStats: awayLine,
    playerStats,
    plays,
    summary,
    topPerformers,
    turningPoint,
    playStyleSummary,
  };
}

export type { GamePlayerStatLine };
