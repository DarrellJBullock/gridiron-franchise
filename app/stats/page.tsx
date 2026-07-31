import { getStatLeaders } from "@/lib/stats/leaders";
import { StatLeaderTable } from "@/components/football/StatLeaderTable";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const leaders = await getStatLeaders();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Stat Leaders</h1>
        <p className="mt-1 text-sm text-text-muted">Aggregated across every simulated game.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatLeaderTable title="Passing Leaders" unit="Yards" rows={leaders.passing} />
        <StatLeaderTable title="Rushing Leaders" unit="Yards" rows={leaders.rushing} />
        <StatLeaderTable title="Receiving Leaders" unit="Yards" rows={leaders.receiving} />
        <StatLeaderTable title="Defensive Leaders" unit="Impact Score" rows={leaders.defense} />
        <StatLeaderTable title="Kicking Leaders" unit="FG Made" rows={leaders.kicking} />
      </div>
    </div>
  );
}
