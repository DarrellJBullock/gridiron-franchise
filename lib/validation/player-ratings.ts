import { z } from "zod";
import { ALL_RATING_NAMES, POSITIONS } from "@/types/football";

export const rating0to100 = z
  .number({ error: "Rating must be a number" })
  .int("Rating must be a whole number")
  .min(0, "Rating must be at least 0")
  .max(100, "Rating must be at most 100");

export const jerseyNumberSchema = z
  .number({ error: "Jersey number must be a number" })
  .int("Jersey number must be a whole number")
  .min(0, "Jersey number must be 0 or greater")
  .max(99, "Jersey number must be 99 or less");

export const positionSchema = z.enum(POSITIONS, {
  error: () => `Position must be one of ${POSITIONS.join(", ")}`,
});

export const teamAbbreviationSchema = z
  .string()
  .regex(/^[A-Z]{2,4}$/, "Team abbreviation must be 2 to 4 uppercase letters");

export const colorHexSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a hex value like #0EA5E9")
  .optional()
  .or(z.literal(""));

// A rating field is optional at the row-parsing level (not all positions use all ratings)
// but if present it must fall in the 0-100 range.
export const optionalRatingSchema = z
  .union([rating0to100, z.nan()])
  .nullable()
  .optional()
  .transform((val) => (typeof val === "number" && !Number.isNaN(val) ? val : undefined));

export const ratingNameSchema = z.enum(ALL_RATING_NAMES as [string, ...string[]]);

export const rosterRowSchema = z.object({
  teamName: z.string().min(1, "Team name is required"),
  teamAbbreviation: teamAbbreviationSchema,
  teamCity: z.string().optional().default(""),
  teamState: z.string().optional().default(""),
  teamPrimaryColor: colorHexSchema,
  teamSecondaryColor: colorHexSchema,
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  jerseyNumber: jerseyNumberSchema,
  position: positionSchema,
  height: z.number().int().min(60).max(90).optional(),
  weight: z.number().int().min(140).max(400).optional(),
  classYear: z.string().optional().default(""),
  hometown: z.string().optional().default(""),
  archetype: z.string().optional().default(""),
  overall: optionalRatingSchema,
  speed: optionalRatingSchema,
  acceleration: optionalRatingSchema,
  strength: optionalRatingSchema,
  agility: optionalRatingSchema,
  awareness: optionalRatingSchema,
  stamina: optionalRatingSchema,
  injury: optionalRatingSchema,
  toughness: optionalRatingSchema,
  throwPower: optionalRatingSchema,
  shortAccuracy: optionalRatingSchema,
  mediumAccuracy: optionalRatingSchema,
  deepAccuracy: optionalRatingSchema,
  throwOnRun: optionalRatingSchema,
  playAction: optionalRatingSchema,
  pocketPresence: optionalRatingSchema,
  carrying: optionalRatingSchema,
  ballCarrierVision: optionalRatingSchema,
  trucking: optionalRatingSchema,
  elusiveness: optionalRatingSchema,
  spinMove: optionalRatingSchema,
  jukeMove: optionalRatingSchema,
  breakTackle: optionalRatingSchema,
  catching: optionalRatingSchema,
  routeRunning: optionalRatingSchema,
  release: optionalRatingSchema,
  spectacularCatch: optionalRatingSchema,
  catchInTraffic: optionalRatingSchema,
  passBlock: optionalRatingSchema,
  runBlock: optionalRatingSchema,
  impactBlock: optionalRatingSchema,
  footwork: optionalRatingSchema,
  handTechnique: optionalRatingSchema,
  blockShed: optionalRatingSchema,
  powerMove: optionalRatingSchema,
  finesseMove: optionalRatingSchema,
  pursuit: optionalRatingSchema,
  tackling: optionalRatingSchema,
  zoneCoverage: optionalRatingSchema,
  manCoverage: optionalRatingSchema,
  press: optionalRatingSchema,
  playRecognition: optionalRatingSchema,
  hitPower: optionalRatingSchema,
  kickPower: optionalRatingSchema,
  kickAccuracy: optionalRatingSchema,
});

export type RosterRowInput = z.infer<typeof rosterRowSchema>;
