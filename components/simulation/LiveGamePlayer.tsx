"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { TeamLogo } from "@/components/football/TeamLogo";
import type { PlayByPlayEntry } from "@/types/football";

interface LiveGamePlayerProps {
  gameId: string;
  plays: PlayByPlayEntry[];
  home: { abbreviation: string; name: string; primaryColor: string; secondaryColor: string };
  away: { abbreviation: string; name: string; primaryColor: string; secondaryColor: string };
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

const ENDZONE_WIDTH = 80;
const FIELD_WIDTH = 840;

// yardLine is stored relative to the offense's own goal line (0-100). The
// field is drawn with the home team's goal line on the left and away's on
// the right, so an away possession needs to be mirrored to land in the
// right spot visually.
function absoluteFieldX(yardLine: number, offenseAbbr: string, homeAbbr: string): number {
  const absoluteYardLine = offenseAbbr === homeAbbr ? yardLine : 100 - yardLine;
  return ENDZONE_WIDTH + (absoluteYardLine / 100) * FIELD_WIDTH;
}

function yardMarkerLabel(distanceFromLeftGoal: number): string {
  const fromNearestGoal = distanceFromLeftGoal <= 50 ? distanceFromLeftGoal : 100 - distanceFromLeftGoal;
  return fromNearestGoal === 0 || fromNearestGoal === 100 ? "" : String(fromNearestGoal);
}

export function LiveGamePlayer({ gameId, plays, home, away, autoPlay = true }: LiveGamePlayerProps) {
  const router = useRouter();
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(autoPlay);
  const [speed, setSpeed] = useState<SpeedKey>("1x");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <TeamScorePill abbr={home.abbreviation} color={home.primaryColor} score={homeScore} possession={offenseIsHome && index >= 0} justScored={homeJustScored} />
          <span className="text-xs font-bold text-text-faint">@</span>
          <TeamScorePill abbr={away.abbreviation} color={away.primaryColor} score={awayScore} possession={!offenseIsHome && index >= 0} justScored={awayJustScored} />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          <span className="rounded bg-surface-hover px-2 py-1">{quarterLabel(current.quarter)}</span>
          <span className="rounded bg-surface-hover px-2 py-1">
            {index < 0 ? "Kickoff" : `${["", "1st", "2nd", "3rd", "4th"][current.down] ?? current.down} & ${current.distance}`}
          </span>
        </div>
      </div>

      <svg viewBox="0 0 1000 300" className="w-full rounded-lg border border-border-line" role="img" aria-label="Field position">
        <rect x="0" y="0" width="1000" height="300" fill="#14532d" />
        <rect x="0" y="0" width={ENDZONE_WIDTH} height="300" fill={home.secondaryColor} fillOpacity="0.9" />
        <rect x={1000 - ENDZONE_WIDTH} y="0" width={ENDZONE_WIDTH} height="300" fill={away.secondaryColor} fillOpacity="0.9" />

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

        {/* Line of scrimmage */}
        {index >= 0 && (
          <line x1={ballX} x2={ballX} y1={0} y2={300} stroke="#60a5fa" strokeWidth="2" strokeOpacity="0.75" strokeDasharray="5 5" />
        )}
        {/* First-down marker */}
        {firstDownX !== null && (
          <line x1={firstDownX} x2={firstDownX} y1={0} y2={300} stroke="#facc15" strokeWidth="2.5" strokeDasharray="7 4" />
        )}

        {/* Penalty flag / scoring flash overlays — keyed by index so the CSS animation re-triggers every play */}
        {index >= 0 && current.playType === "penalty" && (
          <rect key={`penalty-${index}`} x="0" y="0" width="1000" height="300" fill="#facc15" fillOpacity="0.22" className="penalty-flash" pointerEvents="none" />
        )}
        {scoredThisPlay && (
          <rect key={`score-${index}`} x="0" y="0" width="1000" height="300" fill="#f5a623" fillOpacity="0.28" className="score-flash" pointerEvents="none" />
        )}

        {index >= 0 && (
          <g key={`ball-${index}`} className={scoredThisPlay ? "score-pop" : ""}>
            <g className={loftClass} style={{ animationDuration: `${motionDurationMs}ms` }}>
              <ellipse rx="14" ry="9" fill="#8B4513" stroke="#3a1f0a" strokeWidth="2" />
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#fff" strokeWidth="1.5" />
              <line x1="-3" y1="-3" x2="-3" y2="3" stroke="#fff" strokeWidth="1" />
              <line x1="0" y1="-3" x2="0" y2="3" stroke="#fff" strokeWidth="1" />
              <line x1="3" y1="-3" x2="3" y2="3" stroke="#fff" strokeWidth="1" />
              <animateMotion dur={`${motionDurationMs}ms`} fill="freeze" path={ballPath(kind, prevBallX, ballX)} />
            </g>
          </g>
        )}
      </svg>

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
            onClick={() => setPlaying((p) => !p)}
            disabled={finished}
          >
            {finished ? "Finished" : playing ? "⏸ Pause" : "▶ Play"}
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

function TeamScorePill({
  abbr,
  color,
  score,
  possession,
  justScored,
}: {
  abbr: string;
  color: string;
  score: number;
  possession: boolean;
  justScored: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </span>
      <span key={score} className={`text-2xl font-black tabular-nums text-text-primary ${justScored ? "score-pop text-accent" : ""}`}>
        {score}
      </span>
      {possession && <span className="text-xs" title="Has the ball">🏈</span>}
    </div>
  );
}
