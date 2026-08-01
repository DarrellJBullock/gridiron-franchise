"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface SeasonOption {
  id: string;
  name: string;
  year: number;
}

export function StatLeaderScopeSelect({ seasons }: { seasons: SeasonOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("seasonId") ?? "career";

  function handleChange(value: string) {
    if (value === "career") {
      router.push("/stats");
    } else {
      router.push(`/stats?seasonId=${value}`);
    }
  }

  return (
    <select
      value={selected}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded-lg border border-border-line bg-surface px-3 py-2 text-sm font-medium text-text-primary focus:border-accent focus:outline-none"
    >
      <option value="career">Career (All Seasons)</option>
      {seasons.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} ({s.year})
        </option>
      ))}
    </select>
  );
}
