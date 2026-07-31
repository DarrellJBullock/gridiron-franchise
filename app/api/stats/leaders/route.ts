import { NextResponse } from "next/server";
import { getStatLeaders } from "@/lib/stats/leaders";

export async function GET() {
  const leaders = await getStatLeaders();
  return NextResponse.json(leaders);
}
