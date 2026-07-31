import { Card } from "@/components/ui/Card";
import type { TeamCardData } from "@/components/football/TeamCard";

function winProbability(a: number, b: number) {
  const diff = a - b;
  const prob = 1 / (1 + Math.pow(10, -diff / 18));
  return Math.round(prob * 100);
}

export function TeamAdvantagePanel({ home, away }: { home: TeamCardData; away: TeamCardData }) {
  const homeWinPct = winProbability(home.overallRating + 2, away.overallRating);
  const awayWinPct = 100 - homeWinPct;

  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Simulated Win Probability</p>
      <div className="flex items-center justify-between text-sm font-semibold">
        <span className="text-accent-blue">
          {away.abbreviation} {awayWinPct}%
        </span>
        <span className="text-accent">
          {home.abbreviation} {homeWinPct}%
        </span>
      </div>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-hover">
        <div className="h-full bg-accent-blue" style={{ width: `${awayWinPct}%` }} />
        <div className="h-full bg-accent" style={{ width: `${homeWinPct}%` }} />
      </div>
      <p className="mt-3 text-xs text-text-faint">
        Includes a small home-field bump for {home.name}. Actual results are randomized within each game
        simulation, so upsets can and will happen.
      </p>
    </Card>
  );
}
