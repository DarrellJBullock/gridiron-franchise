import type {
  GamePlayerStatLine,
  GameTeamStatLine,
  PlayByPlayEntry,
  QuarterScores,
  SimulatedGameResult,
} from "@/types/football";
import { calculateTeamRatings, type RatedPlayer } from "./team-ratings";
import { bestPlayerAt, topPlayersAt, PlayerStatAccumulator, selectTopPerformers } from "./player-stats";
import { shortName, downLabel, fieldPosition, generateReturnPlay } from "./play-by-play";

// A franchise-style statistical simulation, not a physics engine — but every
// drive is resolved down by down (not as one aggregate outcome with flavor
// text bolted on after), because that's what real penalty mechanics need:
// loss of down, automatic first downs, and replayed downs only make sense
// against actual down/distance state.

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
  bigPlayYards: number;
  quarter: number;
  plays: Omit<PlayByPlayEntry, "sequence">[];
  outcome: "touchdown" | "field_goal" | "missed_field_goal" | "punt" | "turnover";
  firstDowns: number;
  penaltyCount: number;
  penaltyYards: number;
  driveSeconds: number;
}

interface DriveState {
  down: number;
  distance: number;
  yardLine: number; // 0-100, relative to the offense's own goal line
}

function goalToGoCap(distance: number, yardLine: number): number {
  return Math.max(1, Math.min(distance, 100 - yardLine));
}

