import type { Position, TeamRatingSummary, TeamStrengthReport } from "@/types/football";

export interface RatedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: Position;
  overall: number;
  injury: number;
}

const OL_POSITIONS: Position[] = ["LT", "LG", "C", "RG", "RT"];
const DL_POSITIONS: Position[] = ["LE", "RE", "DT"];
const LB_POSITIONS: Position[] = ["LOLB", "MLB", "ROLB"];
const CB_POSITIONS: Position[] = ["CB"];
const S_POSITIONS: Position[] = ["FS", "SS"];
const REC_POSITIONS: Position[] = ["WR", "TE"];
const RB_POSITIONS: Position[] = ["RB", "FB"];

function averageTop(players: RatedPlayer[], positions: Position[], count: number): number {
  const pool = players
    .filter((p) => positions.includes(p.position))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, count);
  if (pool.length === 0) return 45; // replacement-level baseline when a position group is empty
  return pool.reduce((sum, p) => sum + p.overall, 0) / pool.length;
}

function bestAt(players: RatedPlayer[], positions: Position[]): number {
  const pool = players.filter((p) => positions.includes(p.position));
  if (pool.length === 0) return 40;
  return Math.max(...pool.map((p) => p.overall));
}

export function calculateOffenseRating(players: RatedPlayer[]): number {
  const qb = bestAt(players, ["QB"]);
  const rb = averageTop(players, RB_POSITIONS, 2);
  const rec = averageTop(players, REC_POSITIONS, 4);
  const ol = averageTop(players, OL_POSITIONS, 5);
  return Math.round(qb * 0.35 + rb * 0.15 + rec * 0.2 + ol * 0.3);
}

export function calculateDefenseRating(players: RatedPlayer[]): number {
  const dl = averageTop(players, DL_POSITIONS, 3);
  const lb = averageTop(players, LB_POSITIONS, 3);
  const cb = averageTop(players, CB_POSITIONS, 2);
  const s = averageTop(players, S_POSITIONS, 2);
  return Math.round(dl * 0.3 + lb * 0.25 + cb * 0.25 + s * 0.2);
}

export function calculateSpecialTeamsRating(players: RatedPlayer[]): number {
  const k = bestAt(players, ["K"]);
  const p = bestAt(players, ["P"]);
  return Math.round(k * 0.6 + p * 0.4);
}

export function calculateTeamRatings(players: RatedPlayer[]): TeamRatingSummary {
  const offenseRating = calculateOffenseRating(players);
  const defenseRating = calculateDefenseRating(players);
  const specialTeamsRating = calculateSpecialTeamsRating(players);
  const overallRating = Math.round(
    offenseRating * 0.45 + defenseRating * 0.45 + specialTeamsRating * 0.1
  );
  return { overallRating, offenseRating, defenseRating, specialTeamsRating };
}

export function calculateTeamStrengths(players: RatedPlayer[]): TeamStrengthReport {
  const groups: { label: string; positions: Position[]; count: number }[] = [
    { label: "Quarterback play", positions: ["QB"], count: 1 },
    { label: "Running back corps", positions: RB_POSITIONS, count: 2 },
    { label: "Receiving corps", positions: REC_POSITIONS, count: 4 },
    { label: "Offensive line", positions: OL_POSITIONS, count: 5 },
    { label: "Defensive line", positions: DL_POSITIONS, count: 3 },
    { label: "Linebacker corps", positions: LB_POSITIONS, count: 3 },
    { label: "Cornerbacks", positions: CB_POSITIONS, count: 2 },
    { label: "Safeties", positions: S_POSITIONS, count: 2 },
    { label: "Special teams", positions: ["K", "P"], count: 2 },
  ];

  const scored = groups.map((g) => ({
    label: g.label,
    score: averageTop(players, g.positions, g.count),
  }));

  scored.sort((a, b) => b.score - a.score);

  return {
    strengths: scored.slice(0, 3).map((s) => s.label),
    weaknesses: scored.slice(-3).reverse().map((s) => s.label),
  };
}
