import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import type { Position } from "@/types/football";

interface DepthChartUpdateBody {
  position: Position;
  starterPlayerId: string | null;
  backup1PlayerId: string | null;
  backup2PlayerId: string | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const team = await prisma.team.findFirst({ where: { id, leagueId: league.id } });
  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const body = (await req.json()) as DepthChartUpdateBody;

  const assignedIds = [body.starterPlayerId, body.backup1PlayerId, body.backup2PlayerId].filter(
    (playerId): playerId is string => Boolean(playerId)
  );
  if (new Set(assignedIds).size !== assignedIds.length) {
    return NextResponse.json(
      { error: "A player can only occupy one depth chart slot per position" },
      { status: 400 }
    );
  }

  const updated = await prisma.depthChart.upsert({
    where: { teamId_position: { teamId: id, position: body.position } },
    update: {
      starterPlayerId: body.starterPlayerId,
      backup1PlayerId: body.backup1PlayerId,
      backup2PlayerId: body.backup2PlayerId,
    },
    create: {
      teamId: id,
      position: body.position,
      starterPlayerId: body.starterPlayerId,
      backup1PlayerId: body.backup1PlayerId,
      backup2PlayerId: body.backup2PlayerId,
    },
  });

  return NextResponse.json({ depthChart: updated });
}
