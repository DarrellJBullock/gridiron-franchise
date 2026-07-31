import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { PositionBadge } from "@/components/football/PositionBadge";
import { PlayerRatingGrid } from "@/components/football/PlayerRatingGrid";
import { PlayerJersey } from "@/components/football/PlayerJersey";
import { TeamLogo } from "@/components/football/TeamLogo";
import { toRatingMap } from "@/lib/football-mappers";
import { formatHeight } from "@/lib/utils";

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
          <PlayerJersey
            primaryColor={player.team.primaryColor}
            secondaryColor={player.team.secondaryColor}
            number={player.jerseyNumber}
            size={72}
            className="shrink-0"
          />
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-text-primary">
              #{player.jerseyNumber} {player.firstName} {player.lastName}
              {player.retired && (
                <Badge tone="neutral" className="align-middle text-[10px]">
                  Retired {player.retiredYear ?? ""}
                </Badge>
              )}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <PositionBadge position={player.position} />
              <span className="text-xs text-text-muted">{player.archetype}</span>
              <span className="text-xs text-text-faint">
                {formatHeight(player.height)} · {player.weight} lbs · Age {player.age} · {player.classYear}
              </span>
            </div>
            <Link
              href={`/teams/${player.team.id}`}
              className="mt-1 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
            >
              <TeamLogo
                seed={player.team.id}
                primaryColor={player.team.primaryColor}
                secondaryColor={player.team.secondaryColor}
                abbreviation={player.team.abbreviation}
                size={16}
              />
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
