import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Position } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const position = searchParams.get("position") as Position | null;
  const teamId = searchParams.get("teamId");
  const minOverall = searchParams.get("minOverall");

  const players = await prisma.player.findMany({
    where: {
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
      team: { select: { id: true, name: true, abbreviation: true, primaryColor: true } },
    },
    orderBy: { overall: "desc" },
    take: 500,
  });

  return NextResponse.json({ players });
}
