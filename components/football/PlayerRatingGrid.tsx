"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { RatingBar } from "@/components/ui/RatingBar";
import { CORE_RATINGS, ratingGroupForPosition, POSITION_LABELS } from "@/types/football";
import type { Position, RatingMap } from "@/types/football";

function labelize(name: string) {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export function PlayerRatingGrid({ position, ratings }: { position: Position; ratings: RatingMap }) {
  const positionRatingNames = ratingGroupForPosition(position);
  const coreRatingNames = CORE_RATINGS.filter((r) => r !== "overall");

  const radarData = positionRatingNames.map((name) => ({
    stat: labelize(name),
    value: ratings[name] ?? 0,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border-line bg-surface/60 p-2">
        <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {POSITION_LABELS[position]} Profile
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="var(--border-line)" />
              <PolarAngleAxis dataKey="stat" tick={{ fill: "var(--text-muted)", fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Core Attributes</p>
          <div className="flex flex-col gap-2">
            {coreRatingNames.map((name) => (
              <RatingBar key={name} label={labelize(name)} value={ratings[name] ?? 0} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {POSITION_LABELS[position]} Skills
          </p>
          <div className="flex flex-col gap-2">
            {positionRatingNames.map((name) => (
              <RatingBar key={name} label={labelize(name)} value={ratings[name] ?? 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
