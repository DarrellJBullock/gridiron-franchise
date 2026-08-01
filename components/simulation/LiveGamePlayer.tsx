"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import type { PlayByPlayEntry, SimulatedGameResult } from "@/types/football";

interface LiveGamePlayerProps {
  gameId: string;
  result: SimulatedGameResult;
  home: { abbreviation: string; name: string; primaryColor: string; secondaryColor: string };
  away: { abbreviation: string; name: string; primaryColor: string; secondaryColor: string };
}

const SPEEDS = { "1x": 1400, "2x": 700, "4x": 300 } as const;
type SpeedKey = keyof typeof SPEEDS;

function pointsForPlay(play: PlayByPlayEntry): number {
  switch (play.playType) {
    case "touchdown":
      return 6;
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
    case "interception":
    case "fumble":
      return "⚠️";
    default:
      return "▪️";
  }
}

// yardLine is stored relative to the offense's own goal line (0-100). The
// field is drawn with the home team's goal line on the left and away's on
// the right, so an away possession needs to be mirrored to land in the
// right spot visually.
function absoluteFieldX(play: PlayByPlayEntry, homeAbbr: string): number {
  const absoluteYardLine = play.offenseAbbr === homeAbbr ? play.yardLine : 100 - play.yardLine;
  const ENDZONE_WIDTH = 80;
  const FIELD_WIDTH = 840;
  return ENDZONE_WIDTH + (absoluteYardLine / 100) * FIELD_WIDTH;
}

function yardMarkerLabel(distanceFromLeftGoal: number): string {
  const fromNearestGoal = distanceFromLeftGoal <= 50 ? distanceFromLeftGoal : 100 - distanceFromLeftGoal;
  return fromNearestGoal === 0 || fromNearestGoal === 100 ? "" : String(fromNearestGoal);
}

export function LiveGamePlayer({ gameId, result, home, away }: LiveGamePlayerProps) {
  const router = useRouter();
  const plays = result.plays;
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(true);
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
  const ballX = absoluteFieldX(current, home.abbreviation);
  const offenseIsHome = current.offenseAbbr === home.abbreviation;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <TeamScorePill abbr={home.abbreviation} color={home.primaryColor} score={homeScore} possession={offenseIsHome && index >= 0} />
          <span className="text-xs font-bold text-text-faint">@</span>
          <TeamScorePill abbr={away.abbreviation} color={away.primaryColor} score={awayScore} possession={!offenseIsHome && index >= 0} />
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
        <rect x="0" y="0" width="80" height="300" fill={home.secondaryColor} fillOpacity="0.9" />
        <rect x="920" y="0" width="80" height="300" fill={away.secondaryColor} fillOpacity="0.9" />
        <text x="40" y="155" textAnchor="middle" fontSize="20" fontWeight="900" fill={home.primaryColor} transform="rotate(-90 40 155)">
          {home.abbreviation}
        </text>
        <text x="960" y="155" textAnchor="middle" fontSize="20" fontWeight="900" fill={away.primaryColor} transform="rotate(90 960 155)">
          {away.abbreviation}
        </text>

        {Array.from({ length: 9 }, (_, i) => (i + 1) * 10).map((yard) => {
          const x = 80 + (yard / 100) * 840;
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

        {index >= 0 && (
          <g transform={`translate(${ballX}, 150)`}>
            <ellipse rx="14" ry="9" fill="#8B4513" stroke="#3a1f0a" strokeWidth="2" />
            <line x1="-7" y1="0" x2="7" y2="0" stroke="#fff" strokeWidth="1.5" />
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

function TeamScorePill({ abbr, color, score, possession }: { abbr: string; color: string; score: number; possession: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white"
        style={{ backgroundColor: color }}
      >
        {abbr}
      </span>
      <span className="text-2xl font-black tabular-nums text-text-primary">{score}</span>
      {possession && <span className="text-xs" title="Has the ball">🏈</span>}
    </div>
  );
}
