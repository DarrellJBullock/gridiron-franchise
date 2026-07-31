import { Card } from "@/components/ui/Card";
import { PositionBadge } from "@/components/football/PositionBadge";
import type { GamePlayerStatLine } from "@/types/football";

function statLine(line: GamePlayerStatLine): string {
  const parts: string[] = [];
  if (line.passingYards) parts.push(`${line.passingYards} pass yds`);
  if (line.passingTouchdowns) parts.push(`${line.passingTouchdowns} pass TD`);
  if (line.rushingYards) parts.push(`${line.rushingYards} rush yds`);
  if (line.rushingTouchdowns) parts.push(`${line.rushingTouchdowns} rush TD`);
  if (line.receivingYards) parts.push(`${line.receivingYards} rec yds`);
  if (line.receivingTouchdowns) parts.push(`${line.receivingTouchdowns} rec TD`);
  if (line.tackles) parts.push(`${line.tackles} tackles`);
  if (line.sacks) parts.push(`${line.sacks} sacks`);
  if (line.interceptions) parts.push(`${line.interceptions} INT`);
  if (line.fieldGoalsMade) parts.push(`${line.fieldGoalsMade} FG made`);
  return parts.join(", ") || "No notable stats";
}

export function TopPerformers({ performers }: { performers: GamePlayerStatLine[] }) {
  return (
    <Card className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Top Performers</p>
      <div className="flex flex-col gap-3">
        {performers.map((p) => (
          <div key={p.playerId} className="flex items-start gap-3">
            <PositionBadge position={p.position} />
            <div>
              <p className="text-sm font-semibold text-text-primary">{p.playerName}</p>
              <p className="text-xs text-text-muted">{statLine(p)}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
