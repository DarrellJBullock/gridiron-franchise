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

// Rough pre-snap alignment, expressed as offsets from the ball along the
// direction of attack (local +x = downfield for the offense) and across the
// hash (local y, field center = 0). Not a real playbook — just enough shape
// to read as "11 players set at the line" the way a broadcast wide shot does.
const OFFENSE_FORMATION = [
  { x: 3, y: -42 }, // LT
  { x: 3, y: -21 }, // LG
  { x: 3, y: 0 }, // C
  { x: 3, y: 21 }, // RG
  { x: 3, y: 42 }, // RT
  { x: -16, y: 0 }, // QB
  { x: -30, y: 10 }, // RB
  { x: 3, y: 62 }, // TE
  { x: -2, y: -128 }, // WR (wide left)
  { x: -2, y: 128 }, // WR (wide right)
  { x: 4, y: -96 }, // WR (slot)
] as const;
const OFFENSE_ROLES = ["OL", "OL", "OL", "OL", "OL", "QB", "RB", "TE", "WR", "WR", "WR"] as const;

const DEFENSE_FORMATION = [
  { x: 9, y: -30 }, // DL
  { x: 9, y: -10 },
  { x: 9, y: 10 },
  { x: 9, y: 30 }, // DL
  { x: 26, y: -26 }, // LB
  { x: 26, y: 0 }, // LB
  { x: 26, y: 26 }, // LB
  { x: 17, y: -118 }, // CB
  { x: 17, y: 118 }, // CB
  { x: 52, y: -38 }, // S
  { x: 52, y: 38 }, // S
] as const;
const DEFENSE_ROLES = ["DL", "DL", "DL", "DL", "LB", "LB", "LB", "CB", "CB", "S", "S"] as const;

interface FormationDot {
  key: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

// How far (and which way, laterally) each role moves downfield over the
// course of the play, in the same local-offset units as the formation
// tables above — not a real route tree, just enough per-role variety to
// read as "the play developed" instead of 22 players frozen at the snap.
function extraMotion(role: string, kind: MotionKind, index: number): { x: number; y: number } {
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
          const depth = [34, 22, 44][index % 3];
          const lateral = [6, -8, -12][index % 3];
          return { x: depth, y: lateral };
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

function buildFormation(
  local: readonly { x: number; y: number }[],
  roles: readonly string[],
  startBallX: number,
  endBallX: number,
  forwardSign: 1 | -1,
  kind: MotionKind,
  prefix: string
): FormationDot[] {
  return local.map((p, i) => {
    const role = roles[i];
    const extra = extraMotion(role, kind, i);
    const conv = lateralConvergence(role, kind);
    const start = clampField(startBallX + forwardSign * p.x, 150 + p.y);
    const end = clampField(endBallX + forwardSign * (p.x + extra.x), 150 + p.y * conv + extra.y);
    return { key: `${prefix}-${i}`, startX: start.x, startY: start.y, endX: end.x, endY: end.y };
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
  const offenseDots = showFormation
    ? buildFormation(OFFENSE_FORMATION, OFFENSE_ROLES, prevBallX, ballX, forwardSign, kind, `off-${index}`)
    : [];
  const defenseDots = showFormation
    ? buildFormation(DEFENSE_FORMATION, DEFENSE_ROLES, prevBallX, ballX, forwardSign, kind, `def-${index}`)
    : [];
  const ballCarrierRuns = kind === "run" && current.playType !== "sack";

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

  const players3D: PlayerMotion[] = [
    ...offenseDots.map((d) => ({
      key: d.key,
      startX: d.startX,
      startY: d.startY,
      endX: d.endX,
      endY: d.endY,
      color: offenseTeam.primaryColor,
      ring: offenseTeam.secondaryColor,
    })),
    ...defenseDots.map((d) => ({
      key: d.key,
      startX: d.startX,
      startY: d.startY,
      endX: d.endX,
      endY: d.endY,
      color: defenseTeam.primaryColor,
      ring: defenseTeam.secondaryColor,
      isTackler: d.key === tacklerKey,
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
            ballToX={isKickAttempt ? kickTargetX : ballX}
            ballToY={isKickAttempt ? kickTargetY : 150}
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
