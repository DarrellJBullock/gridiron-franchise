"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function DeleteTeamButton({ teamId, teamName }: { teamId: string; teamName: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${teamName}? This permanently removes the team, its roster, and any games it played. This can't be undone.`
    );
    if (!confirmed) return;

    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete team");
      }
      router.push("/teams");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="danger" size="md" onClick={handleDelete} disabled={pending}>
        {pending ? "Deleting…" : "🗑️ Delete Team"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
