import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "@/components/football/TeamLogo";

export interface GameSummaryTeam {
  id: string;
  name: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
}

interface GameSummaryCardProps {
  gameId: string;
  home: GameSummaryTeam;
  away: GameSummaryTeam;
  homeScore: number;
  awayScore: number;
  week?: number;
  summary?: string;
}

export function GameSummaryCard({ gameId, home, away, homeScore, awayScore, week, summary }: GameSummaryCardProps) {
  return (
    <Link href={`/game/${gameId}`}>
      <Card className="p-4 transition-colors hover:border-accent/50">
        <div className="flex items-center justify-between">
          {week !== undefined && <Badge tone="neutral">Week {week}</Badge>}
          <Badge tone="accent">FINAL</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <TeamLogo
              seed={away.id}
              primaryColor={away.primaryColor}
              secondaryColor={away.secondaryColor}
              abbreviation={away.abbreviation}
              size={24}
              className="shrink-0"
            />
            <span className={`truncate ${awayScore > homeScore ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {away.name}
            </span>
          </span>
          <span className="font-black tabular-nums text-text-primary">{awayScore}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <TeamLogo
              seed={home.id}
              primaryColor={home.primaryColor}
              secondaryColor={home.secondaryColor}
              abbreviation={home.abbreviation}
              size={24}
              className="shrink-0"
            />
            <span className={`truncate ${homeScore > awayScore ? "font-bold text-text-primary" : "text-text-muted"}`}>
              {home.name}
            </span>
          </span>
          <span className="font-black tabular-nums text-text-primary">{homeScore}</span>
        </div>
        {summary && <p className="mt-3 line-clamp-2 text-xs text-text-faint">{summary}</p>}
      </Card>
    </Link>
  );
}
