import { Badge } from "@/components/ui/Badge";

export interface ScoreboardTeam {
  name: string;
  abbreviation: string;
  primaryColor: string;
  score: number;
}

interface ScoreboardProps {
  home: ScoreboardTeam;
  away: ScoreboardTeam;
  status?: string;
  week?: number;
}

export function Scoreboard({ home, away, status = "FINAL", week }: ScoreboardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-line bg-bg-elevated">
      <div className="flex items-center justify-between border-b border-border-line bg-surface px-4 py-2">
        <Badge tone="accent">{status}</Badge>
        {week !== undefined && <span className="text-xs text-text-faint">Week {week}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 p-6">
        <TeamScore team={away} align="left" />
        <span className="text-2xl font-black text-text-faint">@</span>
        <TeamScore team={home} align="right" />
      </div>
    </div>
  );
}

function TeamScore({ team, align }: { team: ScoreboardTeam; align: "left" | "right" }) {
  return (
    <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
        style={{ background: team.primaryColor }}
      >
        {team.abbreviation}
      </span>
      <div>
        <p className="text-sm font-semibold text-text-primary">{team.name}</p>
        <p className="text-4xl font-black tabular-nums text-text-primary">{team.score}</p>
      </div>
    </div>
  );
}
