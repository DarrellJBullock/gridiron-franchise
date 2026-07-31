import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Position } from "@/types/football";

interface DepthChartUpdateBody {
  position: Position;
  starterPlayerId: string | null;
  backup1PlayerId: string | null;
  backup2PlayerId: string | null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as DepthChartUpdateBody;

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
