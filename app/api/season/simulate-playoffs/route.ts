import { NextResponse } from "next/server";
import { runPlayoffs, getExistingBracket } from "@/lib/simulation/playoffs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { seasonId?: string };
  if (!body.seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  try {
    const bracket = await runPlayoffs(body.seasonId);
    return NextResponse.json(bracket);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const seasonId = searchParams.get("seasonId");
  if (!seasonId) {
    return NextResponse.json({ error: "seasonId is required" }, { status: 400 });
  }

  const bracket = await getExistingBracket(seasonId);
  return NextResponse.json({ bracket });
}