/**
 * Resolves one full possession play by play: real down/distance/field
 * position drive every outcome, including penalties (false start, holding,
 * offside, pass interference) that can replay a down, cost a down, or grant
 * an automatic first down — none of which make sense without genuine down
 * tracking, which is why this isn't the old "roll the drive's total yards,
 * then narrate it" approach.
 */
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

  const plays: Omit<PlayByPlayEntry, "sequence">[] = [];
  const state: DriveState = { down: 1, distance: 10, yardLine: randomInt(18, 32) };

  let points = 0;
  let turnover = false;
  let bigPlay = false;
  let bigPlayYards = 0;
  let firstDowns = 0;
  let penaltyCount = 0;
  let penaltyYards = 0;
  let outcome: DriveResult["outcome"] = "punt";
  let driveOver = false;
  const startingYardLine = state.yardLine;

  const rbRating = offense.rbs[0]?.overall ?? 50;
  const recRating = offense.receivers[0]?.overall ?? 50;
  const runRatio = clamp(0.42 + (rbRating - recRating) * 0.004, 0.28, 0.62);

  function addPenalty(who: "offense" | "defense", label: string, yards: number, autoFirstDown: boolean, before: DriveState) {
    penaltyCount += 1;
    penaltyYards += yards;
    if (who === "offense") {
      state.yardLine = Math.max(1, state.yardLine - yards);
      state.distance = goalToGoCap(state.distance + yards, state.yardLine);
    } else {
      state.yardLine = Math.min(99, state.yardLine + yards);
      if (autoFirstDown) {
        state.down = 1;
        state.distance = goalToGoCap(10, state.yardLine);
      } else {
        state.distance = goalToGoCap(state.distance - yards, state.yardLine);
      }
    }
    plays.push({
      quarter,
      driveNumber,
      offenseAbbr: offense.abbr,
      down: before.down,
      distance: before.distance,
      yardLine: Math.round(before.yardLine),
      playType: "penalty",
      description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${
        who === "offense" ? "Offensive" : "Defensive"
      } penalty — ${label}, ${yards} yards${autoFirstDown ? ", automatic first down" : ""}.`,
      yards: who === "offense" ? -yards : yards,
      isScoring: false,
      isTurnover: false,
    });
  }

  let safety = 0;
  while (!driveOver && safety < 30) {
    safety += 1;

    // 4th down: attempt a field goal, go for it, or punt — decided before
    // the snap, using only field position (not down/distance, which only
    // matters for whether they *reach* 4th down in the first place).
    if (state.down === 4) {
      const distanceToGoal = 100 - state.yardLine;
      const fgDistance = distanceToGoal + 17;
      const inFgRange = fgDistance <= 58 && !!offense.kicker;
      const goForIt = !inFgRange && distanceToGoal <= 50 && state.distance <= 4 && Math.random() < 0.45;

      if (inFgRange) {
        const kickerRating = offense.kicker?.overall ?? 55;
        const fgChance = clamp(kickerRating / 115 - Math.max(0, fgDistance - 35) * 0.006, 0.35, 0.96);
        const made = Math.random() < fgChance;
        if (made && offense.kicker) stats.addFieldGoal(offense.kicker);
        outcome = made ? "field_goal" : "missed_field_goal";
        points = made ? 3 : 0;
        plays.push({
          quarter,
          driveNumber,
          offenseAbbr: offense.abbr,
          down: state.down,
          distance: state.distance,
          yardLine: Math.round(state.yardLine),
          playType: outcome,
          description: `${downLabel(state.down)} & ${state.distance}: ${shortName(offense.kicker, "The kicker")} ${
            made ? "nails" : "misses"
          } a ${fgDistance}-yard field goal attempt.`,
          yards: 0,
          isScoring: made,
          isTurnover: false,
        });
        driveOver = true;
        break;
      }

      if (!goForIt) {
        outcome = "punt";
        plays.push({
          quarter,
          driveNumber,
          offenseAbbr: offense.abbr,
          down: state.down,
          distance: state.distance,
          yardLine: Math.round(state.yardLine),
          playType: "punt",
          description: `${downLabel(state.down)} & ${state.distance} at the ${fieldPosition(state.yardLine)}: ${offense.abbr} sends out the punt team.`,
          yards: 0,
          isScoring: false,
          isTurnover: false,
        });
        driveOver = true;
        break;
      }
      // else: fall through and attempt the 4th-down play below.
    }

    // Pre-snap penalties (before the play type is even decided).
    if (Math.random() < 0.022) {
      const before = { ...state };
      addPenalty("offense", Math.random() < 0.5 ? "False Start" : "Delay of Game", 5, false, before);
      continue;
    }
    if (Math.random() < 0.016) {
      const before = { ...state };
      addPenalty("defense", "Offside", 5, true, before);
      continue;
    }

    const before = { ...state };
    if (before.down === 3) thirdDowns.attempts += 1;

    const isRun = Math.random() < runRatio;
    const runner = pickWeighted(offense.rbs);
    const receiver = pickWeighted(offense.receivers);

    if (isRun) {
      const fumbleChance = clamp(0.009 - diff * 0.0001, 0.003, 0.02);
      if (Math.random() < fumbleChance) {
        const defender = pickWeighted(defense.defenders);
        if (defender) stats.addForcedFumble(defender);
        plays.push({
          quarter,
          driveNumber,
          offenseAbbr: offense.abbr,
          down: before.down,
          distance: before.distance,
          yardLine: Math.round(before.yardLine),
          playType: "fumble",
          description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
            runner,
            "The ball carrier"
          )} FUMBLES, recovered by ${shortName(defender, "the defense")}!`,
          yards: 0,
          isScoring: false,
          isTurnover: true,
        });
        turnover = true;
        outcome = "turnover";
        driveOver = true;
        break;
      }

      const breakawayChance = clamp(0.055 + diff * 0.0012, 0.02, 0.16);
      const isBreakaway = Math.random() < breakawayChance;
      const yards = isBreakaway
        ? randomInt(15, 50)
        : clamp(randomInt(2, 9) + Math.round(diff * 0.06), -3, 15);

      // Post-snap penalty check (only on a play that didn't turn the ball over).
      if (Math.random() < 0.022) {
        addPenalty("offense", "Holding", 10, false, before);
        continue;
      }
      if (Math.random() < 0.01) {
        addPenalty("defense", "Face Mask", 5, true, before);
        continue;
      }

      teamLine.totalYards += yards;
      teamLine.rushingYards += yards;
      state.yardLine = clamp(state.yardLine + yards, 1, 100);
      const isTouchdown = state.yardLine >= 100;

      if (runner) stats.addRushing(runner, yards, isTouchdown);
      if (Math.abs(yards) >= 20) {
        bigPlay = true;
        bigPlayYards = Math.max(bigPlayYards, yards);
      }
      if (Math.random() < 0.55) {
        const tackler = pickWeighted(defense.defenders);
        if (tackler && !isTouchdown) stats.addTackle(tackler);
      }

      if (isTouchdown) {
        points = 7;
        outcome = "touchdown";
        plays.push({
          quarter,
          driveNumber,
          offenseAbbr: offense.abbr,
          down: before.down,
          distance: before.distance,
          yardLine: Math.round(before.yardLine),
          playType: "touchdown",
          description: `${downLabel(before.down)} & ${before.distance}: ${shortName(runner, "The running back")} rushes ${yards} yard${
            yards === 1 ? "" : "s"
          } for the touchdown!`,
          yards,
          isScoring: true,
          isTurnover: false,
        });
        plays.push({
          quarter,
          driveNumber,
          offenseAbbr: offense.abbr,
          down: 0,
          distance: 0,
          yardLine: 98,
          playType: "extra_point",
          description: `${shortName(offense.kicker, "The kicker")} extra point is good.`,
          yards: 0,
          isScoring: true,
          isTurnover: false,
        });
        driveOver = true;
        break;
      }

      const gotFirstDown = yards >= before.distance;
      if (before.down === 3 && gotFirstDown) thirdDowns.conversions += 1;
      if (gotFirstDown) {
        firstDowns += 1;
        state.down = 1;
        state.distance = goalToGoCap(10, state.yardLine);
      } else {
        state.down += 1;
        state.distance = goalToGoCap(before.distance - yards, state.yardLine);
      }

      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: before.down,
        distance: before.distance,
        yardLine: Math.round(before.yardLine),
        playType: "run",
        description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          runner,
          "The running back"
        )} rushes for ${yards} yard${yards === 1 ? "" : "s"}.`,
        yards,
        isScoring: false,
        isTurnover: false,
      });

      if (state.down > 4) {
        outcome = "turnover"; // safety net only — 4th down is handled explicitly above
        driveOver = true;
      }
      continue;
    }

    // Pass play.
    const sackChance = clamp(0.045 - diff * 0.0007, 0.015, 0.09);
    if (Math.random() < sackChance) {
      const sacker = pickWeighted(defense.defenders.slice(0, 5));
      if (sacker) stats.addSack(sacker);
      const yards = -randomInt(4, 9);
      teamLine.totalYards += yards;
      teamLine.passingYards += yards;
      state.yardLine = clamp(state.yardLine + yards, 1, 100);
      state.down += 1;
      state.distance = goalToGoCap(before.distance - yards, state.yardLine);
      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: before.down,
        distance: before.distance,
        yardLine: Math.round(before.yardLine),
        playType: "sack",
        description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          offense.qb,
          "The QB"
        )} is sacked by ${shortName(sacker, "the defense")} for a loss of ${Math.abs(yards)}.`,
        yards,
        isScoring: false,
        isTurnover: false,
      });
      if (state.down > 4) {
        outcome = "turnover";
        driveOver = true;
      }
      continue;
    }

    const interceptionChance = clamp(0.014 - diff * 0.0002, 0.004, 0.035);
    if (Math.random() < interceptionChance) {
      const defensiveBacks = defense.defenders.filter((d) => d.position === "CB" || d.position === "FS" || d.position === "SS");
      const interceptor = pickWeighted(defensiveBacks.length > 0 ? defensiveBacks : defense.defenders);
      if (offense.qb) stats.addPassing(offense.qb, 0, false, true);
      if (interceptor) stats.addInterceptionMade(interceptor);
      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: before.down,
        distance: before.distance,
        yardLine: Math.round(before.yardLine),
        playType: "interception",
        description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          offense.qb,
          "The QB"
        )} pass INTERCEPTED by ${shortName(interceptor, "the defense")}!`,
        yards: 0,
        isScoring: false,
        isTurnover: true,
      });
      turnover = true;
      outcome = "turnover";
      driveOver = true;
      break;
    }

    const completionChance = clamp(0.66 + diff * 0.0038, 0.46, 0.82);
    const isComplete = Math.random() < completionChance;

    if (!isComplete) {
      // Post-snap penalty check even on an incomplete pass (defensive PI / holding).
      if (Math.random() < 0.02) {
        if (Math.random() < 0.6) {
          const piYards = randomInt(8, 35);
          addPenalty("defense", "Pass Interference", piYards, true, before);
        } else {
          addPenalty("defense", "Defensive Holding", 5, true, before);
        }
        continue;
      }
      state.down += 1;
      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: before.down,
        distance: before.distance,
        yardLine: Math.round(before.yardLine),
        playType: "incomplete",
        description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          offense.qb,
          "The QB"
        )} pass incomplete intended for ${shortName(receiver, "the receiver")}.`,
        yards: 0,
        isScoring: false,
        isTurnover: false,
      });
      if (state.down > 4) {
        outcome = "turnover";
        driveOver = true;
      }
      continue;
    }

    const deepChance = clamp(0.18 + diff * 0.0018, 0.08, 0.32);
    const isDeep = Math.random() < deepChance;
    const yards = isDeep ? randomInt(16, 42) : randomInt(5, 15);

    if (Math.random() < 0.022) {
      addPenalty("offense", "Holding", 10, false, before);
      continue;
    }
    if (Math.random() < 0.018) {
      addPenalty("defense", "Defensive Holding", 5, true, before);
      continue;
    }

    teamLine.totalYards += yards;
    teamLine.passingYards += yards;
    state.yardLine = clamp(state.yardLine + yards, 1, 100);
    const isTouchdown = state.yardLine >= 100;

    if (offense.qb) stats.addPassing(offense.qb, yards, isTouchdown, false);
    if (receiver) stats.addReceiving(receiver, yards, isTouchdown);
    if (yards >= 20) {
      bigPlay = true;
      bigPlayYards = Math.max(bigPlayYards, yards);
    }
    if (Math.random() < 0.6) {
      const tackler = pickWeighted(defense.defenders);
      if (tackler && !isTouchdown) stats.addTackle(tackler);
    }

    if (isTouchdown) {
      points = 7;
      outcome = "touchdown";
      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: before.down,
        distance: before.distance,
        yardLine: Math.round(before.yardLine),
        playType: "touchdown",
        description: `${downLabel(before.down)} & ${before.distance}: ${shortName(offense.qb, "The QB")} pass to ${shortName(
          receiver,
          "the receiver"
        )}, ${yards} yard${yards === 1 ? "" : "s"}, TOUCHDOWN!`,
        yards,
        isScoring: true,
        isTurnover: false,
      });
      plays.push({
        quarter,
        driveNumber,
        offenseAbbr: offense.abbr,
        down: 0,
        distance: 0,
        yardLine: 98,
        playType: "extra_point",
        description: `${shortName(offense.kicker, "The kicker")} extra point is good.`,
        yards: 0,
        isScoring: true,
        isTurnover: false,
      });
      driveOver = true;
      break;
    }

    const gotFirstDown = yards >= before.distance;
    if (before.down === 3 && gotFirstDown) thirdDowns.conversions += 1;
    if (gotFirstDown) {
      firstDowns += 1;
      state.down = 1;
      state.distance = goalToGoCap(10, state.yardLine);
    } else {
      state.down += 1;
      state.distance = goalToGoCap(before.distance - yards, state.yardLine);
    }

    plays.push({
      quarter,
      driveNumber,
      offenseAbbr: offense.abbr,
      down: before.down,
      distance: before.distance,
      yardLine: Math.round(before.yardLine),
      playType: "pass",
      description: `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
        offense.qb,
        "The QB"
      )} pass complete to ${shortName(receiver, "the receiver")} for ${yards} yard${yards === 1 ? "" : "s"}.`,
      yards,
      isScoring: false,
      isTurnover: false,
    });

    if (state.down > 4) {
      outcome = "turnover";
      driveOver = true;
    }
  }

  const driveSeconds = clamp(plays.length * randomInt(26, 40), 60, 360);

  return {
    points,
    yards: Math.max(0, state.yardLine - startingYardLine),
    turnover,
    bigPlay,
    bigPlayYards,
    quarter,
    plays,
    outcome,
    firstDowns,
    penaltyCount,
    penaltyYards,
    driveSeconds,
  };
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function simulateSpecialTeamsReturn(
  type: "kick" | "punt",
  receivingTeam: TeamContext,
  quarter: number,
  driveNumber: number,
  stats: PlayerStatAccumulator
): { plays: Omit<PlayByPlayEntry, "sequence">[]; points: number } {
  const returner = pickWeighted([...receivingTeam.receivers, ...receivingTeam.rbs]);
  const tdChance = type === "kick" ? 0.02 : 0.015;
  const isTouchdown = Math.random() < tdChance;
  const yards = isTouchdown ? randomInt(85, 100) : type === "kick" ? randomInt(15, 35) : randomInt(0, 14);

  if (returner) {
    if (type === "kick") stats.addKickReturn(returner, yards, isTouchdown);
    else stats.addPuntReturn(returner, yards, isTouchdown);
  }

  const plays = generateReturnPlay({
    quarter,
    driveNumber,
    returnType: type,
    receivingAbbr: receivingTeam.abbr,
    returner,
    yards,
    isTouchdown,
  });

  return { plays, points: isTouchdown ? 7 : 0 };
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
    penalties: "0-0",
  };
  const awayLine: GameTeamStatLine = {
    totalYards: 0,
    passingYards: 0,
    rushingYards: 0,
    turnovers: 0,
    firstDowns: 0,
    thirdDownConversions: "0/0",
    timeOfPossession: "0:00",
    penalties: "0-0",
  };

  const homeThirdDowns = { attempts: 0, conversions: 0 };
  const awayThirdDowns = { attempts: 0, conversions: 0 };
  let homePenaltyCount = 0;
  let homePenaltyYards = 0;
  let awayPenaltyCount = 0;
  let awayPenaltyYards = 0;

  let homeScore = 0;
  let awayScore = 0;
  let homePossessionSeconds = 0;
  let awayPossessionSeconds = 0;

  const drivesPerQuarterPerTeam = 3;
  const bigPlays: { team: string; quarter: number; yards: number }[] = [];
  let biggestSwing = { quarter: 1, delta: 0, team: "" };
  const allPlays: Omit<PlayByPlayEntry, "sequence">[] = [];
  let driveNumber = 0;

  function processDrive(offense: TeamContext, defense: TeamContext, offenseIsHome: boolean, quarter: number) {
    driveNumber += 1;
    const offenseLine = offenseIsHome ? homeLine : awayLine;
    const offenseThirdDowns = offenseIsHome ? homeThirdDowns : awayThirdDowns;
    const bonus = offenseIsHome ? homeBonus : 0;

    const result = simulateDrive(offense, defense, quarter, driveNumber, bonus, stats, offenseLine, offenseThirdDowns);
    allPlays.push(...result.plays);

    if (offenseIsHome) homePossessionSeconds += result.driveSeconds;
    else awayPossessionSeconds += result.driveSeconds;

    offenseLine.firstDowns += result.firstDowns;
    if (result.turnover) offenseLine.turnovers += 1;
    if (offenseIsHome) {
      homePenaltyCount += result.penaltyCount;
      homePenaltyYards += result.penaltyYards;
    } else {
      awayPenaltyCount += result.penaltyCount;
      awayPenaltyYards += result.penaltyYards;
    }

    const scoreQuarter = quarter <= 4 ? quarter - 1 : 4;

    if (result.points > 0) {
      if (offenseIsHome) {
        homeScore += result.points;
        quarterScores.home[scoreQuarter] = (quarterScores.home[scoreQuarter] ?? 0) + result.points;
      } else {
        awayScore += result.points;
        quarterScores.away[scoreQuarter] = (quarterScores.away[scoreQuarter] ?? 0) + result.points;
      }
      if (result.points >= biggestSwing.delta) {
        biggestSwing = { quarter, delta: result.points, team: offense.name };
      }
    }
    if (result.bigPlay) {
      bigPlays.push({ team: offense.name, quarter, yards: result.bigPlayYards });
    }

    // Kickoff return (after any score) or punt return (after a punt),
    // credited to whichever team is about to receive.
    const receivingTeam = offenseIsHome ? away : home;
    let returnResult: { plays: Omit<PlayByPlayEntry, "sequence">[]; points: number } | null = null;
    if (result.points === 7 || result.points === 3) {
      driveNumber += 1;
      returnResult = simulateSpecialTeamsReturn("kick", receivingTeam, quarter, driveNumber, stats);
    } else if (result.outcome === "punt") {
      driveNumber += 1;
      returnResult = simulateSpecialTeamsReturn("punt", receivingTeam, quarter, driveNumber, stats);
    }

    let returnTouchdown = false;
    if (returnResult) {
      allPlays.push(...returnResult.plays);
      if (returnResult.points > 0) {
        returnTouchdown = true;
        if (receivingTeam === home) {
          homeScore += returnResult.points;
          quarterScores.home[scoreQuarter] = (quarterScores.home[scoreQuarter] ?? 0) + returnResult.points;
        } else {
          awayScore += returnResult.points;
          quarterScores.away[scoreQuarter] = (quarterScores.away[scoreQuarter] ?? 0) + returnResult.points;
        }
      }
    }

    return { ...result, returnTouchdown, receivingTeamName: receivingTeam.name };
  }

  for (let quarter = 1; quarter <= 4; quarter++) {
    for (let drive = 0; drive < drivesPerQuarterPerTeam; drive++) {
      const homeStarts = (quarter + drive) % 2 === 0;
      const offense = homeStarts ? home : away;
      const defense = homeStarts ? away : home;
      processDrive(offense, defense, homeStarts, quarter);
    }
  }

  // Sudden-death overtime: teams alternate single drives (home gets the
  // first possession) and the first score of any kind — including a
  // return touchdown — wins immediately.
  const maxOvertimeDrives = 30;
  let overtimeDrives = 0;
  let overtimeWinner: { team: string; points: number; source: "drive" | "return" } | null = null;
  if (homeScore === awayScore) {
    quarterScores.home.push(0);
    quarterScores.away.push(0);
  }
  while (homeScore === awayScore && overtimeDrives < maxOvertimeDrives) {
    overtimeDrives += 1;
    const homeStarts = overtimeDrives % 2 === 1;
    const offense = homeStarts ? home : away;
    const defense = homeStarts ? away : home;
    const scoreBefore = { home: homeScore, away: awayScore };

    const result = processDrive(offense, defense, homeStarts, 5);

    if (homeScore !== scoreBefore.home || awayScore !== scoreBefore.away) {
      overtimeWinner = result.returnTouchdown
        ? { team: result.receivingTeamName, points: 7, source: "return" }
        : { team: offense.name, points: result.points, source: "drive" };
    }
  }

  homeLine.thirdDownConversions = `${homeThirdDowns.conversions}/${homeThirdDowns.attempts}`;
  awayLine.thirdDownConversions = `${awayThirdDowns.conversions}/${awayThirdDowns.attempts}`;
  homeLine.penalties = `${homePenaltyCount}-${homePenaltyYards}`;
  awayLine.penalties = `${awayPenaltyCount}-${awayPenaltyYards}`;

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
    ? overtimeWinner.source === "return"
      ? `${overtimeWinner.team} won it with a return touchdown in sudden-death overtime.`
      : `${overtimeWinner.team} won it with a ${overtimeWinner.points}-point drive in sudden-death overtime.`
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
