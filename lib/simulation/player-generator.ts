import type { Position } from "@prisma/client";
import { FIRST_NAMES, LAST_NAMES, HOMETOWNS, ARCHETYPES } from "@/data/seed-names";
import { ratingGroupForPosition, CORE_RATINGS } from "@/types/football";

// Shared procedural player generation, used both to seed initial rosters and to
// generate rookie replacements when a player retires. Keeping this in one place
// means a rookie drafted in Season 4 is generated exactly the same way a player
// on the original Season 1 roster was.

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(v)));
}

// Broad archetype adjustments so different position groups feel distinct
// (linemen strong and slow, corners fast and light, etc.).
const CORE_ADJUSTMENTS: Record<string, Partial<Record<(typeof CORE_RATINGS)[number], number>>> = {
  QB: { speed: -10, strength: -5, awareness: 10 },
  RB: { speed: 8, agility: 8, strength: 2 },
  FB: { strength: 10, speed: -8 },
  WR: { speed: 12, agility: 10, strength: -12 },
  TE: { strength: 4, speed: 0 },
  LT: { strength: 16, speed: -20 }, LG: { strength: 18, speed: -22 }, C: { strength: 14, speed: -20 },
  RG: { strength: 18, speed: -22 }, RT: { strength: 16, speed: -20 },
  LE: { strength: 10, speed: 4 }, RE: { strength: 10, speed: 4 }, DT: { strength: 18, speed: -14 },
  LOLB: { speed: 6, strength: 4 }, MLB: { strength: 8, awareness: 6 }, ROLB: { speed: 6, strength: 4 },
  CB: { speed: 14, agility: 12, strength: -14 },
  FS: { speed: 10, awareness: 8, strength: -8 }, SS: { strength: 4, speed: 6 },
  K: { strength: -10, speed: -15, awareness: 4 }, P: { strength: -10, speed: -15 },
};

export function generateRatings(position: Position, teamQuality: number) {
  const isStar = Math.random() < 0.12;
  const base = clamp(teamQuality + randomInt(-14, 14) + (isStar ? randomInt(6, 14) : 0), 38, 99);

  const ratings: Record<string, number> = {};
  const adjustments = CORE_ADJUSTMENTS[position] ?? {};

  for (const stat of CORE_RATINGS) {
    if (stat === "overall") continue;
    const adj = adjustments[stat] ?? 0;
    ratings[stat] = clamp(base + adj + randomInt(-8, 8), 25, 99);
  }

  const positionGroup = ratingGroupForPosition(position);
  for (const stat of positionGroup) {
    ratings[stat] = clamp(base + randomInt(-6, 12), 30, 99);
  }

  const groupAvg =
    positionGroup.length > 0
      ? positionGroup.reduce((sum, s) => sum + ratings[s], 0) / positionGroup.length
      : base;
  const overall = clamp(groupAvg * 0.6 + base * 0.4, 35, 99);

  return { overall, ratings };
}

export const HEIGHT_BY_GROUP: Record<string, [number, number]> = {
  QB: [72, 77], RB: [68, 72], FB: [70, 74], WR: [69, 75], TE: [74, 78],
  LT: [76, 80], LG: [75, 79], C: [74, 78], RG: [75, 79], RT: [76, 80],
  LE: [74, 78], RE: [74, 78], DT: [74, 78],
  LOLB: [72, 76], MLB: [72, 76], ROLB: [72, 76],
  CB: [69, 73], FS: [70, 74], SS: [70, 74], K: [69, 74], P: [70, 75],
};

export const WEIGHT_BY_GROUP: Record<string, [number, number]> = {
  QB: [210, 235], RB: [195, 225], FB: [235, 255], WR: [175, 210], TE: [240, 260],
  LT: [305, 330], LG: [305, 335], C: [295, 320], RG: [305, 335], RT: [305, 330],
  LE: [255, 280], RE: [255, 280], DT: [300, 330],
  LOLB: [230, 255], MLB: [235, 260], ROLB: [230, 255],
  CB: [180, 200], FS: [190, 210], SS: [200, 220], K: [175, 200], P: [180, 205],
};

export interface GeneratedPlayerAttributes {
  firstName: string;
  lastName: string;
  height: number;
  weight: number;
  archetype: string;
  hometown: string;
  overall: number;
  ratings: Record<string, number>;
}

export function generatePlayerAttributes(
  position: Position,
  teamQuality: number,
  usedNames: Set<string>
): GeneratedPlayerAttributes {
  let fullName = "";
  let attempts = 0;
  do {
    fullName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    attempts++;
  } while (usedNames.has(fullName) && attempts < 20);
  usedNames.add(fullName);
  const [firstName, lastName] = fullName.split(" ");

  const { overall, ratings } = generateRatings(position, teamQuality);
  const [hMin, hMax] = HEIGHT_BY_GROUP[position] ?? [70, 76];
  const [wMin, wMax] = WEIGHT_BY_GROUP[position] ?? [200, 250];

  return {
    firstName,
    lastName,
    height: randomInt(hMin, hMax),
    weight: randomInt(wMin, wMax),
    archetype: pick(ARCHETYPES[position] ?? ["Standard"]),
    hometown: pick(HOMETOWNS),
    overall: Math.round(overall),
    ratings,
  };
}

/** Maps years of experience to the display label used across the UI. */
export function classYearForExperience(yearsPro: number): string {
  if (yearsPro <= 0) return "Rookie";
  if (yearsPro === 1) return "2nd Year";
  if (yearsPro === 2) return "3rd Year";
  if (yearsPro <= 5) return "Veteran";
  return "Pro Bowl Vet";
}

/** Weighted random experience level for populating an initial roster. */
export function randomYearsPro(): number {
  const roll = Math.random();
  if (roll < 0.3) return 0;
  if (roll < 0.55) return randomInt(1, 2);
  if (roll < 0.8) return randomInt(3, 5);
  if (roll < 0.95) return randomInt(6, 9);
  return randomInt(10, 13);
}

export function ageForYearsPro(yearsPro: number): number {
  return clamp(21 + yearsPro + randomInt(0, 2), 21, 40);
}

export interface RosterSlot {
  position: Position;
  count: number;
}

export const ROSTER_COMPOSITION: RosterSlot[] = [
  { position: "QB", count: 2 },
  { position: "RB", count: 3 },
  { position: "FB", count: 1 },
  { position: "WR", count: 5 },
  { position: "TE", count: 2 },
  { position: "LT", count: 2 },
  { position: "LG", count: 2 },
  { position: "C", count: 2 },
  { position: "RG", count: 2 },
  { position: "RT", count: 2 },
  { position: "LE", count: 2 },
  { position: "RE", count: 2 },
  { position: "DT", count: 2 },
  { position: "LOLB", count: 2 },
  { position: "MLB", count: 2 },
  { position: "ROLB", count: 2 },
  { position: "CB", count: 4 },
  { position: "FS", count: 2 },
  { position: "SS", count: 2 },
  { position: "K", count: 1 },
  { position: "P", count: 1 },
];
