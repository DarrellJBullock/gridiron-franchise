"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { POSITION_LABELS } from "@/types/football";
import type { Position } from "@/types/football";
import { cn } from "@/lib/utils";

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
  onReorder: (orderedPlayerIds: string[]) => void;
}

const SLOT_LABELS = ["Starter", "Backup 1", "Backup 2"];

function buildInitialOrder(
  players: DepthChartPlayerOption[],
  starterPlayerId?: string | null,
  backup1PlayerId?: string | null,
  backup2PlayerId?: string | null
): string[] {
  const knownIds = new Set(players.map((p) => p.id));
  const assigned = [starterPlayerId, backup1PlayerId, backup2PlayerId].filter(
    (id): id is string => Boolean(id && knownIds.has(id))
  );
  const assignedSet = new Set(assigned);
  const rest = players
    .filter((p) => !assignedSet.has(p.id))
    .sort((a, b) => b.overall - a.overall)
    .map((p) => p.id);
  return [...assigned, ...rest];
}

export function DepthChartPanel({
  position,
  players,
  starterPlayerId,
  backup1PlayerId,
  backup2PlayerId,
  onReorder,
}: DepthChartPanelProps) {
  const [order, setOrder] = useState<string[]>(() =>
    buildInitialOrder(players, starterPlayerId, backup1PlayerId, backup2PlayerId)
  );
  const dragIndex = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const findPlayer = (id: string) => players.find((p) => p.id === id);

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= order.length) return;
    const next = [...order];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrder(next);
    onReorder(next.slice(0, 3));
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-text-primary">{position}</p>
        <p className="text-xs text-text-faint">{POSITION_LABELS[position]}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {order.map((playerId, index) => {
          const player = findPlayer(playerId);
          if (!player) return null;
          const slotLabel = index < 3 ? SLOT_LABELS[index] : "Bench";

          return (
            <div
              key={playerId}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex.current !== index) setDragOverIndex(index);
              }}
              onDrop={() => {
                if (dragIndex.current !== null) moveItem(dragIndex.current, index);
                dragIndex.current = null;
                setDragOverIndex(null);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOverIndex(null);
              }}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors",
                index < 3 ? "border-accent/30 bg-accent/5" : "border-border-line bg-bg-elevated",
                dragOverIndex === index && "border-accent bg-accent/10"
              )}
            >
              <span className="cursor-grab select-none text-text-faint" aria-hidden="true">
                ⠿
              </span>
              <span className="w-14 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                {slotLabel}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                #{player.jerseyNumber} {player.firstName} {player.lastName}
              </span>
              <RatingBadge value={player.overall} size="sm" />
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  aria-label={`Move ${player.firstName} ${player.lastName} up`}
                  disabled={index === 0}
                  onClick={() => moveItem(index, index - 1)}
                  className="text-xs leading-none text-text-faint hover:text-accent disabled:opacity-20"
                >
                  ▲
                </button>
                <button
                  type="button"
                  aria-label={`Move ${player.firstName} ${player.lastName} down`}
                  disabled={index === order.length - 1}
                  onClick={() => moveItem(index, index + 1)}
                  className="text-xs leading-none text-text-faint hover:text-accent disabled:opacity-20"
                >
                  ▼
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
