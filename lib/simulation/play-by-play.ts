import type { PlayByPlayEntry, PlayType } from "@/types/football";
import type { RatedPlayer } from "./team-ratings";

// Turns a drive's already-decided outcome (yards, scoring result, turnover) into a
// readable sequence of individual plays. The play log is flavor text layered on top
// of numbers computed elsewhere — it does not change the drive's actual result.

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T | undefined {
  return arr.length > 0 ? arr[randomInt(0, arr.length - 1)] : undefined;
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shortName(p?: RatedPlayer, fallback = "the offense") {
  return p ? `${p.firstName[0]}. ${p.lastName}` : fallback;
}

function downLabel(down: number) {
  return ["", "1st", "2nd", "3rd", "4th"][down] ?? `${down}th`;
}

function fieldPosition(yardLine: number) {
  const clamped = Math.max(1, Math.min(99, Math.round(yardLine)));
  return clamped <= 50 ? `own ${clamped}` : `opp ${100 - clamped}`;
}

function distributeYards(total: number, minChunk: number, maxChunk: number): number[] {
  const chunks: number[] = [];
  let remaining = Math.max(0, Math.round(total));
  while (remaining > 0) {
    const chunk = Math.min(remaining, randomInt(minChunk, maxChunk));
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

export interface DrivePlayContext {
  quarter: number;
  driveNumber: number;
  offenseAbbr: string;
  qb?: RatedPlayer;
  rb?: RatedPlayer;
  receiver?: RatedPlayer;
  kicker?: RatedPlayer;
  defenders: RatedPlayer[];
  outcome: "touchdown" | "field_goal" | "missed_field_goal" | "punt" | "turnover";
  rushYards: number;
  passYards: number;
  turnoverYards: number;
  turnoverType: "interception" | "fumble";
  scoredOnGround: boolean;
}

interface PlayState {
  down: number;
  distance: number;
  yardLine: number;
}

function makePlayFactory(ctx: DrivePlayContext) {
  const entries: Omit<PlayByPlayEntry, "sequence">[] = [];
  const push = (
    state: PlayState,
    playType: PlayType,
    description: string,
    yards: number,
    isScoring = false,
    isTurnover = false
  ) => {
    entries.push({
      quarter: ctx.quarter,
      driveNumber: ctx.driveNumber,
      offenseAbbr: ctx.offenseAbbr,
      down: state.down,
      distance: state.distance,
      yardLine: Math.round(state.yardLine),
      playType,
      description,
      yards,
      isScoring,
      isTurnover,
    });
  };
  return { entries, push };
}

function applyChunk(state: PlayState, yards: number) {
  const wasFirstDown = yards >= state.distance;
  state.yardLine = Math.max(1, Math.min(99, state.yardLine + yards));
  if (wasFirstDown) {
    state.down = 1;
    state.distance = Math.min(10, 100 - state.yardLine);
  } else {
    state.down = Math.min(4, state.down + 1);
    state.distance = Math.max(1, state.distance - yards);
  }
}

export function generateDrivePlays(ctx: DrivePlayContext): Omit<PlayByPlayEntry, "sequence">[] {
  const { entries, push } = makePlayFactory(ctx);
  const state: PlayState = { down: 1, distance: 10, yardLine: randomInt(18, 32) };

  const isTurnoverDrive = ctx.outcome === "turnover";
  const rushPool = distributeYards(isTurnoverDrive ? 0 : ctx.rushYards, 1, 12);
  const passPool = distributeYards(isTurnoverDrive ? 0 : ctx.passYards, 3, 25);
  const turnoverPool = distributeYards(isTurnoverDrive ? ctx.turnoverYards : 0, 2, 14);

  type Chunk = { type: "run" | "pass"; yards: number };
  const chunks: Chunk[] = shuffled([
    ...rushPool.map((yards): Chunk => ({ type: "run", yards })),
    ...passPool.map((yards): Chunk => ({ type: "pass", yards })),
    ...turnoverPool.map((yards): Chunk => ({ type: Math.random() < 0.6 ? "pass" : "run", yards })),
  ]);

  for (const chunk of chunks) {
    if (chunk.type === "pass" && Math.random() < 0.22) {
      push(
        state,
        "incomplete",
        `${downLabel(state.down)} & ${state.distance} at the ${fieldPosition(state.yardLine)}: ${shortName(
          ctx.qb,
          "The QB"
        )} pass incomplete intended for ${shortName(ctx.receiver, "the receiver")}.`,
        0
      );
      state.down = Math.min(4, state.down + 1);
    }

    const before = { ...state };
    if (chunk.type === "run") {
      push(
        before,
        "run",
        `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          ctx.rb,
          "The running back"
        )} rushes for ${chunk.yards} yard${chunk.yards === 1 ? "" : "s"}.`,
        chunk.yards
      );
    } else {
      push(
        before,
        "pass",
        `${downLabel(before.down)} & ${before.distance} at the ${fieldPosition(before.yardLine)}: ${shortName(
          ctx.qb,
          "The QB"
        )} pass complete to ${shortName(ctx.receiver, "the receiver")} for ${chunk.yards} yard${
          chunk.yards === 1 ? "" : "s"
        }.`,
        chunk.yards
      );
    }
    applyChunk(state, chunk.yards);
  }

  const final = { ...state };
  switch (ctx.outcome) {
    case "touchdown": {
      const yards = Math.max(1, 100 - final.yardLine);
      const scorerDesc = ctx.scoredOnGround
        ? `${shortName(ctx.rb, "The running back")} rushes ${yards} yard${yards === 1 ? "" : "s"} for the touchdown!`
        : `${shortName(ctx.qb, "The QB")} pass to ${shortName(ctx.receiver, "the receiver")}, ${yards} yard${
            yards === 1 ? "" : "s"
          }, TOUCHDOWN!`;
      push(final, "touchdown", `${downLabel(final.down)} & ${final.distance}: ${scorerDesc}`, yards, true);
      push({ down: 0, distance: 0, yardLine: 98 }, "extra_point", `${shortName(ctx.kicker, "The kicker")} extra point is good.`, 0, true);
      break;
    }
    case "field_goal":
    case "missed_field_goal": {
      const fgDistance = Math.max(18, 100 - final.yardLine + 17);
      const made = ctx.outcome === "field_goal";
      push(
        final,
        ctx.outcome,
        `${downLabel(final.down)} & ${final.distance}: ${shortName(ctx.kicker, "The kicker")} ${
          made ? "nails" : "misses"
        } a ${fgDistance}-yard field goal attempt.`,
        0,
        made
      );
      break;
    }
    case "punt": {
      // A fresh set of downs immediately followed by a punt reads oddly ("1st & 10 ... punt"),
      // so present the punt as coming on a later down when the drive just reset.
      const puntState = final.down === 1 ? { ...final, down: randomInt(3, 4), distance: randomInt(1, 8) } : final;
      push(
        puntState,
        "punt",
        `${downLabel(puntState.down)} & ${puntState.distance} at the ${fieldPosition(final.yardLine)}: ${ctx.offenseAbbr} sends out the punt team.`,
        0
      );
      break;
    }
    case "turnover": {
      const defender = pick(ctx.defenders);
      if (ctx.turnoverType === "interception") {
        push(
          final,
          "interception",
          `${downLabel(final.down)} & ${final.distance}: ${shortName(ctx.qb, "The QB")} pass INTERCEPTED by ${shortName(
            defender,
            "the defense"
          )}!`,
          0,
          false,
          true
        );
      } else {
        const carrier = Math.random() < 0.5 ? ctx.rb : ctx.receiver;
        push(
          final,
          "fumble",
          `${downLabel(final.down)} & ${final.distance}: ${shortName(
            carrier,
            "The ball carrier"
          )} FUMBLES, recovered by ${shortName(defender, "the defense")}!`,
          0,
          false,
          true
        );
      }
      break;
    }
  }

  return entries;
}
