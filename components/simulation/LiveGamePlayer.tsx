"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { TeamLogo } from "@/components/football/TeamLogo";
import { homeCrowdReaction } from "@/lib/simulation/crowd-reaction";
import { playCheer, playBoo, unlockCrowdAudio } from "@/lib/audio/crowd";
import { getContrastColor } from "@/lib/branding";
import type { PlayByPlayEntry } from "@/types/football";

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

// Builds an absolute-coordinate SVG path for the ball to travel along via
// <animateMotion>, shaped per play type (arcing lob for passes/kicks, an
// S-curve juke for runs, a jittery backward hop for sacks).
function ballPath(kind: MotionKind, fromX: number, toX: number): string {
  const dx = toX - fromX;
  switch (kind) {
    case "pass": {
      const lift = Math.min(70, 20 + Math.abs(dx) * 0.18);
      return `M${fromX},150 Q${(fromX + toX) / 2},${150 - lift} ${toX},150`;
    }
    case "kick": {
      const lift = Math.min(110, 40 + Math.abs(dx) * 0.22);
      return `M${fromX},150 Q${(fromX + toX) / 2},${150 - lift} ${toX},150`;
    }
    case "run":
      return `M${fromX},150 C${fromX + dx * 0.3},${168} ${fromX + dx * 0.7},${132} ${toX},150`;
    case "sack":
      return `M${fromX},150 L${fromX + dx * 0.4},158 L${fromX + dx * 0.7},142 L${toX},150`;
    default:
      return `M${fromX},150 L${toX},150`;
  }
}

// A dedicated arc for kick attempts (field goal / extra point), which fly
// from the snap spot all the way to the goalpost rather than stopping at
// the line of scrimmage — landing dead center (toY 150) on a make, or
// offset to one side of the posts on a miss.
function fieldGoalArcPath(fromX: number, toX: number, toY: number): string {
  const dx = toX - fromX;
  const lift = Math.min(130, 55 + Math.abs(dx) * 0.22);
  return `M${fromX},150 Q${(fromX + toX) / 2},${150 - lift} ${toX},${toY}`;
}

const ENDZONE_WIDTH = 80;
const FIELD_WIDTH = 840;
const TILT_DEG = 48;
const PERSPECTIVE_PX = 1700;
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

