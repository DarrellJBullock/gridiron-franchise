import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { toRatingMap } from "@/lib/football-mappers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const player = await prisma.player.findFirst({
    where: { id, team: { leagueId: league.id } },
    include: {
      ratings: true,
      team: true,
    },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({
    player: {
      ...player,
      ratings: toRatingMap(player.ratings),
    },
  });
}
