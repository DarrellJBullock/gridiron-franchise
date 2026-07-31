import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { PositionBadge } from "./PositionBadge";
import { PlayerJersey } from "./PlayerJersey";
import { formatHeight } from "@/lib/utils";
import type { Position } from "@/types/football";

export interface PlayerCardData {
  id: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: Position;
  height: number;
  weight: number;
  archetype: string;
  overall: number;
  team?: { name: string; abbreviation: string; primaryColor: string; secondaryColor: string } | null;
}

export function PlayerCard({ player, linkToDetail = true }: { player: PlayerCardData; linkToDetail?: boolean }) {
  const content = (
    <Card className="group flex items-center gap-4 p-4 transition-colors hover:border-accent/50">
      <PlayerJersey
        primaryColor={player.team?.primaryColor ?? "#f5a623"}
        secondaryColor={player.team?.secondaryColor ?? "#0F172A"}
        number={player.jerseyNumber}
        size={48}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-text-primary group-hover:text-accent transition-colors">
            #{player.jerseyNumber} {player.firstName} {player.lastName}
          </p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <PositionBadge position={player.position} />
          <span className="text-xs text-text-faint">
            {formatHeight(player.height)} · {player.weight} lbs
          </span>
        </div>
        <p className="mt-1 truncate text-xs text-text-muted">{player.archetype}</p>
      </div>
      <RatingBadge value={player.overall} size="lg" />
    </Card>
  );

  if (!linkToDetail) return content;
  return <Link href={`/players/${player.id}`}>{content}</Link>;
}
