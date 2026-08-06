import type { PlayDraft, PlayType } from "@/types/football";
import type { RatedPlayer } from "./team-ratings";

// Shared text-formatting helpers used by the down-by-down drive simulation
// in game-engine.ts (which generates play descriptions as each play
// actually resolves) and by the kickoff/punt return generator below.

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

export function shortName(p?: RatedPlayer, fallback = "the offense") {
  return p ? `${p.firstName[0]}. ${p.lastName}` : fallback;
}

function yardsLabel(yards: number) {
  return `${yards} yard${yards === 1 ? "" : "s"}`;
}

/** Appended to a run/completion's base sentence when a tackler was credited on the play. */
function tackleSuffix(tackler?: RatedPlayer): string {
  if (!tackler) return "";
  const name = shortName(tackler);
  return " " + pick([`Tackled by ${name}.`, `${name} makes the stop.`, `Brought down by ${name}.`]);
}

/** Appended to an incompletion when a defender was credited with the coverage. */
function coverageSuffix(defender?: RatedPlayer): string {
  if (!defender) return "";
  const name = shortName(defender);
  return " " + pick([`Tight coverage by ${name}.`, `${name} broke it up.`, `${name} was right there in coverage.`]);
}

// "a 8-yard pass" reads wrong — the indefinite article depends on how the
// number is spoken, not its digits (eight, eleven, eighteen, and the
// eighty-X's all start with a vowel sound).
export function article(n: number): "a" | "an" {
  const abs = Math.abs(n);
  if (abs === 8 || abs === 11 || abs === 18) return "an";
  if (abs >= 80 && abs <= 89) return "an";
  return "a";
}

// Varied phrasing for the highest-frequency play types, so a 100-play game
// doesn't read as the same sentence with different numbers plugged in.
// Bucketed by yardage so the flavor text stays plausible (you wouldn't
// "break free" for a 2-yard gain).

/** Non-touchdown run. */
export function runPlayText(runner: RatedPlayer | undefined, yards: number, tackler?: RatedPlayer): string {
  const name = shortName(runner, "The running back");
  const base = (() => {
    if (yards < 0) {
      return pick([
        `${name} is dropped for a loss of ${Math.abs(yards)}.`,
        `${name} is stuffed in the backfield for a loss of ${Math.abs(yards)}.`,
      ]);
    }
    if (yards === 0) {
      return pick([`${name} is stopped for no gain.`, `${name} is met immediately at the line for no gain.`]);
    }
    if (yards <= 4) {
      return pick([
        `${name} rushes for ${yardsLabel(yards)}.`,
        `${name} picks up ${yardsLabel(yards)} up the middle.`,
        `${name} squeezes out ${yardsLabel(yards)}.`,
      ]);
    }
    if (yards <= 14) {
      return pick([
        `${name} carries it ${yardsLabel(yards)}.`,
        `${name} finds a crease for ${yardsLabel(yards)}.`,
        `${name} bounces it outside for ${yardsLabel(yards)}.`,
      ]);
    }
    return pick([`${name} breaks free for ${yardsLabel(yards)}!`, `${name} bursts through the line for ${yardsLabel(yards)}!`]);
  })();
  return base + tackleSuffix(tackler);
}

/** Rushing touchdown. Must never contain the substring "pass" — LiveGamePlayer's
 *  ball-motion detection checks for it to tell a pass TD from a run TD. */
export function runTouchdownText(runner: RatedPlayer | undefined, yards: number): string {
  const name = shortName(runner, "The running back");
  return pick([
    `${name} rushes ${yardsLabel(yards)} for the touchdown!`,
    `${name} bursts into the end zone from ${yards} out!`,
    `${name} punches it in from ${yards} out for the score!`,
    `${name} scores on ${article(yards)} ${yards}-yard run!`,
  ]);
}

/** Completed, non-touchdown pass. */
export function passPlayText(
  qb: RatedPlayer | undefined,
  receiver: RatedPlayer | undefined,
  yards: number,
  tackler?: RatedPlayer
): string {
  const qbName = shortName(qb, "The QB");
  const recName = shortName(receiver, "the receiver");
  const base = (() => {
    if (yards <= 6) {
      return pick([
        `${qbName} dumps it off to ${recName} for ${yardsLabel(yards)}.`,
        `${qbName} finds ${recName} underneath for ${yardsLabel(yards)}.`,
        `${qbName} pass complete to ${recName} for ${yardsLabel(yards)}.`,
      ]);
    }
    if (yards <= 15) {
      return pick([
        `${qbName} connects with ${recName} for ${yardsLabel(yards)}.`,
        `${qbName} hits ${recName} for ${yardsLabel(yards)}.`,
        `${qbName} pass complete to ${recName} for ${yardsLabel(yards)}.`,
      ]);
    }
    return pick([
      `${qbName} airs it out to ${recName}, ${yardsLabel(yards)}!`,
      `${qbName} finds ${recName} deep for ${yardsLabel(yards)}!`,
      `${qbName} connects downfield with ${recName} for ${yardsLabel(yards)}!`,
    ]);
  })();
  return base + tackleSuffix(tackler);
}

