"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DepthChartPanel, type DepthChartPlayerOption } from "@/components/football/DepthChartPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { POSITION_GROUPS } from "@/types/football";
import type { Position } from "@/types/football";

interface TeamOption {
  id: string;
  name: string;
  abbreviation: string;
}

interface DepthChartRow {
  position: Position;
  starterPlayerId: string | null;
  backup1PlayerId: string | null;
  backup2PlayerId: string | null;
}

function DepthChartInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamId, setTeamId] = useState(searchParams.get("teamId") ?? "");
  const [allPlayers, setAllPlayers] = useState<(DepthChartPlayerOption & { position: Position })[]>([]);
  const [chart, setChart] = useState<Record<Position, DepthChartRow>>({} as Record<Position, DepthChartRow>);
  const [loading, setLoading] = useState(true);
  const [savingPosition, setSavingPosition] = useState<Position | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => {
        setTeams(data.teams ?? []);
        if (!teamId && data.teams?.[0]) {
          setTeamId(data.teams[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!teamId) return;
    router.replace(`/depth-chart?teamId=${teamId}`, { scroll: false });
    const loadingHandle = setTimeout(() => setLoading(true), 0);
    fetch(`/api/teams/${teamId}`)
      .then((r) => r.json())
      .then((data) => {
        const teamPlayers = (data.players ?? []) as (DepthChartPlayerOption & { position: Position })[];
        setAllPlayers(teamPlayers);
        const next: Record<Position, DepthChartRow> = {} as Record<Position, DepthChartRow>;
        for (const dc of data.depthCharts ?? []) {
          next[dc.position as Position] = {
            position: dc.position,
            starterPlayerId: dc.starterPlayerId,
            backup1PlayerId: dc.backup1PlayerId,
            backup2PlayerId: dc.backup2PlayerId,
          };
        }
        setChart(next);
      })
      .finally(() => {
        clearTimeout(loadingHandle);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const playersByPosition = useMemo(() => {
    const map = new Map<Position, (DepthChartPlayerOption & { position: Position })[]>();
    for (const p of allPlayers) {
      const list = map.get(p.position) ?? [];
      list.push(p);
      map.set(p.position, list);
    }
    return map;
  }, [allPlayers]);

  async function handleReorder(position: Position, orderedPlayerIds: string[]) {
    const updated = {
      position,
      starterPlayerId: orderedPlayerIds[0] ?? null,
      backup1PlayerId: orderedPlayerIds[1] ?? null,
      backup2PlayerId: orderedPlayerIds[2] ?? null,
    };
    setChart((prev) => ({ ...prev, [position]: updated }));
    setSavingPosition(position);
    await fetch(`/api/teams/${teamId}/depth-chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setSavingPosition(null);
  }

  const inputClass =
    "rounded-lg border border-border-line bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Football Ops</p>
          <h1 className="text-2xl font-black text-text-primary">Depth Charts</h1>
        </div>
        <select className={inputClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.abbreviation})
            </option>
          ))}
        </select>
      </div>

      {savingPosition && <p className="text-xs text-accent">Saving {savingPosition}…</p>}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : allPlayers.length === 0 ? (
        <EmptyState title="No roster for this team" description="Upload a roster to build a depth chart." />
      ) : (
        <div key={teamId} className="flex flex-col gap-8">
          <PositionGroupSection
            title="Offense"
            positions={POSITION_GROUPS.offense}
            playersByPosition={playersByPosition}
            chart={chart}
            onReorder={handleReorder}
          />
          <PositionGroupSection
            title="Defense"
            positions={POSITION_GROUPS.defense}
            playersByPosition={playersByPosition}
            chart={chart}
            onReorder={handleReorder}
          />
          <PositionGroupSection
            title="Special Teams"
            positions={POSITION_GROUPS.specialTeams}
            playersByPosition={playersByPosition}
            chart={chart}
            onReorder={handleReorder}
          />
        </div>
      )}
    </div>
  );
}

function PositionGroupSection({
  title,
  positions,
  playersByPosition,
  chart,
  onReorder,
}: {
  title: string;
  positions: Position[];
  playersByPosition: Map<Position, (DepthChartPlayerOption & { position: Position })[]>;
  chart: Record<Position, DepthChartRow>;
  onReorder: (position: Position, orderedPlayerIds: string[]) => void;
}) {
  return (
    <section>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {positions.map((position) => {
          const row = chart[position];
          return (
            <DepthChartPanel
              key={position}
              position={position}
              players={playersByPosition.get(position) ?? []}
              starterPlayerId={row?.starterPlayerId}
              backup1PlayerId={row?.backup1PlayerId}
              backup2PlayerId={row?.backup2PlayerId}
              onReorder={(orderedPlayerIds) => onReorder(position, orderedPlayerIds)}
            />
          );
        })}
      </div>
    </section>
  );
}

export default function DepthChartPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <DepthChartInner />
    </Suspense>
  );
}
