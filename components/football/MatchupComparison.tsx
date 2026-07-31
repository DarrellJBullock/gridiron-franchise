import { Card } from "@/components/ui/Card";
import type { TeamCardData } from "./TeamCard";

interface MatchupRow {
  label: string;
  home: number;
  away: number;
}

export function MatchupComparison({ home, away }: { home: TeamCardData; away: TeamCardData }) {
  const rows: MatchupRow[] = [
    { label: "Overall", home: home.overallRating, away: away.overallRating },
    { label: "Offense", home: home.offenseRating, away: away.offenseRating },
    { label: "Defense", home: home.defenseRating, away: away.defenseRating },
  ];

  const advantages: string[] = [];
  if (home.offenseRating - away.defenseRating >= 8) advantages.push(`${home.name} offense should move the ball on ${away.name}.`);
  if (away.offenseRating - home.defenseRating >= 8) advantages.push(`${away.name} offense should move the ball on ${home.name}.`);
  if (home.defenseRating - away.offenseRating >= 8) advantages.push(`${home.name} defense has a clear edge.`);
  if (away.defenseRating - home.offenseRating >= 8) advantages.push(`${away.name} defense has a clear edge.`);
  if (advantages.length === 0) advantages.push("This matchup is evenly balanced on paper.");

  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Team Comparison</p>
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex items-center justify-between text-xs font-semibold">
              <span className="text-accent">{row.home}</span>
              <span className="text-text-muted">{row.label}</span>
              <span className="text-accent-blue">{row.away}</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-surface-hover">
              <div className="h-full bg-accent" style={{ width: `${(row.home / (row.home + row.away || 1)) * 100}%` }} />
              <div className="h-full bg-accent-blue" style={{ width: `${(row.away / (row.home + row.away || 1)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-border-line pt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Key Advantages</p>
        <ul className="flex flex-col gap-1.5">
          {advantages.map((a, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-primary">
              <span className="mt-0.5 text-accent">▸</span>
              {a}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
