import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { TeamCard } from "@/components/football/TeamCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const league = await getOrCreateUserLeague(userId);

  const teams = await prisma.team.findMany({
    where: { leagueId: league.id },
    orderBy: { overallRating: "desc" },
    include: { _count: { select: { players: { where: { retired: false } } } } },
  });

  const latestSeason = await prisma.season.findFirst({ where: { leagueId: league.id }, orderBy: { createdAt: "desc" } });
  const standings = latestSeason
    ? await prisma.standing.findMany({ where: { seasonId: latestSeason.id } })
    : [];
  const standingByTeam = new Map(standings.map((s) => [s.teamId, s]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Football Ops</p>
          <h1 className="text-2xl font-black text-text-primary">Teams</h1>
        </div>
        <LinkButton href="/roster-upload" size="sm" variant="secondary">
          + Add a team via roster upload
        </LinkButton>
      </div>

      {teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description="Upload a roster to create your first team."
          action={<LinkButton href="/roster-upload" size="sm">Upload a Roster</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {teams.map((team) => {
            const standing = standingByTeam.get(team.id);
            return (
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
                  wins: standing?.wins,
                  losses: standing?.losses,
                  ties: standing?.ties,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
