import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toRatingMap } from "@/lib/football-mappers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id },
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
