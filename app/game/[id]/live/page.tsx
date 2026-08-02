"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { LiveGamePlayer } from "@/components/simulation/LiveGamePlayer";
import { Skeleton } from "@/components/ui/Skeleton";
import { Card } from "@/components/ui/Card";
import type { PlayByPlayEntry } from "@/types/football";

interface TeamInfo {
  abbreviation: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export default function GameLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [plays, setPlays] = useState<PlayByPlayEntry[] | null>(null);
  const [home, setHome] = useState<TeamInfo | null>(null);
  const [away, setAway] = useState<TeamInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState("Loading game...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const gameRes = await fetch(`/api/games/${id}`);
        const gameData = await gameRes.json();
        if (!gameRes.ok) throw new Error(gameData.error ?? "Game not found");
        if (cancelled) return;

        const teamInfo = (t: { abbreviation: string; name: string; primaryColor: string; secondaryColor: string }): TeamInfo => ({
          abbreviation: t.abbreviation,
          name: t.name,
          primaryColor: t.primaryColor,
          secondaryColor: t.secondaryColor,
        });
        setHome(teamInfo(gameData.game.homeTeam));
        setAway(teamInfo(gameData.game.awayTeam));

        if (gameData.game.status === "SCHEDULED") {
          setStatusLabel("Simulating…");
          const simRes = await fetch(`/api/games/${id}`, { method: "POST" });
          const simData = await simRes.json();
          if (!simRes.ok) throw new Error(simData.error ?? "Could not simulate this game");
          if (cancelled) return;
          setPlays(simData.result.plays);
        } else {
          setPlays(gameData.game.plays);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <Card className="border-danger/40 p-5 text-sm text-danger">
        {error}{" "}
        <Link href={`/game/${id}`} className="underline">
          View recap instead →
        </Link>
      </Card>
    );
  }

  if (!plays || !home || !away) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">{statusLabel}</p>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Watching Live</h1>
      </div>
      <LiveGamePlayer gameId={id} plays={plays} home={home} away={away} />
    </div>
  );
}
