"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { GameSummaryCard } from "@/components/simulation/GameSummaryCard";
import { TeamLogo } from "@/components/football/TeamLogo";
import { PlayoffBracket } from "@/components/football/PlayoffBracket";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PlayoffBracketResult } from "@/lib/simulation/playoffs";

interface Season {
  id: string;
  name: string;
  year: number;
  status: string;
  currentWeek: number;
  totalWeeks: number;
}

interface GameTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
}

interface GameRow {
  id: string;
  week: number;
  status: string;
  homeScore: number;
  awayScore: number;
  homeTeam: GameTeam;
  awayTeam: GameTeam;
  summary: string | null;
  isPlayoff: boolean;
}

interface FranchiseNote {
  name: string;
  position: string;
  team: string;
  overall: number;
}

interface AdvanceSummary {
  newSeasonName: string;
  retiredCount: number;
  rookieCount: number;
  notableRetirements: FranchiseNote[];
  notableRookies: FranchiseNote[];
}

interface SeasonHistoryEntry {
  id: string;
  name: string;
  year: number;
  status: string;
  champion: {
    teamId: string;
    teamName: string;
    abbreviation: string;
    primaryColor: string;
    secondaryColor: string;
    record: string;
    source: "playoff" | "record";
  } | null;
}

export default function SeasonPage() {
  const [season, setSeason] = useState<Season | null>(null);
  const [games, setGames] = useState<GameRow[]>([]);
  const [history, setHistory] = useState<SeasonHistoryEntry[]>([]);
  const [bracket, setBracket] = useState<PlayoffBracketResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanceSummary, setAdvanceSummary] = useState<AdvanceSummary | null>(null);

  async function loadSeason() {
    const res = await fetch("/api/season/create");
    const data = await res.json();
    const latest = data.seasons?.[0] ?? null;
    setSeason(latest);
    setBracket(null);
    if (latest) {
      const gamesRes = await fetch(`/api/games?seasonId=${latest.id}`).catch(() => null);
      if (gamesRes?.ok) {
        const gamesData = await gamesRes.json();
        setGames(gamesData.games ?? []);
      }
      const bracketRes = await fetch(`/api/season/simulate-playoffs?seasonId=${latest.id}`).catch(() => null);
      if (bracketRes?.ok) {
        const bracketData = await bracketRes.json();
        setBracket(bracketData.bracket ?? null);
      }
    }
    const historyRes = await fetch("/api/season/history").catch(() => null);
    if (historyRes?.ok) {
      const historyData = await historyRes.json();
      setHistory(historyData.history ?? []);
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

  async function handleSimulatePlayoffs() {
    if (!season) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/season/simulate-playoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not run the playoffs");
      setBracket(data);
      const historyRes = await fetch("/api/season/history").catch(() => null);
      if (historyRes?.ok) {
        const historyData = await historyRes.json();
        setHistory(historyData.history ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvanceFranchise() {
    if (!season) return;
    setBusy(true);
    setError(null);
    setAdvanceSummary(null);
    try {
      const res = await fetch("/api/season/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonId: season.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not advance the franchise");
      setAdvanceSummary(data);
      await loadSeason();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const progress = season ? Math.round((season.currentWeek / season.totalWeeks) * 100) : 0;
  const regularSeasonGames = games.filter((g) => !g.isPlayoff);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Season</h1>
        <p className="mt-1 text-sm text-text-muted">
          Create a season, generate a schedule, simulate week by week or all at once, optionally run a
          4-team playoff bracket, then advance the franchise into the next year with player progression
          and retirement.
        </p>
      </div>

      {error && <Card className="border-danger/40 p-4 text-sm text-danger">{error}</Card>}

      {advanceSummary && (
        <Card className="border-accent/40 p-5">
          <p className="text-sm font-bold text-accent">
            {advanceSummary.newSeasonName} begins! {advanceSummary.retiredCount} player
            {advanceSummary.retiredCount === 1 ? "" : "s"} retired, {advanceSummary.rookieCount} rookie
            {advanceSummary.rookieCount === 1 ? "" : "s"} drafted.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {advanceSummary.notableRetirements.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Notable Retirements</p>
                <ul className="flex flex-col gap-1 text-sm text-text-primary">
                  {advanceSummary.notableRetirements.map((p, i) => (
                    <li key={i}>
                      {p.name} ({p.position}, {p.team}) — {p.overall} OVR
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {advanceSummary.notableRookies.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Notable Rookies</p>
                <ul className="flex flex-col gap-1 text-sm text-text-primary">
                  {advanceSummary.notableRookies.map((p, i) => (
                    <li key={i}>
                      {p.name} ({p.position}, {p.team}) — {p.overall} OVR
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

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
                <p className="text-lg font-bold text-text-primary">
                  {season.name} <span className="text-text-faint">({season.year})</span>
                </p>
                <Badge tone={season.status === "COMPLETED" ? "success" : "accent"}>
                  {season.status.replace("_", " ")}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={handleSimulateWeek} disabled={busy || season.status === "COMPLETED"}>
                  {busy ? "Simulating…" : "▶ Simulate Week"}
                </Button>
                <Button onClick={handleSimulateFull} disabled={busy || season.status === "COMPLETED"}>
                  {busy ? "Simulating…" : "⏭ Simulate Full Season"}
                </Button>
                {season.status === "COMPLETED" && !bracket?.championship?.status && (
                  <Button variant="secondary" onClick={handleSimulatePlayoffs} disabled={busy} className="border-accent-blue/50">
                    {busy ? "Running…" : "🏈 Run Playoffs"}
                  </Button>
                )}
                {season.status === "COMPLETED" && (
                  <Button variant="secondary" onClick={handleAdvanceFranchise} disabled={busy} className="border-accent/50">
                    {busy ? "Advancing…" : "🏆 Advance to Next Season"}
                  </Button>
                )}
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
            <MetricCard label="Games Played" value={regularSeasonGames.filter((g) => g.status === "FINAL").length} accent="blue" />
            <MetricCard label="Games Scheduled" value={regularSeasonGames.filter((g) => g.status === "SCHEDULED").length} accent="danger" />
            <MetricCard label="Status" value={season.status === "COMPLETED" ? "Done" : "Live"} accent="success" />
          </div>

          {bracket && (
            <PlayoffBracket semifinals={bracket.semifinals} championship={bracket.championship} />
          )}

          {regularSeasonGames.filter((g) => g.status === "FINAL").length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Completed Games</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {regularSeasonGames
                  .filter((g) => g.status === "FINAL")
                  .map((g) => (
                    <GameSummaryCard
                      key={g.id}
                      gameId={g.id}
                      home={g.homeTeam}
                      away={g.awayTeam}
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

      {history.length > 1 && (
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Franchise History</p>
          <Card className="divide-y divide-border-line p-0">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {h.name} <span className="text-text-faint">({h.year})</span>
                  </p>
                  <Badge tone={h.status === "COMPLETED" ? "success" : "neutral"}>{h.status.replace("_", " ")}</Badge>
                </div>
                {h.champion ? (
                  <div className="flex items-center gap-2">
                    <TeamLogo
                      seed={h.champion.teamId}
                      primaryColor={h.champion.primaryColor}
                      secondaryColor={h.champion.secondaryColor}
                      abbreviation={h.champion.abbreviation}
                      size={28}
                    />
                    <div className="text-right">
                      <p className="text-xs text-text-faint">
                        {h.champion.source === "playoff" ? "🏆 Playoff Champion" : "Best Record"}
                      </p>
                      <p className="text-sm font-semibold text-text-primary">
                        {h.champion.teamName} ({h.champion.record})
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-text-faint">In progress</p>
                )}
              </div>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}
