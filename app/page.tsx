import { prisma } from "@/lib/prisma";
import { LinkButton } from "@/components/ui/Button";
import { MetricCard } from "@/components/ui/MetricCard";
import { TeamCard } from "@/components/football/TeamCard";
import { GameSummaryCard } from "@/components/simulation/GameSummaryCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [teamCount, playerCount, gameCount, topTeams, recentGames] = await Promise.all([
    prisma.team.count(),
    prisma.player.count(),
    prisma.game.count({ where: { status: "FINAL" } }),
    prisma.team.findMany({
      orderBy: { overallRating: "desc" },
      take: 4,
      include: { _count: { select: { players: true } } },
    }),
    prisma.game.findMany({
      where: { status: "FINAL" },
      orderBy: { updatedAt: "desc" },
      take: 3,
      include: { homeTeam: true, awayTeam: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section className="relative overflow-hidden rounded-2xl border border-border-line bg-gradient-to-br from-bg-elevated via-surface to-bg-elevated p-8 md:p-12">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Portfolio Project</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-black leading-tight text-text-primary md:text-5xl">
          Gridiron Franchise: an original football operations command center
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-text-muted md:text-base">
          Upload custom rosters from Excel, rate every player from 0-100 across position-specific skills,
          build depth charts, preview matchups, and simulate full seasons with a franchise-style game
          engine — all fictional teams and players, built end-to-end with Next.js, TypeScript, PostgreSQL,
          and Prisma.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/roster-upload" size="lg">
            📤 Upload a Roster
          </LinkButton>
          <LinkButton href="/matchup" variant="secondary" size="lg">
            ⚔️ Simulate a Game
          </LinkButton>
          <LinkButton href="/teams" variant="ghost" size="lg">
            View Teams →
          </LinkButton>
        </div>
        <p className="mt-6 max-w-2xl text-xs text-text-faint">
          Fictional branding notice: all leagues, teams, players, and logos in Gridiron Franchise are
          entirely original. No real NFL, NCAA, Madden, or EA Sports names, logos, or players are used.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Teams" value={teamCount} accent="accent" icon="🛡️" />
        <MetricCard label="Players" value={playerCount} accent="blue" icon="🧢" />
        <MetricCard label="Games Simulated" value={gameCount} accent="success" icon="🏈" />
        <MetricCard label="Rating Scale" value="0-100" accent="danger" icon="📊" hint="Every skill rated" />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Top Rated Teams</h2>
          <LinkButton href="/teams" variant="ghost" size="sm">
            See all teams →
          </LinkButton>
        </div>
        {topTeams.length === 0 ? (
          <EmptyState
            title="No teams yet"
            description="Upload a roster or reseed the database to populate the league."
            action={<LinkButton href="/roster-upload" size="sm">Upload a Roster</LinkButton>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {topTeams.map((team) => (
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
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">Simulation Snapshot</h2>
          <LinkButton href="/season" variant="ghost" size="sm">
            Season hub →
          </LinkButton>
        </div>
        {recentGames.length === 0 ? (
          <EmptyState
            title="No games simulated yet"
            description="Head to the Matchup page to simulate your first game."
            action={<LinkButton href="/matchup" size="sm">Go to Matchup</LinkButton>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentGames.map((game) => (
              <GameSummaryCard
                key={game.id}
                gameId={game.id}
                home={game.homeTeam}
                away={game.awayTeam}
                homeScore={game.homeScore}
                awayScore={game.awayScore}
                week={game.week}
                summary={game.summary ?? undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
