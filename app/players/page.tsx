"use client";

import { useEffect, useMemo, useState } from "react";
import { PlayerCard, type PlayerCardData } from "@/components/football/PlayerCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { POSITIONS } from "@/types/football";

interface TeamOption {
  id: string;
  name: string;
  abbreviation: string;
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<PlayerCardData[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState("");
  const [minOverall, setMinOverall] = useState(0);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => setTeams(data.teams ?? []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (position) params.set("position", position);
    if (teamId) params.set("teamId", teamId);
    if (minOverall > 0) params.set("minOverall", String(minOverall));

    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/players?${params.toString()}`)
        .then((r) => r.json())
        .then((data) => setPlayers(data.players ?? []))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [search, position, teamId, minOverall]);

  const inputClass =
    "rounded-lg border border-border-line bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none";

  const skeletons = useMemo(() => Array.from({ length: 8 }), []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Football Ops</p>
        <h1 className="text-2xl font-black text-text-primary">Players</h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className={`${inputClass} min-w-[200px] flex-1`}
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={inputClass} value={position} onChange={(e) => setPosition(e.target.value)}>
          <option value="">All Positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className={inputClass} value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.abbreviation}
            </option>
          ))}
        </select>
        <select className={inputClass} value={minOverall} onChange={(e) => setMinOverall(Number(e.target.value))}>
          <option value={0}>Any Rating</option>
          <option value={90}>90+ OVR</option>
          <option value={80}>80+ OVR</option>
          <option value={70}>70+ OVR</option>
        </select>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skeletons.map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : players.length === 0 ? (
        <EmptyState title="No players found" description="Try adjusting your filters or upload a roster." />
      ) : (
        <>
          <p className="text-xs text-text-faint">{players.length} players</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
