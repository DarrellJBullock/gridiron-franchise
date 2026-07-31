"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SimulationControls } from "@/components/simulation/SimulationControls";
import { TeamAdvantagePanel } from "@/components/simulation/TeamAdvantagePanel";
import { MatchupComparison } from "@/components/football/MatchupComparison";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TeamCardData } from "@/components/football/TeamCard";

function MatchupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [teams, setTeams] = useState<TeamCardData[]>([]);
  const [homeTeamId, setHomeTeamId] = useState(searchParams.get("homeTeamId") ?? "");
  const [awayTeamId, setAwayTeamId] = useState(searchParams.get("awayTeamId") ?? "");
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data) => setTeams(data.teams ?? []))
      .finally(() => setLoading(false));
  }, []);

  const homeTeam = teams.find((t) => t.id === homeTeamId);
  const awayTeam = teams.find((t) => t.id === awayTeamId);

  async function handleSimulate() {
    if (!homeTeamId || !awayTeamId) return;
    setSimulating(true);
    setError(null);
    try {
      const res = await fetch("/api/games/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTeamId, awayTeamId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Simulation failed");
      router.push(`/game/${data.gameId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Matchup Preview</h1>
        <p className="mt-1 text-sm text-text-muted">Pick two teams to preview the matchup and simulate a game.</p>
      </div>

      {loading ? (
        <Skeleton className="h-40" />
      ) : teams.length < 2 ? (
        <EmptyState title="Need at least two teams" description="Upload rosters to add more teams." />
      ) : (
        <>
          <SimulationControls
            teams={teams}
            homeTeamId={homeTeamId}
            awayTeamId={awayTeamId}
            onHomeChange={setHomeTeamId}
            onAwayChange={setAwayTeamId}
            onSimulate={handleSimulate}
            isSimulating={simulating}
          />

          {error && <p className="text-sm text-danger">{error}</p>}

          {homeTeam && awayTeam && (
            <div className="grid gap-4 lg:grid-cols-2">
              <MatchupComparison home={homeTeam} away={awayTeam} />
              <TeamAdvantagePanel home={homeTeam} away={awayTeam} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MatchupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <MatchupInner />
    </Suspense>
  );
}
