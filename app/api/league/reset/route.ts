import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const league = await prisma.league.findUnique({ where: { ownerId: userId } });
  if (!league) {
    return NextResponse.json({ success: true });
  }

  // Games reference Team without cascade, so they have to go before the
  // League->Team cascade can delete the teams themselves.
  const teamIds = (await prisma.team.findMany({ where: { leagueId: league.id }, select: { id: true } })).map((t) => t.id);
  await prisma.game.deleteMany({ where: { OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] } });
  await prisma.league.delete({ where: { id: league.id } });

  return NextResponse.json({ success: true });
}
