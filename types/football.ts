// Core domain types for Gridiron Franchise.
// Original fictional football simulation. No real leagues, teams, or players.

export const POSITIONS = [
  "QB",
  "RB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
  "LE",
  "RE",
  "DT",
  "LOLB",
  "MLB",
  "ROLB",
  "CB",
  "FS",
  "SS",
  "K",
  "P",
] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_GROUPS = {
  offense: ["QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT"] as Position[],
  defense: ["LE", "RE", "DT", "LOLB", "MLB", "ROLB", "CB", "FS", "SS"] as Position[],
  specialTeams: ["K", "P"] as Position[],
};

export const POSITION_LABELS: Record<Position, string> = {
  QB: "Quarterback",
  RB: "Running Back",
  FB: "Fullback",
  WR: "Wide Receiver",
  TE: "Tight End",
  LT: "Left Tackle",
  LG: "Left Guard",
  C: "Center",
  RG: "Right Guard",
  RT: "Right Tackle",
  LE: "Left End",
  RE: "Right End",
  DT: "Defensive Tackle",
  LOLB: "Left Outside Linebacker",
  MLB: "Middle Linebacker",
  ROLB: "Right Outside Linebacker",
  CB: "Cornerback",
  FS: "Free Safety",
  SS: "Strong Safety",
  K: "Kicker",
  P: "Punter",
};

// Core rating names shared by every player, plus position-specific rating groups.
export const CORE_RATINGS = [
  "overall",
  "speed",
  "acceleration",
  "strength",
  "agility",
  "awareness",
  "stamina",
  "injury",
  "toughness",
] as const;

export const QB_RATINGS = [
  "throwPower",
  "shortAccuracy",
  "mediumAccuracy",
  "deepAccuracy",
  "throwOnRun",
  "playAction",
  "pocketPresence",
] as const;

export const RB_RATINGS = [
  "carrying",
  "ballCarrierVision",
  "trucking",
  "elusiveness",
  "spinMove",
  "jukeMove",
  "breakTackle",
] as const;

export const REC_RATINGS = [
  "catching",
  "routeRunning",
  "release",
  "spectacularCatch",
  "catchInTraffic",
] as const;

export const OL_RATINGS = [
  "passBlock",
  "runBlock",
  "impactBlock",
  "footwork",
  "handTechnique",
] as const;

export const DL_RATINGS = ["blockShed", "powerMove", "finesseMove", "pursuit"] as const;

export const LB_RATINGS = [
  "tackling",
  "pursuit",
  "blockShed",
  "zoneCoverage",
  "hitPower",
] as const;

export const DB_RATINGS = [
  "manCoverage",
  "zoneCoverage",
  "press",
  "playRecognition",
  "catching",
] as const;

export const KP_RATINGS = ["kickPower", "kickAccuracy"] as const;

export const ALL_RATING_NAMES = Array.from(
  new Set([
    ...CORE_RATINGS,
    ...QB_RATINGS,
    ...RB_RATINGS,
    ...REC_RATINGS,
    ...OL_RATINGS,
    ...DL_RATINGS,
    ...LB_RATINGS,
    ...DB_RATINGS,
    ...KP_RATINGS,
  ])
);

export type RatingName = (typeof ALL_RATING_NAMES)[number];

export function ratingGroupForPosition(position: Position): readonly string[] {
  switch (position) {
    case "QB":
      return QB_RATINGS;
    case "RB":
    case "FB":
      return RB_RATINGS;
    case "WR":
    case "TE":
      return REC_RATINGS;
    case "LT":
    case "LG":
    case "C":
    case "RG":
    case "RT":
      return OL_RATINGS;
    case "LE":
    case "RE":
    case "DT":
      return DL_RATINGS;
    case "LOLB":
    case "MLB":
    case "ROLB":
      return LB_RATINGS;
    case "CB":
    case "FS":
    case "SS":
      return DB_RATINGS;
    case "K":
    case "P":
      return KP_RATINGS;
    default:
      return [];
  }
}

export type RatingMap = Record<string, number>;

export interface PlayerWithRatings {
  id: string;
  teamId: string;
  firstName: string;
  lastName: string;
  jerseyNumber: number;
  position: Position;
  height: number;
  weight: number;
  classYear: string;
  hometown: string;
  archetype: string;
  overall: number;
  ratings: RatingMap;
}

export interface TeamRatingSummary {
  overallRating: number;
  offenseRating: number;
  defenseRating: number;
  specialTeamsRating: number;
}

export interface TeamStrengthReport {
  strengths: string[];
  weaknesses: string[];
}

export interface QuarterScores {
  // Always length 4 (Q1-Q4). A 5th entry is appended only if the game went
  // to overtime.
  home: number[];
  away: number[];
}

export interface GameTeamStatLine {
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  turnovers: number;
  firstDowns: number;
  thirdDownConversions: string;
  timeOfPossession: string;
  penalties: string;
}

export interface GamePlayerStatLine {
  playerId: string;
  playerName: string;
  position: Position;
  passingAttempts?: number;
  passingCompletions?: number;
  passingYards?: number;
  passingTouchdowns?: number;
  interceptions?: number;
  interceptionsMade?: number;
  rushingAttempts?: number;
  rushingYards?: number;
  rushingTouchdowns?: number;
  receptions?: number;
  receivingYards?: number;
  receivingTouchdowns?: number;
  tackles?: number;
  sacks?: number;
  forcedFumbles?: number;
  fieldGoalsMade?: number;
  punts?: number;
  puntYards?: number;
  kickReturnYards?: number;
  kickReturnTouchdowns?: number;
  puntReturnYards?: number;
  puntReturnTouchdowns?: number;
}

export type PlayType =
  | "run"
  | "pass"
  | "incomplete"
  | "punt"
  | "field_goal"
  | "missed_field_goal"
  | "touchdown"
  | "extra_point"
  | "interception"
  | "fumble"
  | "kick_return"
  | "punt_return"
  | "penalty"
  | "sack"
  | "injury";

export interface PlayByPlayEntry {
  sequence: number;
  quarter: number;
  driveNumber: number;
  offenseAbbr: string;
  down: number;
  distance: number;
  yardLine: number;
  playType: PlayType;
  description: string;
  yards: number;
  isScoring: boolean;
  isTurnover: boolean;
  secondsRemaining: number;
}

// The shape used while a play is still being built, before it's assigned a
// final sequence number and a stamped game clock — both computed in a
// single pass at the very end of simulateGame.
export type PlayDraft = Omit<PlayByPlayEntry, "sequence" | "secondsRemaining">;

export interface SimulatedGameResult {
  homeScore: number;
  awayScore: number;
  quarterScores: QuarterScores;
  homeStats: GameTeamStatLine;
  awayStats: GameTeamStatLine;
  playerStats: GamePlayerStatLine[];
  plays: PlayByPlayEntry[];
  summary: string;
  topPerformers: GamePlayerStatLine[];
  turningPoint: string;
  playStyleSummary: string;
}
