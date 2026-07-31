import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { PositionBadge } from "./PositionBadge";
import { formatHeight, initials } from "@/lib/utils";
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
  team?: { name: string; abbreviation: string; primaryColor: string } | null;
}

export function PlayerCard({ player, linkToDetail = true }: { player: PlayerCardData; linkToDetail?: boolean }) {
  const content = (
    <Card className="group flex items-center gap-4 p-4 transition-colors hover:border-accent/50">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-black"
        style={{ background: player.team?.primaryColor ?? "#f5a623" }}
      >
        {initials(player.firstName, player.lastName)}
      </span>
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
