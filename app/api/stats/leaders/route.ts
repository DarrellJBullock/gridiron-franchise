import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { getStatLeaders } from "@/lib/stats/leaders";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const leaders = await getStatLeaders(league.id);
  return NextResponse.json(leaders);
}
