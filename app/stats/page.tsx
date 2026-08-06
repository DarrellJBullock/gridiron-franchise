import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { getStatLeaders } from "@/lib/stats/leaders";
import { LeaderTable } from "@/components/football/LeaderTable";
import { StatLeaderScopeSelect } from "@/components/football/StatLeaderScopeSelect";

export const dynamic = "force-dynamic";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ seasonId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const league = await getOrCreateUserLeague(userId);
  const { seasonId: requestedSeasonId } = await searchParams;

  const seasons = await prisma.season.findMany({
    where: { leagueId: league.id },
    orderBy: { year: "desc" },
    select: { id: true, name: true, year: true },
  });

  const selectedSeason = requestedSeasonId ? seasons.find((s) => s.id === requestedSeasonId) : undefined;
  const leaders = await getStatLeaders(league.id, selectedSeason?.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
          <h1 className="text-2xl font-black text-text-primary">Stat Leaders</h1>
          <p className="mt-1 text-sm text-text-muted">
            {selectedSeason
              ? `${selectedSeason.name} (${selectedSeason.year}) only.`
              : "Career totals, aggregated across every season."}
          </p>
        </div>
        {seasons.length > 0 && <StatLeaderScopeSelect seasons={seasons} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LeaderTable
          title="Passing Leaders"
          rows={leaders.passing}
          columns={[
            { label: "Att", value: (r) => r.attempts },
            { label: "Comp", value: (r) => r.completions },
            { label: "Yards", value: (r) => r.yards, tone: "highlight" },
            { label: "TD", value: (r) => r.touchdowns },
            { label: "INT", value: (r) => r.interceptions },
            { label: "Rating", value: (r) => r.rating.toFixed(1), tone: "primary" },
          ]}
        />
        <LeaderTable
          title="Rushing Leaders"
          rows={leaders.rushing}
          columns={[
            { label: "Att", value: (r) => r.attempts },
            { label: "Yards", value: (r) => r.yards, tone: "highlight" },
            { label: "Avg", value: (r) => r.avg.toFixed(1) },
            { label: "TD", value: (r) => r.touchdowns },
          ]}
        />
        <LeaderTable
          title="Receiving Leaders"
          rows={leaders.receiving}
          columns={[
            { label: "Rec", value: (r) => r.receptions },
            { label: "Yards", value: (r) => r.yards, tone: "highlight" },
            { label: "Avg", value: (r) => r.avg.toFixed(1) },
            { label: "TD", value: (r) => r.touchdowns },
          ]}
        />
        <LeaderTable title="Rushing TD Leaders" rows={leaders.rushingTouchdowns} columns={[{ label: "Rush TDs", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Receiving TD Leaders" rows={leaders.receivingTouchdowns} columns={[{ label: "Rec TDs", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Points Leaders" rows={leaders.points} columns={[{ label: "Points", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Defensive Leaders" rows={leaders.defense} columns={[{ label: "Impact Score", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Sack Leaders" rows={leaders.sacks} columns={[{ label: "Sacks", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Interception Leaders" rows={leaders.interceptions} columns={[{ label: "INTs", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable title="Kicking Leaders" rows={leaders.kicking} columns={[{ label: "FG Made", value: (r) => r.value, tone: "highlight" }]} />
        <LeaderTable
          title="Punting Leaders"
          rows={leaders.punting}
          columns={[
            { label: "Punts", value: (r) => r.punts },
            { label: "Yards", value: (r) => r.yards, tone: "highlight" },
            { label: "Avg", value: (r) => r.avg.toFixed(1) },
          ]}
        />
        <LeaderTable title="Return Leaders" rows={leaders.returns} columns={[{ label: "Return Yards", value: (r) => r.value, tone: "highlight" }]} />
      </div>
    </div>
  );
}
