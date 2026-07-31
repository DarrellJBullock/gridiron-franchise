import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import { LinkButton } from "@/components/ui/Button";
import { TeamCard } from "@/components/football/TeamCard";
import { StandingsTable } from "@/components/football/StandingsTable";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function LeaguePage() {
  const league = await prisma.league.findFirst({ orderBy: { createdAt: "asc" } });
  const teams = await prisma.team.findMany({
    where: league ? { leagueId: league.id } : undefined,
    orderBy: { overallRating: "desc" },
    include: { _count: { select: { players: true } } },
  });
  const season = await prisma.season.findFirst({ orderBy: { createdAt: "desc" } });
  const standings = season
    ? await prisma.standing.findMany({ where: { seasonId: season.id }, include: { team: true } })
    : [];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-accent">League Overview</p>
        <h1 className="text-3xl font-black text-text-primary">{league?.name ?? "Gridiron Franchise League"}</h1>
        <p className="max-w-2xl text-sm text-text-muted">
          {league?.description ?? "An original, fictional football league built for Gridiron Franchise."}
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Teams" value={teams.length} icon="🛡️" />
        <MetricCard label="Total Players" value={teams.reduce((s, t) => s + t._count.players, 0)} accent="blue" icon="🧢" />
        <MetricCard label="Current Season" value={season?.name ?? "None"} accent="success" icon="📅" />
        <MetricCard label="Season Week" value={season ? `${season.currentWeek}/${season.totalWeeks}` : "—"} accent="danger" icon="🏈" />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Season Controls</h2>
        </div>
        <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {season ? `${season.name} — ${season.status.replace("_", " ")}` : "No season has been created yet"}
            </p>
            <p className="text-xs text-text-muted">Create a season, generate a schedule, and simulate week by week.</p>
          </div>
          <LinkButton href="/season" size="md">
            Manage Season →
          </LinkButton>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Teams</h2>
          <LinkButton href="/teams" variant="ghost" size="sm">
            Full teams page →
          </LinkButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={{
                id: team.id,
                name: team.name,
                abbreviation: team.abbreviation,
                city: team.city,
                state: team.state,
                primaryColor: team.primaryColor,
                secondaryColor: team.secondaryColor,
                overallRating: team.overallRating,
                offenseRating: team.offenseRating,
                defenseRating: team.defenseRating,
                rosterSize: team._count.players,
              }}
            />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Standings Preview</h2>
          <LinkButton href="/standings" variant="ghost" size="sm">
            Full standings →
          </LinkButton>
        </div>
        {standings.length === 0 ? (
          <EmptyState title="No standings yet" description="Create a season to start tracking records." />
        ) : (
          <StandingsTable
            rows={standings.map((s) => ({
              teamId: s.teamId,
              teamName: s.team.name,
              abbreviation: s.team.abbreviation,
              primaryColor: s.team.primaryColor,
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
      </section>
    </div>
  );
}
