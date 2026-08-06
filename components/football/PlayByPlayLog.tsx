import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export interface PlayByPlayRow {
  sequence: number;
  quarter: number;
  driveNumber: number;
  offenseAbbr: string;
  down: number;
  distance: number;
  yardLine: number;
  playType: string;
  description: string;
  yards: number;
  isScoring: boolean;
  isTurnover: boolean;
  secondsRemaining: number;
}

function quarterLabel(quarter: number) {
  return quarter > 4 ? "OT" : `Q${quarter}`;
}

function formatGameClock(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// A drive's terminal play(s) determine its outcome label. Touchdown drives
// push both a "touchdown" entry and a following "extra_point" entry, which
// is why this checks "does this drive contain a play of type X" rather than
// just looking at the last entry.
function driveOutcomeLabel(plays: PlayByPlayRow[]): string {
  const isReturnOnly = plays.length === 1 && (plays[0].playType === "kick_return" || plays[0].playType === "punt_return");
  if (isReturnOnly) return plays[0].isScoring ? "Touchdown" : "Return";
  if (plays.some((p) => p.playType === "touchdown")) return "Touchdown";
  if (plays.some((p) => p.playType === "field_goal")) return "Field Goal";
  if (plays.some((p) => p.playType === "missed_field_goal")) return "Missed FG";
  if (plays.some((p) => p.playType === "punt")) return "Punt";
  if (plays.some((p) => p.playType === "interception")) return "Interception";
  if (plays.some((p) => p.playType === "fumble")) return "Fumble";
  return plays[plays.length - 1]?.isTurnover ? "Turnover" : "Turnover on Downs";
}

function summarizeDrive(plays: PlayByPlayRow[]) {
  const yards = plays.reduce((sum, p) => sum + p.yards, 0);
  const elapsed = Math.max(0, plays[0].secondsRemaining - plays[plays.length - 1].secondsRemaining);
  return {
    playCount: plays.length,
    yards,
    duration: formatGameClock(elapsed),
    outcome: driveOutcomeLabel(plays),
  };
}

function playIcon(playType: string) {
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

export function PlayByPlayLog({ plays }: { plays: PlayByPlayRow[] }) {
  if (plays.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-text-faint">No play-by-play recorded for this game.</p>
      </Card>
    );
  }

  const drives: { driveNumber: number; quarter: number; offenseAbbr: string; plays: PlayByPlayRow[] }[] = [];
  for (const play of plays) {
    const last = drives[drives.length - 1];
    if (!last || last.driveNumber !== play.driveNumber) {
      drives.push({ driveNumber: play.driveNumber, quarter: play.quarter, offenseAbbr: play.offenseAbbr, plays: [play] });
    } else {
      last.plays.push(play);
    }
  }

  return (
    <Card className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Play by Play</p>
      <div className="flex max-h-[32rem] flex-col gap-5 overflow-y-auto scrollbar-thin pr-2">
        {drives.map((drive) => {
          const summary = summarizeDrive(drive.plays);
          return (
            <div key={drive.driveNumber}>
              <div className="mb-1 flex items-center gap-2">
                <Badge tone="blue">{quarterLabel(drive.quarter)}</Badge>
                <span className="text-xs font-semibold tabular-nums text-text-faint">
                  {formatGameClock(drive.plays[0].secondsRemaining)}
                </span>
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Drive {drive.driveNumber} — {drive.offenseAbbr} ball
                </p>
              </div>
              <p className="mb-2 text-[11px] text-text-faint">
                {summary.playCount} play{summary.playCount === 1 ? "" : "s"}, {summary.yards} yard
                {summary.yards === 1 ? "" : "s"}, {summary.duration} — {summary.outcome}
              </p>
              <ul className="flex flex-col gap-1.5 border-l border-border-line pl-4">
                {drive.plays.map((play) => (
                  <li key={play.sequence} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5">{playIcon(play.playType)}</span>
                    <span
                      className={
                        play.isScoring
                          ? "font-semibold text-accent"
                          : play.isTurnover
                            ? "font-semibold text-danger"
                            : play.playType === "injury"
                              ? "font-semibold text-orange-400"
                              : "text-text-primary"
                      }
                    >
                      {play.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

