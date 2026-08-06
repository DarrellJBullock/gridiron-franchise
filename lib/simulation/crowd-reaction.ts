import type { PlayByPlayEntry } from "@/types/football";

const SCORE_INTENSITY: Partial<Record<PlayByPlayEntry["playType"], number>> = {
  field_goal: 0.6,
  extra_point: 0.3,
};

const MIN_REACTION_INTENSITY = 0.18;

/**
 * How good `play` was for the home team, from -1 (terrible) to 1 (great).
 * Judged by outcome for the home team rather than literal possession — a
 * home defensive sack or interception is just as much a "home team play" to
 * a cheering crowd as a home offensive touchdown.
 */
export function homeCrowdDelta(play: PlayByPlayEntry, homeAbbr: string): number {
  const offenseIsHome = play.offenseAbbr === homeAbbr;
  const sign = offenseIsHome ? 1 : -1;

  if (play.isScoring) {
    return sign * (SCORE_INTENSITY[play.playType] ?? 1);
  }
  if (play.playType === "missed_field_goal") {
    return -sign * 0.5;
  }
  if (play.playType === "sack") {
    return -sign * Math.min(0.6, 0.3 + Math.abs(play.yards) * 0.03);
  }
  if (play.isTurnover) {
    return -sign * 0.75;
  }
  if (play.playType === "punt" || play.playType === "injury") {
    return 0;
  }
  const magnitude = Math.min(1, Math.abs(play.yards) / 18);
  return sign * Math.sign(play.yards) * magnitude;
}

export interface CrowdReaction {
  type: "cheer" | "boo";
  intensity: number;
}

/** Null below the noise floor — routine plays (short gains, incompletions) stay silent. */
export function homeCrowdReaction(play: PlayByPlayEntry, homeAbbr: string): CrowdReaction | null {
  const delta = homeCrowdDelta(play, homeAbbr);
  const intensity = Math.abs(delta);
  if (intensity < MIN_REACTION_INTENSITY) return null;
  return { type: delta > 0 ? "cheer" : "boo", intensity };
}
