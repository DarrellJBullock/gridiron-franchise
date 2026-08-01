import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { provisionLeagueForOwner } from "@/lib/league/provision-league";

/**
 * Every authenticated user gets exactly one League (enforced by the
 * League.ownerId unique constraint). First call for a new user generates a
 * fresh fictional league; every call after that returns the existing one.
 *
 * Provisioning runs in a transaction, so two concurrent first-time calls
 * (e.g. a prefetch racing the real navigation) can't both see "no league"
 * and each start generating one: the second to commit hits the ownerId
 * unique constraint and just re-fetches the league the first one finished.
 */
export async function getOrCreateUserLeague(ownerId: string) {
  const existing = await prisma.league.findUnique({ where: { ownerId } });
  if (existing) return existing;

  try {
    return await provisionLeagueForOwner(ownerId);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const league = await prisma.league.findUnique({ where: { ownerId } });
      if (league) return league;
    }
    throw err;
  }
}
