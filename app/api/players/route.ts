import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import type { Position } from "@prisma/client";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const position = searchParams.get("position") as Position | null;
  const teamId = searchParams.get("teamId");
  const minOverall = searchParams.get("minOverall");

  const players = await prisma.player.findMany({
    where: {
      retired: false,
      team: { leagueId: league.id },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(position ? { position } : {}),
      ...(teamId ? { teamId } : {}),
      ...(minOverall ? { overall: { gte: Number(minOverall) } } : {}),
    },
    include: {
      team: { select: { id: true, name: true, abbreviation: true, primaryColor: true, secondaryColor: true } },
    },
    orderBy: { overall: "desc" },
    take: 500,
  });

  return NextResponse.json({ players });
}
