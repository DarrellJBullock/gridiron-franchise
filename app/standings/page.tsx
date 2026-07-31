import { prisma } from "@/lib/prisma";
import { StandingsTable } from "@/components/football/StandingsTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const season = await prisma.season.findFirst({ orderBy: { createdAt: "desc" } });
  const standings = season
    ? await prisma.standing.findMany({ where: { seasonId: season.id }, include: { team: true } })
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Standings</h1>
        {season && <p className="mt-1 text-sm text-text-muted">{season.name} — Week {season.currentWeek} of {season.totalWeeks}</p>}
      </div>

      {standings.length === 0 ? (
        <EmptyState
          title="No standings yet"
          description="Create a season on the Season page to start tracking records."
          action={<LinkButton href="/season" size="sm">Go to Season</LinkButton>}
        />
      ) : (
        <StandingsTable
          rows={standings.map((s) => ({
            teamId: s.teamId,
            teamName: s.team.name,
            abbreviation: s.team.abbreviation,
            primaryColor: s.team.primaryColor,
            secondaryColor: s.team.secondaryColor,
            division: s.division,
            wins: s.wins,
            losses: s.losses,
            ties: s.ties,
            pointsFor: s.pointsFor,
            pointsAgainst: s.pointsAgainst,
            streak: s.streak,
          }))}
        />
      )}
    </div>
  );
}
