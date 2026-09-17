"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { TeamLogo } from "@/components/football/TeamLogo";
import type { Field3DProps } from "@/components/simulation/field3d/Field3D";
import { homeCrowdReaction } from "@/lib/simulation/crowd-reaction";
import { playCheer, playBoo, playRoar, unlockCrowdAudio } from "@/lib/audio/crowd";
import type { PlayByPlayEntry } from "@/types/football";
import type { PlayerMotion } from "@/components/simulation/field3d/Field3D";

// Three.js touches document/WebGL at render time, which crashes during
// Next.js's server render of this "use client" component's first pass —
// load it client-only, after hydration.
const Field3D = dynamic<Field3DProps>(
  () => import("@/components/simulation/field3d/Field3D").then((mod) => mod.Field3D),
  { ssr: false, loading: () => <div className="aspect-[10/4] w-full animate-pulse rounded-lg bg-surface" /> }
);

interface TeamVisual {
  abbreviation: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

interface LiveGamePlayerProps {
  gameId: string;
  plays: PlayByPlayEntry[];
  home: TeamVisual;
  away: TeamVisual;
  /** Live simulations auto-start playing; replays of an already-decided game start paused. */
  autoPlay?: boolean;
}

const SPEEDS = { "1x": 1400, "2x": 700, "4x": 300 } as const;
type SpeedKey = keyof typeof SPEEDS;

function pointsForPlay(play: PlayByPlayEntry): number {
  switch (play.playType) {
    case "touchdown":
      return 6;
    case "kick_return":
    case "punt_return":
      return play.isScoring ? 6 : 0;
    case "extra_point":
      return 1;
    case "field_goal":
      return 3;
    default:
      return 0;
  }
}

function quarterLabel(quarter: number) {
  return quarter > 4 ? "OT" : `Q${quarter}`;
}

function formatGameClock(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function playIcon(playType: PlayByPlayEntry["playType"]) {
  switch (playType) {
    case "run":
      return "🏃";
    case "pass":
      return "🎯";
    case "incomplete":
      return "❌";
    case "touchdown":
      return "🏈";
    case "extra_point":
      return "✅";
    case "field_goal":
      return "🥅";
    case "missed_field_goal":
      return "🚫";
    case "punt":
      return "👢";
    case "kick_return":
    case "punt_return":
      return "🔄";
    case "interception":
    case "fumble":
      return "⚠️";
    case "penalty":
      return "🚩";
    case "sack":
      return "💥";
    case "injury":
      return "🏥";
    default:
      return "▪️";
  }
}

type MotionKind = "pass" | "run" | "sack" | "kick" | "straight";

function motionKind(play: PlayByPlayEntry): MotionKind {
  switch (play.playType) {
    case "sack":
      return "sack";
    case "pass":
    case "interception":
    case "incomplete":
      return "pass";
    case "run":
    case "fumble":
    case "kick_return":
    case "punt_return":
      return "run";
    case "field_goal":
    case "missed_field_goal":
    case "punt":
    case "extra_point":
      return "kick";
    case "touchdown":
      return play.description.toLowerCase().includes("pass") ? "pass" : "run";
    default:
      return "straight";
  }
}

const ENDZONE_WIDTH = 80;
const FIELD_WIDTH = 840;
const GOALPOST_INSET_PCT = 1.5;
const KICK_ATTEMPT_TYPES = new Set<PlayByPlayEntry["playType"]>(["field_goal", "missed_field_goal", "extra_point"]);
// Snap-formation dots are drawn for scrimmage-down plays only; special-teams
// plays (punts, kicks, returns) get a clear field so the ball flight and
// goalpost read without 22 overlapping dots.
const FORMATION_PLAY_TYPES = new Set<PlayByPlayEntry["playType"]>([
  "run",
  "pass",
  "incomplete",
  "touchdown",
  "interception",
  "fumble",
  "sack",
  "penalty",
]);

// yardLine is stored relative to the offense's own goal line (0-100). The
// field is drawn with the home team's goal line on the left and away's on
// the right, so an away possession needs to be mirrored to land in the
// right spot visually.
function absoluteFieldX(yardLine: number, offenseAbbr: string, homeAbbr: string): number {
  const absoluteYardLine = offenseAbbr === homeAbbr ? yardLine : 100 - yardLine;
  return ENDZONE_WIDTH + (absoluteYardLine / 100) * FIELD_WIDTH;
}

// Goalposts stand at the back of whichever end zone the kicking team is
// driving toward — the opposite side of the field from their own goal line.
function goalpostX(offenseAbbr: string, homeAbbr: string): number {
  const insetX = (GOALPOST_INSET_PCT / 100) * 1000;
  return offenseAbbr === homeAbbr ? 1000 - insetX : insetX;
}

// Pre-snap alignment, expressed as offsets from the ball along the direction
// of attack (local +x = downfield for the offense) and across the hash
// (local y, field center = 0). Depths are real: 1 world-x unit ≈ 1/8.4 yard
// (FIELD_WIDTH=840 units for 100 yards), so a QB "under center" sits ~1 yard
// back (x≈-8) and a true shotgun QB sits ~5.5 yards back (x≈-46) — these
// aren't the same vague middle depth, they're the two actual alignments.
//
// Real teams change personnel and spacing by situation — short yardage packs
// extra blockers into the box in a real stacked I-formation, obvious passing
// downs go to a genuine shotgun with receivers spread (a trips look on one
// side, one isolated on the other) — and the defense counters each look with
// its own real package (base 4-3, nickel, dime, or a loaded goal-line box).
// These four shapes are picked by down/distance/field position in
// selectFormationVariant below.
type FormationVariant = "base" | "spread" | "obviousPass" | "goalLine";

interface FormationSlot {
  x: number;
  y: number;
  role: string;
}

// Singleback, 11 personnel (1 RB, 1 TE, 3 WR): QB under center, single back
// deep enough to actually be a tailback rather than crowding the QB's heels.
const OFFENSE_SINGLEBACK: readonly FormationSlot[] = [
  { x: 3, y: -42, role: "OL" },
  { x: 3, y: -21, role: "OL" },
  { x: 3, y: 0, role: "OL" },
  { x: 3, y: 21, role: "OL" },
  { x: 3, y: 42, role: "OL" },
  { x: -8, y: 0, role: "QB" },
  { x: -58, y: 10, role: "RB" },
  { x: 3, y: 62, role: "TE" },
  { x: -2, y: -128, role: "WR" },
  { x: -2, y: 128, role: "WR" },
  { x: 4, y: -96, role: "WR" },
];

// True shotgun, 10 personnel (1 RB, 4 WR), trips right: three receivers
// bunched to one side, one isolated on the backside — a real modern
// obvious-passing-down shape, not a symmetric 2-and-2 split.
const OFFENSE_SHOTGUN_TRIPS: readonly FormationSlot[] = [
  { x: 3, y: -42, role: "OL" },
  { x: 3, y: -21, role: "OL" },
  { x: 3, y: 0, role: "OL" },
  { x: 3, y: 21, role: "OL" },
  { x: 3, y: 42, role: "OL" },
  { x: -46, y: 0, role: "QB" },
  { x: -42, y: -16, role: "RB" },
  { x: -2, y: -148, role: "WR" }, // isolated backside X
  { x: 6, y: 90, role: "WR" }, // trips: innermost slot
  { x: 2, y: 118, role: "WR" }, // trips: middle
  { x: -2, y: 144, role: "WR" }, // trips: outside
];

// Real goal-line/short-yardage I-formation, 22 personnel (2 backs incl. FB,
// 2 TE, 1 WR): FB and tailback stacked directly behind the QB — the actual
// "I" shape — instead of the two backs sitting side by side.
const OFFENSE_I_FORM: readonly FormationSlot[] = [
  { x: 3, y: -42, role: "OL" },
  { x: 3, y: -21, role: "OL" },
  { x: 3, y: 0, role: "OL" },
  { x: 3, y: 21, role: "OL" },
  { x: 3, y: 42, role: "OL" },
  { x: -8, y: 0, role: "QB" },
  { x: -38, y: 0, role: "FB" }, // lead blocker, stacked behind the QB
  { x: -58, y: 0, role: "RB" }, // tailback, stacked behind the FB
  { x: 3, y: 58, role: "TE" },
  { x: 3, y: -58, role: "TE" },
  { x: -2, y: 110, role: "WR" },
];

const DEFENSE_BASE_43: readonly FormationSlot[] = [
  { x: 9, y: -30, role: "DL" },
  { x: 9, y: -10, role: "DL" },
  { x: 9, y: 10, role: "DL" },
  { x: 9, y: 30, role: "DL" },
  { x: 26, y: -26, role: "LB" },
  { x: 26, y: 0, role: "LB" },
  { x: 26, y: 26, role: "LB" },
  { x: 17, y: -118, role: "CB" },
  { x: 17, y: 118, role: "CB" },
  { x: 52, y: -38, role: "S" },
  { x: 52, y: 38, role: "S" },
];

// Nickel: a 3rd CB (over the slot) replaces a LB to match the offense's
// extra receiver.
const DEFENSE_NICKEL: readonly FormationSlot[] = [
  { x: 9, y: -30, role: "DL" },
  { x: 9, y: -10, role: "DL" },
  { x: 9, y: 10, role: "DL" },
  { x: 9, y: 30, role: "DL" },
  { x: 26, y: -16, role: "LB" },
  { x: 26, y: 16, role: "LB" },
  { x: 17, y: -118, role: "CB" },
  { x: 17, y: 118, role: "CB" },
  { x: 20, y: -70, role: "CB" },
  { x: 52, y: -38, role: "S" },
  { x: 52, y: 38, role: "S" },
];

// Dime: a 4th and 5th CB for obvious-passing/very-long-yardage situations,
// down to a single "money" linebacker — six defensive backs on the field.
const DEFENSE_DIME: readonly FormationSlot[] = [
  { x: 9, y: -24, role: "DL" },
  { x: 9, y: -8, role: "DL" },
  { x: 9, y: 8, role: "DL" },
  { x: 9, y: 24, role: "DL" },
  { x: 26, y: 0, role: "LB" },
  { x: 17, y: -140, role: "CB" },
  { x: 17, y: 140, role: "CB" },
  { x: 20, y: -90, role: "CB" },
  { x: 20, y: 90, role: "CB" },
  { x: 52, y: -38, role: "S" },
  { x: 52, y: 38, role: "S" },
];

// Goal-line stack: an extra DL and LB crowd the box, only one deep safety.
const DEFENSE_GOAL_LINE_STACK: readonly FormationSlot[] = [
  { x: 7, y: -36, role: "DL" },
  { x: 7, y: -18, role: "DL" },
  { x: 7, y: 0, role: "DL" },
  { x: 7, y: 18, role: "DL" },
  { x: 7, y: 36, role: "DL" },
  { x: 20, y: -20, role: "LB" },
  { x: 20, y: 0, role: "LB" },
  { x: 20, y: 20, role: "LB" },
  { x: 14, y: -70, role: "CB" },
  { x: 14, y: 70, role: "CB" },
  { x: 34, y: 0, role: "S" },
];

const OFFENSE_FORMATIONS: Record<FormationVariant, readonly FormationSlot[]> = {
  base: OFFENSE_SINGLEBACK,
  spread: OFFENSE_SHOTGUN_TRIPS,
  obviousPass: OFFENSE_SHOTGUN_TRIPS,
  goalLine: OFFENSE_I_FORM,
};
const DEFENSE_FORMATIONS: Record<FormationVariant, readonly FormationSlot[]> = {
  base: DEFENSE_BASE_43,
  spread: DEFENSE_NICKEL,
  obviousPass: DEFENSE_DIME,
  goalLine: DEFENSE_GOAL_LINE_STACK,
};

// Short yardage/goal-to-go situations pack extra blockers into a real
// I-formation; long-yardage downs go to a real shotgun trips look, with the
// defense answering with nickel (moderately long) or dime (very long, an
// obvious passing situation). Anything else runs the base singleback set.
function selectFormationVariant(down: number, distance: number, yardLine: number): FormationVariant {
  const goalToGo = yardLine >= 90;
  const shortYardage = distance <= 2 && down >= 2;
  if (goalToGo || shortYardage) return "goalLine";
  if (distance >= 12 && down >= 2) return "obviousPass";
  if (distance >= 7 && down >= 2) return "spread";
  return "base";
}

// Special-teams personnel: a protection line holds its blocks (no route/
// pursuit motion — extraMotion's default "kick" case is a no-op) while the
// kicker/punter/holder just stand in their spot and the kicking leg swings
// in place via PlayerMesh's isKicker animation.
type SpecialTeamsVariant = "fieldGoal" | "punt";

const OFFENSE_FIELD_GOAL: readonly FormationSlot[] = [
  { x: 3, y: -42, role: "OL" },
  { x: 3, y: -21, role: "OL" },
  { x: 3, y: 0, role: "OL" },
  { x: 3, y: 21, role: "OL" },
  { x: 3, y: 42, role: "OL" },
  { x: 3, y: -62, role: "OL" },
  { x: 3, y: 62, role: "OL" },
  { x: -24, y: 0, role: "H" },
  { x: -40, y: 0, role: "K" },
];

const OFFENSE_PUNT: readonly FormationSlot[] = [
  { x: 3, y: -42, role: "OL" },
  { x: 3, y: -21, role: "OL" },
  { x: 3, y: 0, role: "OL" },
  { x: 3, y: 21, role: "OL" },
  { x: 3, y: 42, role: "OL" },
  { x: 3, y: -62, role: "OL" },
  { x: 3, y: 62, role: "OL" },
  { x: -55, y: 0, role: "P" },
];

const DEFENSE_FIELD_GOAL_BLOCK: readonly FormationSlot[] = [
  { x: 9, y: -36, role: "DL" },
  { x: 9, y: -18, role: "DL" },
  { x: 9, y: 0, role: "DL" },
  { x: 9, y: 18, role: "DL" },
  { x: 9, y: 36, role: "DL" },
  { x: 9, y: -54, role: "DL" },
  { x: 9, y: 54, role: "DL" },
  { x: 30, y: -20, role: "LB" },
  { x: 30, y: 20, role: "LB" },
];

const DEFENSE_PUNT_RETURN: readonly FormationSlot[] = [
  { x: 9, y: -36, role: "DL" },
  { x: 9, y: -18, role: "DL" },
  { x: 9, y: 0, role: "DL" },
  { x: 9, y: 18, role: "DL" },
  { x: 9, y: 36, role: "DL" },
  { x: 26, y: -20, role: "LB" },
  { x: 26, y: 20, role: "LB" },
  { x: 68, y: 0, role: "S" }, // deep returner
];

const OFFENSE_SPECIAL_TEAMS: Record<SpecialTeamsVariant, readonly FormationSlot[]> = {
  fieldGoal: OFFENSE_FIELD_GOAL,
  punt: OFFENSE_PUNT,
};
const DEFENSE_SPECIAL_TEAMS: Record<SpecialTeamsVariant, readonly FormationSlot[]> = {
  fieldGoal: DEFENSE_FIELD_GOAL_BLOCK,
  punt: DEFENSE_PUNT_RETURN,
};

// A kick/punt return: the receiving team's blockers spread wide ahead of the
// returner (who is rendered separately as the gold ball-carrier mesh) to
// spring him, while the kicking team's coverage unit fans out across the
// whole width and converges on him as the play develops.
const OFFENSE_RETURN_BLOCKERS: readonly FormationSlot[] = [
  { x: 20, y: -110, role: "OL" },
  { x: 20, y: -70, role: "OL" },
  { x: 20, y: -35, role: "OL" },
  { x: 20, y: 0, role: "OL" },
  { x: 20, y: 35, role: "OL" },
  { x: 20, y: 70, role: "OL" },
  { x: 20, y: 110, role: "OL" },
];

const DEFENSE_RETURN_COVERAGE: readonly FormationSlot[] = [
  { x: 40, y: -120, role: "CB" },
  { x: 40, y: -85, role: "CB" },
  { x: 40, y: -50, role: "LB" },
  { x: 40, y: -15, role: "LB" },
  { x: 40, y: 15, role: "LB" },
  { x: 40, y: 50, role: "LB" },
  { x: 40, y: 85, role: "CB" },
  { x: 40, y: 120, role: "CB" },
];

interface FormationDot {
  key: string;
  role: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  viaX?: number;
  viaY?: number;
}

// A handful of real route shapes, cycled across the WR corps by index. Each
// pairs a downfield depth/lateral finish (used by extraMotion below) with a
// route-break style (used by wrViaPoint) so the routes actually read as
// different shapes rather than one generic stem-and-cut for every receiver.
type WrRoute = "go" | "out" | "slant" | "comeback";
const WR_ROUTES: readonly WrRoute[] = ["go", "out", "slant", "comeback"];
function wrRoute(index: number): WrRoute {
  return WR_ROUTES[index % WR_ROUTES.length];
}

// How far (and which way, laterally) each role moves downfield over the
// course of the play, in the same local-offset units as the formation
// tables above — not a real route tree, just enough per-role variety to
// read as "the play developed" instead of 22 players frozen at the snap.
function extraMotion(role: string, kind: MotionKind, index: number, localY: number): { x: number; y: number } {
  switch (kind) {
    case "pass":
      switch (role) {
        case "QB":
          return { x: -8, y: 0 };
        case "RB":
          return { x: -3, y: 4 };
        case "TE":
          return { x: 16, y: 8 };
        case "WR": {
          // A route breaks toward the boundary this receiver is already
          // split toward (out) or back across the field (slant) — not a
          // fixed left/right offset regardless of where he lined up.
          const side = localY < 0 ? -1 : 1;
          switch (wrRoute(index)) {
            case "go":
              return { x: 46, y: side * 4 }; // straight fly route up the seam/sideline
            case "out":
              return { x: 20, y: side * 34 }; // breaks hard toward his own sideline
            case "slant":
              return { x: 14, y: -side * 22 }; // quick break across the middle
            case "comeback":
              return { x: 26, y: side * 6 }; // pushes vertical, settles back toward the QB
          }
        }
        case "DL":
          return { x: 11, y: 0 };
        case "LB":
          return { x: -3, y: 0 };
        case "CB":
          return { x: 32, y: 0 };
        case "S":
          return { x: 44, y: 0 };
        default:
          return { x: 2, y: 0 }; // OL: brief pass-set shuffle
      }
    case "run":
      switch (role) {
        case "QB":
          return { x: 3, y: 0 };
        case "RB":
          // Fallback only — a real run/touchdown play overrides the RB's
          // whole route with an explicit handoff-and-carry path below, so
          // this is just a reasonable burst for the rare case (a fumble)
          // that reaches here without going through that override.
          return { x: 14, y: 0 };
        case "TE":
          return { x: 9, y: 0 };
        case "WR":
          return { x: 12, y: 0 };
        case "DL":
        case "LB":
        case "CB":
        case "S":
          return { x: 6, y: 0 }; // pursuit angle; lateral convergence handled below
        default:
          return { x: 7, y: 0 }; // OL: drive block
      }
    case "sack":
      switch (role) {
        case "QB":
          return { x: -10, y: 0 };
        case "DL":
          return { x: 13, y: 0 };
        default:
          return role === "OL" ? { x: -3, y: 0 } : { x: 0, y: 0 };
      }
    case "kick":
      switch (role) {
        case "K":
        case "P":
          return { x: 5, y: 0 }; // the approach steps into the kick
        default:
          return { x: 0, y: 0 }; // protection holds its blocks
      }
    default:
      return { x: 0, y: 0 };
  }
}

// Defenders pull laterally toward the ball's lane as a run develops (or
// toward the QB on a sack), rather than holding their pre-snap width.
function lateralConvergence(role: string, kind: MotionKind): number {
  if (kind === "run" && (role === "DL" || role === "LB" || role === "CB" || role === "S")) return 0.55;
  if (kind === "sack" && role === "DL") return 0.35;
  return 1;
}

function clampField(x: number, y: number) {
  return {
    x: Math.min(1000 - ENDZONE_WIDTH - 6, Math.max(ENDZONE_WIDTH + 6, x)),
    y: Math.min(282, Math.max(18, y)),
  };
}

// The route-break shape for a given WR's route type: a "go" runs a straight
// stem with no break, "out"/"slant" hold their stem lateral before cutting
// hard to the finish, and "comeback" pushes a few yards past the settle
// point before working back toward the quarterback — an overshoot the
// quadratic curve eases out of rather than a literal reversal.
function wrViaPoint(
  route: WrRoute,
  start: { x: number; y: number },
  end: { x: number; y: number }
): { x: number; y: number } | null {
  switch (route) {
    case "go":
      return null;
    case "out":
    case "slant":
      return { x: start.x + (end.x - start.x) * 0.65, y: start.y };
    case "comeback":
      return { x: end.x + (end.x - start.x) * 0.25, y: end.y };
  }
}

function buildFormation(
  local: readonly FormationSlot[],
  startBallX: number,
  endBallX: number,
  forwardSign: 1 | -1,
  kind: MotionKind,
  prefix: string
): FormationDot[] {
  return local.map((p, i) => {
    const role = p.role;
    const extra = extraMotion(role, kind, i, p.y);
    const conv = lateralConvergence(role, kind);
    const start = clampField(startBallX + forwardSign * p.x, 150 + p.y);
    const end = clampField(endBallX + forwardSign * (p.x + extra.x), 150 + p.y * conv + extra.y);
    const isRoute = kind === "pass" && (role === "WR" || role === "TE");
    // WRs get a real route shape; a lone TE just holds its old generic
    // stem-and-cut (its routes are short and don't vary much anyway).
    const rawVia = isRoute ? (role === "WR" ? wrViaPoint(wrRoute(i), start, end) : { x: start.x + (end.x - start.x) * 0.6, y: start.y }) : null;
    const via = rawVia ? clampField(rawVia.x, rawVia.y) : null;
    return {
      key: `${prefix}-${i}`,
      role,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      viaX: via?.x,
      viaY: via?.y,
    };
  });
}

interface BannerInfo {
  text: string;
  sub: string;
  color: string;
}

function bannerFor(play: PlayByPlayEntry, offenseColor: string, defenseColor: string): BannerInfo | null {
  if (play.playType === "touchdown" || (play.isScoring && play.playType !== "field_goal" && play.playType !== "extra_point")) {
    return { text: "TOUCHDOWN!", sub: play.offenseAbbr, color: offenseColor };
  }
  if (play.playType === "field_goal" && play.isScoring) {
    return { text: "FIELD GOAL GOOD", sub: play.offenseAbbr, color: offenseColor };
  }
  if (play.playType === "missed_field_goal") {
    return { text: "NO GOOD", sub: play.offenseAbbr, color: defenseColor };
  }
  if (play.playType === "interception") {
    return { text: "INTERCEPTED!", sub: "TURNOVER", color: defenseColor };
  }
  if (play.playType === "fumble" && play.isTurnover) {
    return { text: "FUMBLE!", sub: "TURNOVER", color: defenseColor };
  }
  return null;
}

export function LiveGamePlayer({ gameId, plays, home, away, autoPlay = true }: LiveGamePlayerProps) {
  const router = useRouter();
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState<SpeedKey>("1x");
  const [crowdEnabled, setCrowdEnabled] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactedIndexRef = useRef(-1);

  const finished = index >= plays.length - 1;

  useEffect(() => {
    if (!playing || finished || plays.length === 0) return;
    timeoutRef.current = setTimeout(() => {
      setIndex((i) => Math.min(i + 1, plays.length - 1));
    }, SPEEDS[speed]);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [playing, finished, plays.length, speed, index]);

  // Home-crowd cheer/boo reaction to whichever play we just landed on.
  // Marking the index as "handled" happens regardless of the mute state so
  // toggling crowd noise back on mid-game doesn't replay a stale reaction.
  useEffect(() => {
    if (index < 0 || reactedIndexRef.current === index) return;
    reactedIndexRef.current = index;
    if (!crowdEnabled) return;
    const reaction = homeCrowdReaction(plays[index], home.abbreviation);
    if (!reaction) return;
    if (reaction.type === "cheer") {
      playCheer(reaction.intensity);
      playRoar(reaction.intensity);
    } else {
      playBoo(reaction.intensity);
    }
  }, [index, crowdEnabled, plays, home.abbreviation]);

  const { homeScore, awayScore } = useMemo(() => {
    let h = 0;
    let a = 0;
    for (let i = 0; i <= index; i++) {
      const pts = pointsForPlay(plays[i]);
      if (pts === 0) continue;
      if (plays[i].offenseAbbr === home.abbreviation) h += pts;
      else a += pts;
    }
    return { homeScore: h, awayScore: a };
  }, [index, plays, home.abbreviation]);

  if (plays.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-text-faint">No plays to show for this game.</p>
      </Card>
    );
  }

  const current = plays[Math.max(index, 0)];
  const offenseIsHome = current.offenseAbbr === home.abbreviation;
  const offenseTeam = offenseIsHome ? home : away;
  const defenseTeam = offenseIsHome ? away : home;
  const ballX = absoluteFieldX(current.yardLine, current.offenseAbbr, home.abbreviation);
  const scoredThisPlay = current.isScoring && pointsForPlay(current) > 0;
  const homeJustScored = scoredThisPlay && offenseIsHome;
  const awayJustScored = scoredThisPlay && !offenseIsHome;

  const showFirstDownLine = index >= 0 && current.down >= 1 && current.down <= 4 && current.distance > 0;
  const firstDownX = showFirstDownLine
    ? absoluteFieldX(Math.min(100, current.yardLine + current.distance), current.offenseAbbr, home.abbreviation)
    : null;

  const prevPlay = index > 0 ? plays[index - 1] : null;
  const prevBallX = prevPlay ? absoluteFieldX(prevPlay.yardLine, prevPlay.offenseAbbr, home.abbreviation) : ballX;
  const kind = index >= 0 ? motionKind(current) : "straight";
  const motionDurationMs = Math.max(280, Math.round(SPEEDS[speed] * 0.7));

  // Field goals/extra points fly to the actual goalpost instead of just the
  // line of scrimmage — dead center through the posts on a make, offset to
  // one side on a miss (side picked deterministically from the play so it
  // doesn't flicker between re-renders).
  const isKickAttempt = index >= 0 && KICK_ATTEMPT_TYPES.has(current.playType);
  const kickTargetX = isKickAttempt ? goalpostX(current.offenseAbbr, home.abbreviation) : ballX;
  const kickTargetY = isKickAttempt
    ? current.isScoring
      ? 150
      : 150 + (current.sequence % 2 === 0 ? -42 : 42)
    : 150;
  const kickMissed = isKickAttempt && !scoredThisPlay;

  // Snap formation: offense always attacks toward +x when home, -x when away.
  const forwardSign: 1 | -1 = offenseIsHome ? 1 : -1;
  const showFormation = index >= 0 && FORMATION_PLAY_TYPES.has(current.playType);
  const isSpecialTeamsPlay = index >= 0 && (KICK_ATTEMPT_TYPES.has(current.playType) || current.playType === "punt");
  const isReturnPlay = index >= 0 && (current.playType === "kick_return" || current.playType === "punt_return");
  const formationVariant = selectFormationVariant(current.down, current.distance, current.yardLine);
  const specialTeamsVariant: SpecialTeamsVariant = current.playType === "punt" ? "punt" : "fieldGoal";
  const offenseDots = showFormation
    ? buildFormation(OFFENSE_FORMATIONS[formationVariant], prevBallX, ballX, forwardSign, kind, `off-${index}`)
    : isSpecialTeamsPlay
      ? // Protection holds its blocks at the line — anchor start/end to the
        // same spot so linemen don't slide toward wherever the kick lands.
        buildFormation(OFFENSE_SPECIAL_TEAMS[specialTeamsVariant], prevBallX, prevBallX, forwardSign, kind, `off-${index}`)
      : isReturnPlay
        ? buildFormation(OFFENSE_RETURN_BLOCKERS, prevBallX, ballX, forwardSign, kind, `off-${index}`)
        : [];
  const defenseDots = showFormation
    ? buildFormation(DEFENSE_FORMATIONS[formationVariant], prevBallX, ballX, forwardSign, kind, `def-${index}`)
    : isSpecialTeamsPlay
      ? buildFormation(DEFENSE_SPECIAL_TEAMS[specialTeamsVariant], prevBallX, prevBallX, forwardSign, kind, `def-${index}`)
      : isReturnPlay
        ? buildFormation(DEFENSE_RETURN_COVERAGE, prevBallX, ballX, forwardSign, kind, `def-${index}`)
        : [];
  // A real run (or a running touchdown) gets an actual QB-to-RB handoff:
  // the running back's own dot — not an anonymous ball-carrier mesh — takes
  // the ball, so the exchange and the carry are the same player. Returns and
  // fumbles fall back to the generic anonymous carrier below (there's no RB
  // pre-snap dot to hand off to on a return, and a fumble's post-recovery
  // path doesn't really belong to any one formation slot).
  const isRbRunPlay = kind === "run" && (current.playType === "run" || current.playType === "touchdown");
  const ballCarrierRuns = kind === "run" && current.playType !== "sack" && !isRbRunPlay;

  // For a run/sack, whichever defender ends up closest to where the play
  // dies is the one who gets the tackle animation.
  const tacklerKey =
    (kind === "run" || kind === "sack") && defenseDots.length > 0
      ? defenseDots.reduce((closest, d) => {
          const dist = Math.hypot(d.endX - ballX, d.endY - 150);
          const closestDist = Math.hypot(closest.endX - ballX, closest.endY - 150);
          return dist < closestDist ? d : closest;
        }).key
      : null;

  // A pass targets an actual receiver rather than a generic midfield spot:
  // whichever eligible receiver's route ends closest to where the play's
  // real result landed is treated as the intended target. What happens at
  // the catch point then depends on how the play actually resolved —
  // completions land in the receiver's hands, interceptions go to the
  // nearest DB instead, and incompletions sail just past the intended
  // target's outstretched hand rather than landing in it.
  const passOutcome: "complete" | "incomplete" | "interception" =
    current.playType === "interception" ? "interception" : current.playType === "incomplete" ? "incomplete" : "complete";
  const eligibleReceivers = kind === "pass" ? offenseDots.filter((d) => d.role === "WR" || d.role === "TE") : [];
  const targetReceiver =
    passOutcome !== "interception" && eligibleReceivers.length > 0
      ? eligibleReceivers.reduce((closest, d) => (Math.abs(d.endX - ballX) < Math.abs(closest.endX - ballX) ? d : closest))
      : null;
  const coverageDefenders = kind === "pass" ? defenseDots.filter((d) => d.role === "CB" || d.role === "S") : [];
  const interceptor =
    passOutcome === "interception" && coverageDefenders.length > 0
      ? coverageDefenders.reduce((closest, d) => {
          const dist = Math.hypot(d.endX - ballX, d.endY - 150);
          const closestDist = Math.hypot(closest.endX - ballX, closest.endY - 150);
          return dist < closestDist ? d : closest;
        })
      : null;
  // Whichever DB ends up nearest the intended target is the one who broke
  // the pass up.
  const breakupDefender =
    passOutcome === "incomplete" && targetReceiver && coverageDefenders.length > 0
      ? coverageDefenders.reduce((closest, d) => {
          const dist = Math.hypot(d.endX - targetReceiver.endX, d.endY - targetReceiver.endY);
          const closestDist = Math.hypot(closest.endX - targetReceiver.endX, closest.endY - targetReceiver.endY);
          return dist < closestDist ? d : closest;
        })
      : null;
  // A near miss — the ball sails a few yards past or wide of the target
  // instead of settling exactly into his hands.
  const incompleteMissX = current.sequence % 2 === 0 ? -16 : 16;
  const incompleteMissY = current.sequence % 3 === 0 ? -20 : 20;
  const passTargetX =
    interceptor?.endX ??
    (passOutcome === "incomplete" && targetReceiver ? targetReceiver.endX + incompleteMissX : targetReceiver?.endX) ??
    ballX;
  const passTargetY =
    interceptor?.endY ??
    (passOutcome === "incomplete" && targetReceiver ? targetReceiver.endY + incompleteMissY : targetReceiver?.endY) ??
    150;

  // On a real run/touchdown, the RB's route is overridden entirely: instead
  // of its formation-table finish, it runs to wherever the QB ends up (the
  // exchange point) and then on to the play's actual result — a real
  // handoff-and-carry path rather than a generic drive-block shuffle.
  const handoffQb = isRbRunPlay ? offenseDots.find((d) => d.role === "QB") : null;

  const players3D: PlayerMotion[] = [
    ...offenseDots.map((d) => {
      const isBallCarrierRb = isRbRunPlay && d.role === "RB";
      return {
        key: d.key,
        startX: d.startX,
        startY: d.startY,
        endX: isBallCarrierRb ? ballX : d.endX,
        endY: isBallCarrierRb ? 150 : d.endY,
        color: offenseTeam.primaryColor,
        ring: offenseTeam.secondaryColor,
        viaX: isBallCarrierRb ? handoffQb?.endX : d.viaX,
        viaY: isBallCarrierRb ? handoffQb?.endY : d.viaY,
        isKicker: d.role === "K" || d.role === "P",
        isPasser: kind === "pass" && d.role === "QB",
        isReceiver: passOutcome === "complete" && targetReceiver !== null && d.key === targetReceiver.key,
        isBallHandler: (kind === "sack" && d.role === "QB") || isBallCarrierRb,
        isCarrier: isBallCarrierRb,
        isHandingOff: isRbRunPlay && d.role === "QB",
      };
    }),
    ...defenseDots.map((d) => ({
      key: d.key,
      startX: d.startX,
      startY: d.startY,
      endX: d.endX,
      endY: d.endY,
      color: defenseTeam.primaryColor,
      ring: defenseTeam.secondaryColor,
      isTackler: d.key === tacklerKey,
      isReceiver: d.key === interceptor?.key || d.key === breakupDefender?.key,
    })),
  ];

  const banner = index >= 0 ? bannerFor(current, offenseTeam.primaryColor, defenseTeam.primaryColor) : null;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <ScoreBug
        home={home}
        away={away}
        homeScore={homeScore}
        awayScore={awayScore}
        homeJustScored={homeJustScored}
        awayJustScored={awayJustScored}
        possessionIsHome={index >= 0 ? offenseIsHome : null}
        quarter={current.quarter}
        seconds={current.secondsRemaining}
        downDistance={
          index < 0 ? "Kickoff" : `${["", "1st", "2nd", "3rd", "4th"][current.down] ?? current.down} & ${current.distance}`
        }
      />

      <div className="relative">
        {/* Stadium upper deck: floodlights + crowd texture + broadcast bug, framing the tilted field like a real wide shot */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-t-lg border border-b-0 border-border-line bg-gradient-to-b from-[#05070d] via-[#0a0e18] to-transparent px-3 py-1.5">
          <div className="crowd-texture absolute inset-0 opacity-70" aria-hidden />
          <div className="stadium-lights absolute inset-0" aria-hidden />
          <div className="relative flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/90">GFN Live</span>
          </div>
          <span className="relative text-[10px] font-semibold uppercase tracking-widest text-white/40">Gridiron Franchise Network</span>
        </div>

        <div className="relative">
          <Field3D
            home={home}
            away={away}
            playIndex={index}
            kind={kind}
            isKickAttempt={isKickAttempt}
            scoredThisPlay={scoredThisPlay}
            kickMissed={kickMissed}
            motionDurationMs={motionDurationMs}
            ballFromX={prevBallX}
            ballToX={isKickAttempt ? kickTargetX : kind === "pass" ? passTargetX : ballX}
            ballToY={isKickAttempt ? kickTargetY : kind === "pass" ? passTargetY : 150}
            lineOfScrimmageX={index >= 0 ? ballX : null}
            firstDownX={firstDownX}
            players={players3D}
            ballCarrierRides={ballCarrierRuns}
          />

          <AnimatePresence>
            {banner && (
              <motion.div
                key={`banner-${index}`}
                initial={{ opacity: 0, scale: 0.75, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -6 }}
                transition={{ type: "spring", stiffness: 340, damping: 22 }}
                className="pointer-events-none absolute inset-x-0 top-[38%] z-20 flex flex-col items-center"
              >
                <div
                  className="rounded-md border-2 px-6 py-2 text-center shadow-[0_10px_40px_-8px_rgba(0,0,0,0.8)] backdrop-blur-sm"
                  style={{ borderColor: banner.color, backgroundColor: "rgba(5,7,13,0.82)" }}
                >
                  <p className="text-2xl font-black italic tracking-wide text-white sm:text-3xl" style={{ textShadow: `0 0 18px ${banner.color}` }}>
                    {banner.text}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-muted">{banner.sub}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Lower stands strip, mirroring the upper deck to close out the stadium frame */}
        <div className="relative overflow-hidden rounded-b-lg border border-t-0 border-border-line bg-gradient-to-t from-[#05070d] via-[#0a0e18] to-transparent py-1.5">
          <div className="crowd-texture absolute inset-0 opacity-70" aria-hidden />
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border-line bg-surface/60 px-4 py-3">
        <span className="text-lg">{index < 0 ? "🏈" : playIcon(current.playType)}</span>
        <p
          className={
            index < 0
              ? "text-sm text-text-muted"
              : current.isScoring
                ? "text-sm font-semibold text-accent"
                : current.isTurnover
                  ? "text-sm font-semibold text-danger"
                  : current.playType === "penalty"
                    ? "text-sm font-semibold text-yellow-400"
                    : current.playType === "injury"
                      ? "text-sm font-semibold text-orange-400"
                      : "text-sm text-text-primary"
          }
        >
          {index < 0 ? "Ready to kick off." : current.description}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              unlockCrowdAudio();
              setPlaying((p) => !p);
            }}
            disabled={finished}
          >
            {finished ? "Finished" : playing ? "⏸ Pause" : "▶ Play"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              unlockCrowdAudio();
              setCrowdEnabled((e) => !e);
            }}
            title="Toggle home crowd cheer/boo reactions"
          >
            {crowdEnabled ? "🔊 Crowd" : "🔇 Crowd"}
          </Button>
          {(Object.keys(SPEEDS) as SpeedKey[]).map((s) => (
            <Button
              key={s}
              variant={speed === s ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSpeed(s)}
            >
              {s}
            </Button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setIndex(plays.length - 1)} disabled={finished}>
            Skip to End
          </Button>
        </div>
        {finished ? (
          <LinkButton href={`/game/${gameId}`} size="sm">
            View Full Recap →
          </LinkButton>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => router.push(`/game/${gameId}`)}>
            Skip to Recap →
          </Button>
        )}
      </div>

      <p className="text-right text-[11px] text-text-faint">
        Play {Math.max(index + 1, 0)} of {plays.length}
      </p>
    </Card>
  );
}

// The persistent Madden-style "score bug": team blocks edged in each team's
// own color, a center clock/down cluster, and a small arrow that points at
// whichever side currently has the ball.
function ScoreBug({
  home,
  away,
  homeScore,
  awayScore,
  homeJustScored,
  awayJustScored,
  possessionIsHome,
  quarter,
  seconds,
  downDistance,
}: {
  home: TeamVisual;
  away: TeamVisual;
  homeScore: number;
  awayScore: number;
  homeJustScored: boolean;
  awayJustScored: boolean;
  possessionIsHome: boolean | null;
  quarter: number;
  seconds: number;
  downDistance: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-border-line bg-bg-elevated shadow-sm">
      <ScoreBugTeam team={home} score={homeScore} justScored={homeJustScored} possession={possessionIsHome === true} align="left" />
      <div className="flex flex-col items-center justify-center gap-1 border-x border-border-line bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-surface-hover px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-text-primary">
            {quarterLabel(quarter)}
          </span>
          <span className="font-mono text-lg font-bold tabular-nums text-accent">{formatGameClock(seconds)}</span>
        </div>
        <span className="whitespace-nowrap text-[11px] font-bold uppercase tracking-wide text-text-muted">{downDistance}</span>
      </div>
      <ScoreBugTeam team={away} score={awayScore} justScored={awayJustScored} possession={possessionIsHome === false} align="right" />
    </div>
  );
}

function ScoreBugTeam({
  team,
  score,
  justScored,
  possession,
  align,
}: {
  team: TeamVisual;
  score: number;
  justScored: boolean;
  possession: boolean;
  align: "left" | "right";
}) {
  const isRight = align === "right";
  return (
    <div
      className={`flex flex-1 items-center gap-2.5 px-3 py-2 ${isRight ? "flex-row-reverse text-right" : ""}`}
      style={{ boxShadow: isRight ? `inset -3px 0 0 0 ${team.primaryColor}` : `inset 3px 0 0 0 ${team.primaryColor}` }}
    >
      <TeamLogo seed={team.abbreviation} primaryColor={team.primaryColor} secondaryColor={team.secondaryColor} abbreviation={team.abbreviation} size={34} className="shrink-0" />
      <div className={`flex items-center gap-2 ${isRight ? "flex-row-reverse" : ""}`}>
        <span className="text-xs font-black uppercase tracking-wide text-text-muted">{team.abbreviation}</span>
        <span key={score} className={`text-2xl font-black tabular-nums text-text-primary ${justScored ? "score-pop text-accent" : ""}`}>
          {score}
        </span>
        {possession && (
          <span className={`inline-block text-accent ${isRight ? "" : "rotate-180"}`} title="Has the ball" aria-hidden>
            <span className="possession-arrow inline-block">▸</span>
          </span>
        )}
      </div>
    </div>
  );
}
