import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "./TeamLogo";
import type { ConferenceBracket, PlayoffMatchup } from "@/lib/simulation/playoffs";

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

  if (matchup.status !== "FINAL") return content;

  return (
    <div className="flex flex-col gap-1">
      <Link href={`/game/${matchup.gameId}`}>{content}</Link>
      <Link
        href={`/game/${matchup.gameId}/live`}
        className="text-center text-[11px] font-semibold text-accent hover:underline"
      >
        🎬 Watch Replay
      </Link>
    </div>
  );
}

function ConferencePanel({ bracket }: { bracket: ConferenceBracket }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-accent-blue">{bracket.conference}</p>
      {bracket.semifinals.length === 0 ? (
        <p className="text-xs text-text-faint">Not enough teams to seed this conference.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {bracket.semifinals.map((matchup, i) => (
              <div key={i}>
                <Badge tone="blue" className="mb-1.5">
                  Semifinal
                </Badge>
                <MatchupRow matchup={matchup} />
              </div>
            ))}
          </div>
          {bracket.championship && (
            <div className="mt-3">
              <Badge tone="accent" className="mb-1.5">
                Conference Championship
              </Badge>
              <MatchupRow matchup={bracket.championship} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function PlayoffBracket({
  conferences,
  leagueChampionship,
}: {
  conferences: ConferenceBracket[];
  leagueChampionship: PlayoffMatchup | null;
}) {
  const champion =
    leagueChampionship?.status === "FINAL"
      ? leagueChampionship.winnerTeamId === leagueChampionship.home.teamId
        ? leagueChampionship.home
        : leagueChampionship.away
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
          <p className="text-sm font-bold text-accent">🏆 {champion.name} wins the League Championship!</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {conferences.map((bracket) => (
          <ConferencePanel key={bracket.conference} bracket={bracket} />
        ))}
      </div>

      {leagueChampionship && (
        <div className="mt-5 border-t border-border-line pt-4">
          <Badge tone="accent" className="mb-1.5">
            League Championship
          </Badge>
          <MatchupRow matchup={leagueChampionship} />
        </div>
      )}
    </Card>
  );
}
