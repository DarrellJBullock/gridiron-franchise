"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function SettingsPage() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/league/reset", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not reset your franchise");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Info</p>
        <h1 className="text-2xl font-black text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-muted">Manage your franchise.</p>
      </div>

      <Card className="border-danger/40 p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-danger">Danger Zone</p>
        <h2 className="mt-1 text-lg font-bold text-text-primary">Reset My Franchise</h2>
        <p className="mt-2 max-w-xl text-sm text-text-muted">
          Permanently deletes your entire league — every team, player, roster upload, season, standing,
          and game you&apos;ve simulated. There&apos;s no undo. A fresh 18-team league is generated
          automatically the next time you visit.
        </p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        {!confirming ? (
          <Button variant="danger" size="md" className="mt-4" onClick={() => setConfirming(true)}>
            🗑️ Reset My Franchise
          </Button>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4">
            <p className="text-sm font-semibold text-text-primary">
              Are you sure? This deletes everything and can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="danger" size="sm" onClick={handleReset} disabled={busy}>
                {busy ? "Resetting…" : "Yes, delete everything"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
