import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");

  const games = await prisma.game.findMany({
    where: seasonId ? { seasonId } : undefined,
    include: {
      homeTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
      awayTeam: { select: { id: true, name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
    },
    orderBy: [{ week: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ games });
}
