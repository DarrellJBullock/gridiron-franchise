import type { Player, PlayerRating, Team } from "@prisma/client";
import type { RatingMap } from "@/types/football";
import type { RatedPlayer } from "@/lib/simulation/team-ratings";

export type PlayerWithRatingsRow = Player & { ratings: PlayerRating[] };

export function toRatingMap(ratings: PlayerRating[]): RatingMap {
  const map: RatingMap = {};
  for (const r of ratings) map[r.ratingName] = r.ratingValue;
  return map;
}

export function toRatedPlayer(player: Player, ratings: PlayerRating[] = []): RatedPlayer {
  const injuryRating = ratings.find((r) => r.ratingName === "injury")?.ratingValue;
  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    overall: player.overall,
    injury: injuryRating ?? 70,
  };
}

export function teamCardData(team: Team, rosterSize: number) {
  return {
    id: team.id,
    name: team.name,
    abbreviation: team.abbreviation,
    city: team.city,
    state: team.state,
    primaryColor: team.primaryColor,
    secondaryColor: team.secondaryColor,
    overallRating: team.overallRating,
    offenseRating: team.offenseRating,
    defenseRating: team.defenseRating,
    rosterSize,
  };
}
