import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { PositionBadge } from "@/components/football/PositionBadge";
import { PlayerRatingGrid } from "@/components/football/PlayerRatingGrid";
import { toRatingMap } from "@/lib/football-mappers";
import { formatHeight, initials } from "@/lib/utils";

export default async function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id },
    include: { ratings: true, team: true },
  });
  if (!player) notFound();

  const ratings = toRatingMap(player.ratings);

  return (
    <div className="flex flex-col gap-8">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-black text-black"
            style={{ background: player.team.primaryColor }}
          >
            {initials(player.firstName, player.lastName)}
          </span>
          <div>
            <h1 className="text-2xl font-black text-text-primary">
              #{player.jerseyNumber} {player.firstName} {player.lastName}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PositionBadge position={player.position} />
              <span className="text-xs text-text-muted">{player.archetype}</span>
              <span className="text-xs text-text-faint">
                {formatHeight(player.height)} · {player.weight} lbs · {player.classYear}
              </span>
            </div>
            <Link href={`/teams/${player.team.id}`} className="mt-1 inline-block text-xs text-accent hover:underline">
              {player.team.name} ({player.team.abbreviation})
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-text-faint">Hometown</p>
            <p className="text-sm text-text-primary">{player.hometown}</p>
          </div>
          <RatingBadge value={player.overall} size="lg" />
        </div>
      </Card>

      <PlayerRatingGrid position={player.position} ratings={ratings} />
    </div>
  );
}
