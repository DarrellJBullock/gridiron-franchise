import { Badge } from "@/components/ui/Badge";
import type { Position } from "@/types/football";

const GROUP_TONE: Record<string, "accent" | "blue" | "danger" | "warning"> = {
  offense: "accent",
  defense: "blue",
  specialTeams: "warning",
};

const OFFENSE: Position[] = ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT"];
const SPECIAL: Position[] = ["K", "P"];

function groupFor(position: Position) {
  if (SPECIAL.includes(position)) return "specialTeams";
  if (OFFENSE.includes(position)) return "offense";
  return "defense";
}

export function PositionBadge({ position, className }: { position: Position; className?: string }) {
  return (
    <Badge tone={GROUP_TONE[groupFor(position)]} className={className}>
      {position}
    </Badge>
  );
}
