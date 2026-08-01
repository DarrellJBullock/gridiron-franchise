import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "./TeamLogo";
import type { PlayoffMatchup } from "@/lib/simulation/playoffs";

function MatchupRow({ matchup }: { matchup: PlayoffMatchup }) {
  const content = (
    <div className="flex flex-col gap-2 rounded-lg border border-border-line bg-bg-elevated p-3">
      {[matchup.away, matchup.home].map((seed, i) => {
        const score = i === 0 ? matchup.awayScore : matchup.homeScore;
        const isWinner = matchup.winnerTeamId === seed.teamId;
        return (
          <div key={seed.teamId} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-xs font-bold text-text-faint">#{seed.seed}</span>
              <TeamLogo
                seed={seed.teamId}
                primaryColor={seed.primaryColor}
                secondaryColor={seed.secondaryColor}
                abbreviation={seed.abbreviation}
                size={24}
                className="shrink-0"
              />
              <span className={`truncate text-sm ${isWinner ? "font-bold text-text-primary" : "text-text-muted"}`}>
                {seed.name}
              </span>
            </div>
            <span className={`font-black tabular-nums ${isWinner ? "text-accent" : "text-text-faint"}`}>
              {matchup.status === "FINAL" ? score : "-"}
            </span>
          </div>
        );
      })}
    </div>
  );

  return matchup.status === "FINAL" ? <Link href={`/game/${matchup.gameId}`}>{content}</Link> : content;
}

export function PlayoffBracket({
  semifinals,
  championship,
}: {
  semifinals: PlayoffMatchup[];
  championship: PlayoffMatchup | null;
}) {
  const champion =
    championship?.status === "FINAL"
      ? championship.winnerTeamId === championship.home.teamId
        ? championship.home
        : championship.away
      : null;

  return (
    <Card className="p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Playoff Bracket</p>

      {champion && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3">
          <TeamLogo
            seed={champion.teamId}
            primaryColor={champion.primaryColor}
            secondaryColor={champion.secondaryColor}
            abbreviation={champion.abbreviation}
            size={36}
          />
          <p className="text-sm font-bold text-accent">🏆 {champion.name} wins the championship!</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Badge tone="blue" className="mb-2">
            Semifinal
          </Badge>
          <MatchupRow matchup={semifinals[0]} />
        </div>
        <div>
          <Badge tone="blue" className="mb-2">
            Semifinal
          </Badge>
          <MatchupRow matchup={semifinals[1]} />
        </div>
      </div>

      {championship && (
        <div className="mt-4">
          <Badge tone="accent" className="mb-2">
            Championship
          </Badge>
          <MatchupRow matchup={championship} />
        </div>
      )}
    </Card>
  );
}
