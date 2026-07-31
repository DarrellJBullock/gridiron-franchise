"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { GameSummaryCard } from "@/components/simulation/GameSummaryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";

interface Season {
  id: string;
  name: string;
  status: string;
  currentWeek: number;
  totalWeeks: number;
}

interface GameRow {
  id: string;
  week: number;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeam: { id: string; name: string; abbreviation: string };
  awayTeam: { id: string; name: string; abbreviation: string };
  summary: string | null;
}

export default function SeasonPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSeason() {
    const res = await fetch("/api/season/create");
    const data = await res.json();
    const latest = data.seasons?.[0] ?? null;
    setSeason(latest);
    if (latest) {
      const gamesRes = await fetch(`/api/games?seasonId=${latest.id}`).catch(() => null);
      if (gamesRes?.ok) {
        const gamesData = await gamesRes.json();
        setGames(gamesData.games ?? []);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    // Initial fetch on mount; loading defaults to true so no flash of empty state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSeason();
  }, []);

  async function handleCreateSeason() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/season/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create season");
      await loadSeason();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateWeek() {
    if (!season) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/season/simulate-week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not simulate week");
      await loadSeason();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSimulateFull() {
    if (!season) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/season/simulate-full", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not simulate season");
      await loadSeason();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const progress = season ? Math.round((season.currentWeek / season.totalWeeks) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Season</h1>
        <p className="mt-1 text-sm text-text-muted">Create a season, generate a schedule, and simulate week by week or all at once.</p>
      </div>

      {error && <Card className="border-danger/40 p-4 text-sm text-danger">{error}</Card>}

      {loading ? (
        <Skeleton className="h-40" />
      ) : !season ? (
        <EmptyState
          title="No active season"
          description="Create a season to generate a round-robin schedule for every team in the league."
          action={
            <Button onClick={handleCreateSeason} disabled={busy}>
              {busy ? "Creating…" : "Create Season"}
            </Button>
          }
        />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-text-primary">{season.name}</p>
                <Badge tone={season.status === "COMPLETED" ? "success" : "accent"}>
                  {season.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleSimulateWeek} disabled={busy || season.status === "COMPLETED"}>
                  {busy ? "Simulating…" : "▶ Simulate Week"}
                </Button>
                <Button onClick={handleSimulateFull} disabled={busy || season.status === "COMPLETED"}>
                  {busy ? "Simulating…" : "⏭ Simulate Full Season"}
                </Button>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-text-muted">
                <span>
                  Week {season.currentWeek} of {season.totalWeeks}
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Total Weeks" value={season.totalWeeks} />
            <MetricCard label="Games Played" value={games.filter((g) => g.status === "FINAL").length} accent="blue" />
            <MetricCard label="Games Scheduled" value={games.filter((g) => g.status === "SCHEDULED").length} accent="danger" />
            <MetricCard label="Status" value={season.status === "COMPLETED" ? "Done" : "Live"} accent="success" />
          </div>

          {games.filter((g) => g.status === "FINAL").length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Completed Games</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {games
                  .filter((g) => g.status === "FINAL")
                  .map((g) => (
                    <GameSummaryCard
                      key={g.id}
                      gameId={g.id}
                      homeName={g.homeTeam.name}
                      homeAbbr={g.homeTeam.abbreviation}
                      awayName={g.awayTeam.name}
                      awayAbbr={g.awayTeam.abbreviation}
                      homeScore={g.homeScore}
                      awayScore={g.awayScore}
                      week={g.week}
                      summary={g.summary ?? undefined}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