/** Passing touchdown. Must always contain "pass" (see runTouchdownText note). */
export function passTouchdownText(qb: RatedPlayer | undefined, receiver: RatedPlayer | undefined, yards: number): string {
  const qbName = shortName(qb, "The QB");
  const recName = shortName(receiver, "the receiver");
  return pick([
    `${qbName} pass to ${recName}, ${yardsLabel(yards)}, TOUCHDOWN!`,
    `${qbName} finds ${recName} on ${article(yards)} ${yards}-yard touchdown pass!`,
    `${qbName} connects with ${recName} for the score on ${article(yards)} ${yards}-yard pass!`,
    `${qbName} lofts a touchdown pass to ${recName}, ${yardsLabel(yards)}!`,
  ]);
}

export function incompletePlayText(
  qb: RatedPlayer | undefined,
  receiver: RatedPlayer | undefined,
  coverageDefender?: RatedPlayer
): string {
  const qbName = shortName(qb, "The QB");
  const recName = shortName(receiver, "the receiver");
  const base = pick([
    `${qbName} pass incomplete, intended for ${recName}.`,
    `${qbName}'s pass to ${recName} falls incomplete.`,
    `${qbName} can't connect with ${recName}.`,
    `${recName} can't hang on, incomplete.`,
    `${qbName} sails it high, incomplete to ${recName}.`,
  ]);
  return base + coverageSuffix(coverageDefender);
}

export function sackPlayText(qb: RatedPlayer | undefined, sacker: RatedPlayer | undefined, yards: number): string {
  const qbName = shortName(qb, "The QB");
  const sackerName = shortName(sacker, "the defense");
  const absYards = Math.abs(yards);
  return pick([
    `${qbName} is sacked by ${sackerName} for a loss of ${absYards}.`,
    `${sackerName} brings down ${qbName} for a loss of ${absYards}.`,
    `${qbName} is taken down in the backfield by ${sackerName}, a loss of ${absYards}.`,
  ]);
}

export function interceptionPlayText(qb: RatedPlayer | undefined, interceptor: RatedPlayer | undefined): string {
  const qbName = shortName(qb, "The QB");
  const intName = shortName(interceptor, "the defense");
  return pick([
    `${qbName} pass INTERCEPTED by ${intName}!`,
    `${intName} jumps the route and picks off ${qbName}!`,
    `${qbName} throws it right to ${intName} for the interception!`,
  ]);
}

export function downLabel(down: number) {
  return ["", "1st", "2nd", "3rd", "4th"][down] ?? `${down}th`;
}

export function fieldPosition(yardLine: number) {
  const clamped = Math.max(1, Math.min(99, Math.round(yardLine)));
  return clamped <= 50 ? `own ${clamped}` : `opp ${100 - clamped}`;
}

export interface ReturnPlayContext {
  quarter: number;
  driveNumber: number;
  returnType: "kick" | "punt";
  receivingAbbr: string;
  returner?: RatedPlayer;
  yards: number;
  isTouchdown: boolean;
}

/**
 * The extra-point entry that follows every touchdown, whether it came off
 * a normal drive or a kick/punt return. `kicker` is omitted for return
 * touchdowns (the return play doesn't carry a specific kicker reference),
 * which falls back to the same generic "The kicker" text it always has.
 */
export function extraPointPlay(quarter: number, driveNumber: number, offenseAbbr: string, kicker?: RatedPlayer): PlayDraft {
  return {
    quarter,
    driveNumber,
    offenseAbbr,
    down: 0,
    distance: 0,
    yardLine: 98,
    playType: "extra_point",
    description: `${shortName(kicker, "The kicker")} extra point is good.`,
    yards: 0,
    isScoring: true,
    isTurnover: false,
  };
}

/** A kickoff/punt return following a score or punt — a standalone play, not a full drive. */
export function generateReturnPlay(ctx: ReturnPlayContext): PlayDraft[] {
  const label = ctx.returnType === "kick" ? "kickoff" : "punt";
  const playType: PlayType = ctx.returnType === "kick" ? "kick_return" : "punt_return";
  const entries: PlayDraft[] = [];

  entries.push({
    quarter: ctx.quarter,
    driveNumber: ctx.driveNumber,
    offenseAbbr: ctx.receivingAbbr,
    down: 0,
    distance: 0,
    yardLine: Math.max(1, Math.min(99, ctx.yards)),
    playType,
    description: ctx.isTouchdown
      ? `${shortName(ctx.returner, "The returner")} takes the ${label} back ${ctx.yards} yards for a TOUCHDOWN!`
      : `${shortName(ctx.returner, "The returner")} returns the ${label} ${ctx.yards} yard${ctx.yards === 1 ? "" : "s"}.`,
    yards: ctx.yards,
    isScoring: ctx.isTouchdown,
    isTurnover: false,
  });

  if (ctx.isTouchdown) {
    entries.push(extraPointPlay(ctx.quarter, ctx.driveNumber, ctx.receivingAbbr));
  }

  return entries;
}

export { randomInt };
