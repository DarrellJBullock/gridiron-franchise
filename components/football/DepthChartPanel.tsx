"use client";

import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { POSITION_LABELS } from "@/types/football";
import type { Position } from "@/types/football";

export interface DepthChartPlayerOption {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  overall: number;
}

interface DepthChartPanelProps {
  position: Position;
  players: DepthChartPlayerOption[];
  starterPlayerId?: string | null;
  backup1PlayerId?: string | null;
  backup2PlayerId?: string | null;
  onChange: (slot: "starterPlayerId" | "backup1PlayerId" | "backup2PlayerId", playerId: string | null) => void;
}

const SLOTS: { key: "starterPlayerId" | "backup1PlayerId" | "backup2PlayerId"; label: string }[] = [
  { key: "starterPlayerId", label: "Starter" },
  { key: "backup1PlayerId", label: "Backup 1" },
  { key: "backup2PlayerId", label: "Backup 2" },
];

export function DepthChartPanel({
  position,
  players,
  starterPlayerId,
  backup1PlayerId,
  backup2PlayerId,
  onChange,
}: DepthChartPanelProps) {
  const current: Record<string, string | null | undefined> = {
    starterPlayerId,
    backup1PlayerId,
    backup2PlayerId,
  };

  const findPlayer = (id?: string | null) => players.find((p) => p.id === id);

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-text-primary">{position}</p>
        <p className="text-xs text-text-faint">{POSITION_LABELS[position]}</p>
      </div>
      <div className="flex flex-col gap-3">
        {SLOTS.map((slot) => {
          const selected = findPlayer(current[slot.key]);
          return (
            <div key={slot.key} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {slot.label}
              </span>
              <select
                className="min-w-0 flex-1 rounded-lg border border-border-line bg-bg-elevated px-2 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                value={current[slot.key] ?? ""}
                onChange={(e) => onChange(slot.key, e.target.value || null)}
              >
                <option value="">— Empty —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.jerseyNumber} {p.firstName} {p.lastName} ({p.overall})
                  </option>
                ))}
              </select>
              {selected && <RatingBadge value={selected.overall} size="sm" />}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
