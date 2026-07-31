"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export interface SimTeamOption {
  id: string;
  name: string;
  abbreviation: string;
}

interface SimulationControlsProps {
  teams: SimTeamOption[];
  homeTeamId: string;
  awayTeamId: string;
  onHomeChange: (id: string) => void;
  onAwayChange: (id: string) => void;
  onSimulate: () => void;
  isSimulating?: boolean;
  disabled?: boolean;
}

export function SimulationControls({
  teams,
  homeTeamId,
  awayTeamId,
  onHomeChange,
  onAwayChange,
  onSimulate,
  isSimulating,
  disabled,
}: SimulationControlsProps) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Set the Matchup</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Away Team</span>
          <select
            className="rounded-lg border border-border-line bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            value={awayTeamId}
            onChange={(e) => onAwayChange(e.target.value)}
          >
            <option value="">Select a team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === homeTeamId}>
                {t.name} ({t.abbreviation})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">Home Team</span>
          <select
            className="rounded-lg border border-border-line bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
            value={homeTeamId}
            onChange={(e) => onHomeChange(e.target.value)}
          >
            <option value="">Select a team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === awayTeamId}>
                {t.name} ({t.abbreviation})
              </option>
            ))}
          </select>
        </label>
      </div>
      <Button
        className="mt-4 w-full"
        onClick={onSimulate}
        disabled={disabled || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId || isSimulating}
      >
        {isSimulating ? "Simulating…" : "🏈 Simulate Game"}
      </Button>
    </Card>
  );
}
