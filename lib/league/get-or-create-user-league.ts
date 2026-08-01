import { prisma } from "@/lib/prisma";
import { provisionLeagueForOwner } from "@/lib/league/provision-league";

/**
 * Every authenticated user gets exactly one League (enforced by the
 * League.ownerId unique constraint). First call for a new user generates a
 * fresh fictional league; every call after that returns the existing one.
 */
export async function getOrCreateUserLeague(ownerId: string) {
  const existing = await prisma.league.findUnique({ where: { ownerId } });
  if (existing) return existing;
  return provisionLeagueForOwner(ownerId);
}
