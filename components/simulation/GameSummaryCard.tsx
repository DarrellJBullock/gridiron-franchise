import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface GameSummaryCardProps {
  gameId: string;
  homeName: string;
  homeAbbr: string;
  awayName: string;
  awayAbbr: string;
  homeScore: number;
  awayScore: number;
  week?: number;
  summary?: string;
}

export function GameSummaryCard({
  gameId,
  homeName,
  homeAbbr,
  awayName,
  awayAbbr,
  homeScore,
  awayScore,
  week,
  summary,
}: GameSummaryCardProps) {
  return (
    <Link href={`/game/${gameId}`}>
      <Card className="p-4 transition-colors hover:border-accent/50">
        <div className="flex items-center justify-between">
          {week !== undefined && <Badge tone="neutral">Week {week}</Badge>}
          <Badge tone="accent">FINAL</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className={awayScore > homeScore ? "font-bold text-text-primary" : "text-text-muted"}>
            {awayAbbr} {awayName}
          </span>
          <span className="font-black tabular-nums text-text-primary">{awayScore}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className={homeScore > awayScore ? "font-bold text-text-primary" : "text-text-muted"}>
            {homeAbbr} {homeName}
          </span>
          <span className="font-black tabular-nums text-text-primary">{homeScore}</span>
        </div>
        {summary && <p className="mt-3 line-clamp-2 text-xs text-text-faint">{summary}</p>}
      </Card>
    </Link>
  );
}
