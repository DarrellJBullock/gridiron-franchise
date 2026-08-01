import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { PositionBadge } from "@/components/football/PositionBadge";
import { TeamLogo } from "@/components/football/TeamLogo";
import { calculateTeamStrengths } from "@/lib/simulation/team-ratings";
import { toRatedPlayer } from "@/lib/football-mappers";

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const team = await prisma.team.findFirst({
    where: { id, leagueId: league.id },
    include: { players: { where: { retired: false }, orderBy: { overall: "desc" } } },
  });
  if (!team) notFound();

  const latestSeason = await prisma.season.findFirst({ where: { leagueId: league.id }, orderBy: { createdAt: "desc" } });
  const standing = latestSeason
    ? await prisma.standing.findUnique({ where: { seasonId_teamId: { seasonId: latestSeason.id, teamId: team.id } } })
    : null;

  const ratedPlayers = team.players.map(toRatedPlayer);
  const { strengths, weaknesses } = calculateTeamStrengths(ratedPlayers);
  const topPlayers = team.players.slice(0, 5);

  return (
    <div className="flex flex-col gap-8">
      <section
        className="relative overflow-hidden rounded-2xl border border-border-line p-6 md:p-8"
        style={{ background: `linear-gradient(135deg, ${team.primaryColor}26 0%, transparent 60%)` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <TeamLogo
              seed={team.id}
              primaryColor={team.primaryColor}
              secondaryColor={team.secondaryColor}
              abbreviation={team.abbreviation}
              size={64}
            />
            <div>
              <h1 className="text-2xl font-black text-text-primary md:text-3xl">{team.name}</h1>
              <p className="text-sm text-text-muted">
                {team.city}
                {team.state ? `, ${team.state}` : ""}
                {standing && (
                  <span className="ml-2 text-text-faint">
                    · {standing.wins}-{standing.losses}
                    {standing.ties ? `-${standing.ties}` : ""}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <LinkButton href={`/depth-chart?teamId=${team.id}`} variant="secondary" size="md">
              View Depth Chart
            </LinkButton>
            <LinkButton href={`/matchup?homeTeamId=${team.id}`} size="md">
              Simulate Matchup
            </LinkButton>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <RatingStat label="Overall" value={team.overallRating} />
          <RatingStat label="Offense" value={team.offenseRating} />
          <RatingStat label="Defense" value={team.defenseRating} />
          <RatingStat label="Special Teams" value={team.specialTeamsRating} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success">Team Strengths</p>
          <ul className="flex flex-col gap-1.5">
            {strengths.map((s) => (
              <li key={s} className="flex items-center gap-2 text-sm text-text-primary">
                <span className="text-success">▲</span> {s}
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">Team Weaknesses</p>
          <ul className="flex flex-col gap-1.5">
            {weaknesses.map((w) => (
              <li key={w} className="flex items-center gap-2 text-sm text-text-primary">
                <span className="text-danger">▼</span> {w}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Top Players</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topPlayers.map((p) => (
            <Card key={p.id} className="flex flex-col items-center gap-2 p-4 text-center">
              <RatingBadge value={p.overall} size="lg" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  {p.firstName} {p.lastName}
                </p>
                <PositionBadge position={p.position} className="mt-1" />
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Full Roster ({team.players.length})</p>
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Player</Th>
              <Th>Pos</Th>
              <Th>Class</Th>
              <Th>Archetype</Th>
              <Th className="text-right">OVR</Th>
            </Tr>
          </Thead>
          <Tbody>
            {team.players.map((p) => (
              <Tr key={p.id}>
                <Td className="text-text-faint">{p.jerseyNumber}</Td>
                <Td>
                  <a href={`/players/${p.id}`} className="font-medium text-text-primary hover:text-accent">
                    {p.firstName} {p.lastName}
                  </a>
                </Td>
                <Td>
                  <PositionBadge position={p.position} />
                </Td>
                <Td className="text-text-muted">
                  <Badge tone="neutral">{p.classYear}</Badge>
                </Td>
                <Td className="text-text-muted">{p.archetype}</Td>
                <Td className="text-right">
                  <RatingBadge value={p.overall} size="sm" />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </section>
    </div>
  );
}

function RatingStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border-line bg-surface/70 p-3 text-center">
      <p className="text-[10px] uppercase tracking-wide text-text-faint">{label}</p>
      <p className="text-2xl font-black text-accent">{value}</p>
    </div>
  );
}
