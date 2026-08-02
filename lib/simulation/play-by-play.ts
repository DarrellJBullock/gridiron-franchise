import type { PlayByPlayEntry, PlayType } from "@/types/football";
import type { RatedPlayer } from "./team-ratings";

// Shared text-formatting helpers used by the down-by-down drive simulation
// in game-engine.ts (which generates play descriptions as each play
// actually resolves) and by the kickoff/punt return generator below.

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function shortName(p?: RatedPlayer, fallback = "the offense") {
  return p ? `${p.firstName[0]}. ${p.lastName}` : fallback;
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

/** A kickoff/punt return following a score or punt — a standalone play, not a full drive. */
export function generateReturnPlay(ctx: ReturnPlayContext): Omit<PlayByPlayEntry, "sequence">[] {
  const label = ctx.returnType === "kick" ? "kickoff" : "punt";
  const playType: PlayType = ctx.returnType === "kick" ? "kick_return" : "punt_return";
  const entries: Omit<PlayByPlayEntry, "sequence">[] = [];

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
    entries.push({
      quarter: ctx.quarter,
      driveNumber: ctx.driveNumber,
      offenseAbbr: ctx.receivingAbbr,
      down: 0,
      distance: 0,
      yardLine: 98,
      playType: "extra_point",
      description: "The kicker extra point is good.",
      yards: 0,
      isScoring: true,
      isTurnover: false,
    });
  }

  return entries;
}

export { randomInt };
