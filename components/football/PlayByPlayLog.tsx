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
}

function quarterLabel(quarter: number) {
  return quarter > 4 ? "OT" : `Q${quarter}`;
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
    case "interception":
    case "fumble":
      return "⚠️";
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
        {drives.map((drive) => (
          <div key={drive.driveNumber}>
            <div className="mb-2 flex items-center gap-2">
              <Badge tone="blue">{quarterLabel(drive.quarter)}</Badge>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Drive {drive.driveNumber} — {drive.offenseAbbr} ball
              </p>
            </div>
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
                          : "text-text-primary"
                    }
                  >
                    {play.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