function yardMarkerLabel(distanceFromLeftGoal: number): string {
  const fromNearestGoal = distanceFromLeftGoal <= 50 ? distanceFromLeftGoal : 100 - distanceFromLeftGoal;
  return fromNearestGoal === 0 || fromNearestGoal === 100 ? "" : String(fromNearestGoal);
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

interface FormationDot {
  x: number;
  y: number;
  key: string;
}

function buildFormation(
  local: readonly { x: number; y: number }[],
  ballX: number,
  forwardSign: 1 | -1,
  prefix: string
): FormationDot[] {
  return local.map((p, i) => ({
    x: Math.min(1000 - ENDZONE_WIDTH - 6, Math.max(ENDZONE_WIDTH + 6, ballX + forwardSign * p.x)),
    y: Math.min(282, Math.max(18, 150 + p.y)),
    key: `${prefix}-${i}`,
  }));
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
    if (reaction.type === "cheer") playCheer(reaction.intensity);
    else playBoo(reaction.intensity);
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
  const loftClass = kind === "kick" ? "ball-loft-big" : kind === "pass" ? "ball-loft" : kind === "sack" ? "ball-shake" : "";
  const shadowClass = kind === "kick" ? "shadow-loft-big" : kind === "pass" ? "shadow-loft" : "";

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
  const ballFlightPath = isKickAttempt ? fieldGoalArcPath(ballX, kickTargetX, kickTargetY) : ballPath(kind, prevBallX, ballX);
  const shadowFlightPath = isKickAttempt
    ? `M${ballX},158 L${kickTargetX},${kickTargetY + 8}`
    : `M${prevBallX},158 L${ballX},158`;
  const kickFlashSide: "left" | "right" | null = isKickAttempt && scoredThisPlay ? (offenseIsHome ? "right" : "left") : null;

  // Snap formation: offense always attacks toward +x when home, -x when away.
  const forwardSign: 1 | -1 = offenseIsHome ? 1 : -1;
  const showFormation = index >= 0 && FORMATION_PLAY_TYPES.has(current.playType);
  const offenseDots = showFormation ? buildFormation(OFFENSE_FORMATION, prevBallX, forwardSign, `off-${index}`) : [];
  const defenseDots = showFormation ? buildFormation(DEFENSE_FORMATION, prevBallX, forwardSign, `def-${index}`) : [];
  const ballCarrierRuns = kind === "run" && current.playType !== "sack";

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

        <div className="relative" style={{ perspective: `${PERSPECTIVE_PX}px` }}>
          <div
            className="relative mx-auto [transform-style:preserve-3d]"
            style={{ transform: `rotateX(${TILT_DEG}deg)`, transformOrigin: "bottom center" }}
          >
            <div className="overflow-hidden border border-border-line shadow-[0_35px_60px_-15px_rgba(0,0,0,0.75)]">
              <svg viewBox="0 0 1000 300" className="w-full" role="img" aria-label="Field position">
                <defs>
                  <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f3d21" />
                    <stop offset="55%" stopColor="#166534" />
                    <stop offset="100%" stopColor="#1d7a3d" />
                  </linearGradient>
                  <radialGradient id="floodlight" cx="50%" cy="0%" r="90%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                    <stop offset="45%" stopColor="#ffffff" stopOpacity="0.03" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.25" />
                  </radialGradient>
                </defs>
                <rect x="0" y="0" width="1000" height="300" fill="url(#turf)" />

                {/* Mow-stripe bands, alternating every 10 yards for a broadcast turf look */}
                {Array.from({ length: 10 }, (_, i) => i).map((i) => (
                  <rect
                    key={`stripe-${i}`}
                    x={ENDZONE_WIDTH + i * (FIELD_WIDTH / 10)}
                    y="0"
                    width={FIELD_WIDTH / 10}
                    height="300"
                    fill="#ffffff"
                    fillOpacity={i % 2 === 0 ? 0.035 : 0}
                  />
                ))}

                <rect x="0" y="0" width={ENDZONE_WIDTH} height="300" fill={home.secondaryColor} fillOpacity="0.9" />
                <rect x={1000 - ENDZONE_WIDTH} y="0" width={ENDZONE_WIDTH} height="300" fill={away.secondaryColor} fillOpacity="0.9" />
                <text
                  x={ENDZONE_WIDTH / 2}
                  y="150"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="20"
                  fontWeight={900}
                  letterSpacing="2"
                  fill={getContrastColor(home.secondaryColor)}
                  fillOpacity="0.35"
                  transform={`rotate(-90 ${ENDZONE_WIDTH / 2} 150)`}
                >
                  {home.abbreviation}
                </text>
                <text
                  x={1000 - ENDZONE_WIDTH / 2}
                  y="150"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="20"
                  fontWeight={900}
                  letterSpacing="2"
                  fill={getContrastColor(away.secondaryColor)}
                  fillOpacity="0.35"
                  transform={`rotate(90 ${1000 - ENDZONE_WIDTH / 2} 150)`}
                >
                  {away.abbreviation}
                </text>

                <g transform={`translate(8, ${(300 - 64) / 2})`}>
                  <TeamLogo seed={home.abbreviation} primaryColor={home.primaryColor} secondaryColor={home.secondaryColor} abbreviation={home.abbreviation} size={64} />
                </g>
                <g transform={`translate(${1000 - ENDZONE_WIDTH + 8}, ${(300 - 64) / 2})`}>
                  <TeamLogo seed={away.abbreviation} primaryColor={away.primaryColor} secondaryColor={away.secondaryColor} abbreviation={away.abbreviation} size={64} />
                </g>

                {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((yard) => {
                  const x = ENDZONE_WIDTH + (yard / 100) * FIELD_WIDTH;
                  const label = yardMarkerLabel(yard);
                  return (
                    <g key={yard}>
                      <line x1={x} y1={0} x2={x} y2={300} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
                      {label && (
                        <>
                          <text x={x} y="40" textAnchor="middle" fontSize="18" fill="#ffffff" fillOpacity="0.6">
                            {label}
                          </text>
                          <text x={x} y="272" textAnchor="middle" fontSize="18" fill="#ffffff" fillOpacity="0.6">
                            {label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Hash marks every 5 yards, NFL-style, offset off the yard lines */}
                {Array.from({ length: 19 }, (_, i) => (i + 1) * 5).map((yard) => {
                  if (yard % 10 === 0) return null;
                  const x = ENDZONE_WIDTH + (yard / 100) * FIELD_WIDTH;
                  return (
                    <g key={`hash-${yard}`} stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2">
                      <line x1={x} y1={96} x2={x} y2={108} />
                      <line x1={x} y1={192} x2={x} y2={204} />
                    </g>
                  );
                })}

                {/* Line of scrimmage */}
                {index >= 0 && (
                  <line x1={ballX} x2={ballX} y1={0} y2={300} stroke="#60a5fa" strokeWidth="2" strokeOpacity="0.75" strokeDasharray="5 5" />
                )}
                {/* First-down marker */}
                {firstDownX !== null && (
                  <line x1={firstDownX} x2={firstDownX} y1={0} y2={300} stroke="#facc15" strokeWidth="2.5" strokeDasharray="7 4" />
                )}

                {/* Pre-snap formation: 11-on-11 dots set at the line for scrimmage downs */}
                {offenseDots.map((d) => (
                  <PlayerDot key={d.key} x={d.x} y={d.y} color={offenseTeam.primaryColor} ring={offenseTeam.secondaryColor} />
                ))}
                {defenseDots.map((d) => (
                  <PlayerDot key={d.key} x={d.x} y={d.y} color={defenseTeam.primaryColor} ring={defenseTeam.secondaryColor} />
                ))}

                {/* Penalty flag / scoring flash overlays — keyed by index so the CSS animation re-triggers every play */}
                {index >= 0 && current.playType === "penalty" && (
                  <rect key={`penalty-${index}`} x="0" y="0" width="1000" height="300" fill="#facc15" fillOpacity="0.22" className="penalty-flash" pointerEvents="none" />
                )}
                {scoredThisPlay && (
                  <rect key={`score-${index}`} x="0" y="0" width="1000" height="300" fill="#f5a623" fillOpacity="0.28" className="score-flash" pointerEvents="none" />
                )}

                {/* Ground shadow — shrinks/fades on lofted plays to sell height off the turf */}
                {index >= 0 && (
                  <g key={`shadow-${index}`} className={shadowClass} style={{ animationDuration: `${motionDurationMs}ms` }}>
                    <ellipse rx="15" ry="5" fill="#000000" fillOpacity="0.4">
                      <animateMotion dur={`${motionDurationMs}ms`} fill="freeze" path={shadowFlightPath} />
                    </ellipse>
                  </g>
                )}

                {/* Ball carrier — a jersey-colored runner riding the same path as the ball on runs/returns */}
                {index >= 0 && ballCarrierRuns && (
                  <g key={`carrier-${index}`}>
                    <circle r="7" fill={offenseTeam.primaryColor} stroke={offenseTeam.secondaryColor} strokeWidth="2">
                      <animateMotion dur={`${motionDurationMs}ms`} fill="freeze" path={ballFlightPath} />
                    </circle>
                  </g>
                )}

                {index >= 0 && (
                  <g key={`ball-${index}`} className={scoredThisPlay ? "score-pop" : ""}>
                    <g className={loftClass} style={{ animationDuration: `${motionDurationMs}ms` }}>
                      <ellipse rx="14" ry="9" fill="#8B4513" stroke="#3a1f0a" strokeWidth="2" />
                      <line x1="-7" y1="0" x2="7" y2="0" stroke="#fff" strokeWidth="1.5" />
                      <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#fff" strokeWidth="1" />
                      <line x1="0" y1="-3" x2="0" y2="3" stroke="#fff" strokeWidth="1" />
                      <line x1="3" y1="-3" x2="3" y2="3" stroke="#fff" strokeWidth="1" />
                      <animateMotion dur={`${motionDurationMs}ms`} fill="freeze" path={ballFlightPath} />
                    </g>
                  </g>
                )}

                <rect x="0" y="0" width="1000" height="300" fill="url(#floodlight)" pointerEvents="none" />
              </svg>
            </div>

            <Goalpost xPct={GOALPOST_INSET_PCT} tiltDeg={TILT_DEG} flash={kickFlashSide === "left"} flashKey={index} />
            <Goalpost xPct={100 - GOALPOST_INSET_PCT} tiltDeg={TILT_DEG} flash={kickFlashSide === "right"} flashKey={index} />
          </div>

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

// A single pre-snap player marker: a jersey-colored dot with a thin ring in
// the team's secondary color, matching the flat SVG plane the ball/turf sit
// on so it inherits the same 3D field tilt for free.
function PlayerDot({ x, y, color, ring }: { x: number; y: number; color: string; ring: string }) {
  return (
    <circle cx={x} cy={y} r="6" fill={color} stroke={ring} strokeWidth="1.5" fillOpacity="0.92" />
  );
}

// A flat "billboard" anchored to the tilted field's bottom edge, then
// counter-rotated by the field's own tilt around that same anchor. The net
// effect is a goalpost that appears to stand straight up out of the turf
// instead of lying flat in the tilted plane.
function Goalpost({
  xPct,
  tiltDeg,
  flash = false,
  flashKey,
}: {
  xPct: number;
  tiltDeg: number;
  flash?: boolean;
  flashKey?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-10 h-16 w-14 md:h-24 md:w-20"
      style={{
        left: `${xPct}%`,
        top: "50%",
        transform: `translate(-50%, -100%) rotateX(${-tiltDeg}deg)`,
        transformOrigin: "bottom center",
      }}
    >
      <div className="relative h-full w-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)]">
        {flash && (
          <div
            key={flashKey}
            className="goalpost-flash absolute -inset-4 rounded-full bg-yellow-300"
          />
        )}
        <div className="absolute bottom-0 left-1/2 h-[62%] w-[3px] -translate-x-1/2 bg-gradient-to-t from-yellow-600 via-yellow-400 to-yellow-300" />
        <div className="absolute left-0 right-0 top-[38%] h-[3px] bg-gradient-to-r from-yellow-500 via-yellow-300 to-yellow-500" />
        <div className="absolute left-0 top-0 h-[40%] w-[3px] origin-bottom -rotate-[8deg] bg-yellow-400" />
        <div className="absolute right-0 top-0 h-[40%] w-[3px] origin-bottom rotate-[8deg] bg-yellow-400" />
      </div>
    </div>
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
