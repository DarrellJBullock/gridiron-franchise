import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { getSingleGameRecords, getTeamGameRecords, getHallOfFameInductees } from "@/lib/stats/hall-of-fame";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PositionBadge } from "@/components/football/PositionBadge";

export const dynamic = "force-dynamic";

export default async function HallOfFamePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const league = await getOrCreateUserLeague(userId);

  const [inductees, singleGameRecords, teamRecords] = await Promise.all([
    getHallOfFameInductees(league.id),
    getSingleGameRecords(league.id),
    getTeamGameRecords(league.id),
  ]);

  const hasAnything = inductees.length > 0 || singleGameRecords.length > 0 || teamRecords.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Gameday</p>
        <h1 className="text-2xl font-black text-text-primary">Franchise Hall of Fame</h1>
        <p className="mt-1 text-sm text-text-muted">
          Every record and legend across every season this league has ever played.
        </p>
      </div>

      {!hasAnything ? (
        <EmptyState
          title="No history yet"
          description="Simulate some games and the record book will start writing itself."
        />
      ) : (
        <>
          {inductees.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Inducted — Top Career Honorees
              </p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {inductees.map((p, i) => (
                  <Card key={p.playerId} className="relative overflow-hidden p-4">
                    <div className="absolute -right-3 -top-3 text-6xl font-black text-accent/10">{i + 1}</div>
                    <Link href={`/players/${p.playerId}`} className="relative font-bold text-text-primary hover:text-accent">
                      {p.playerName}
                    </Link>
                    <div className="relative mt-1 flex items-center gap-2">
                      <PositionBadge position={p.position} />
                      <span className="text-xs text-text-muted">{p.teamAbbreviation}</span>
                    </div>
                    <p className="relative mt-3 text-xs text-text-faint">{p.highlightLine}</p>
                    <p className="relative mt-2 text-xs font-semibold uppercase tracking-wide text-accent">
                      {Math.round(p.careerScore).toLocaleString()} career impact pts
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {singleGameRecords.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Single-Game Records</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {singleGameRecords.map((r) => (
                  <Card key={r.category} className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{r.category}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-accent">
                      {r.value.toLocaleString()} <span className="text-sm font-semibold text-text-muted">{r.unit}</span>
                    </p>
                    <Link href={`/players/${r.playerId}`} className="mt-1 block text-sm font-medium text-text-primary hover:text-accent">
                      {r.playerName}
                    </Link>
                    <p className="text-xs text-text-faint">
                      {r.teamAbbreviation} vs {r.opponentAbbreviation} · Week {r.week} · {r.seasonLabel}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {teamRecords.length > 0 && (
            <section>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Team Records</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamRecords.map((r) => (
                  <Card key={r.category} className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{r.category}</p>
                    <p className="mt-1 text-2xl font-black tabular-nums text-accent-blue">
                      {r.value.toLocaleString()} <span className="text-sm font-semibold text-text-muted">{r.unit}</span>
                    </p>
                    <p className="mt-1 text-sm font-medium text-text-primary">{r.teamName}</p>
                    <p className="text-xs text-text-faint">
                      vs {r.opponentAbbreviation} · Week {r.week} · {r.seasonLabel}
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
