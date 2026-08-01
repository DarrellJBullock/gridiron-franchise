import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { getStatLeaders } from "@/lib/stats/leaders";
import { StatLeaderTable } from "@/components/football/StatLeaderTable";
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
        <StatLeaderTable title="Passing Leaders" unit="Yards" rows={leaders.passing} />
        <StatLeaderTable title="Rushing Leaders" unit="Yards" rows={leaders.rushing} />
        <StatLeaderTable title="Receiving Leaders" unit="Yards" rows={leaders.receiving} />
        <StatLeaderTable title="Rushing TD Leaders" unit="Rush TDs" rows={leaders.rushingTouchdowns} />
        <StatLeaderTable title="Receiving TD Leaders" unit="Rec TDs" rows={leaders.receivingTouchdowns} />
        <StatLeaderTable title="Points Leaders" unit="Points" rows={leaders.points} />
        <StatLeaderTable title="Defensive Leaders" unit="Impact Score" rows={leaders.defense} />
        <StatLeaderTable title="Sack Leaders" unit="Sacks" rows={leaders.sacks} />
        <StatLeaderTable title="Interception Leaders" unit="INTs" rows={leaders.interceptions} />
        <StatLeaderTable title="Kicking Leaders" unit="FG Made" rows={leaders.kicking} />
      </div>
    </div>
  );
}
