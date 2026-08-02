import type { GamePlayerStatLine, Position } from "@/types/football";
import type { RatedPlayer } from "./team-ratings";

export function bestPlayerAt(players: RatedPlayer[], positions: Position[]): RatedPlayer | undefined {
  return players
    .filter((p) => positions.includes(p.position))
    .sort((a, b) => b.overall - a.overall)[0];
}

export function topPlayersAt(players: RatedPlayer[], positions: Position[], count: number): RatedPlayer[] {
  return players
    .filter((p) => positions.includes(p.position))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, count);
}

/** Accumulates per-player stat lines across a simulated game, keyed by player id. */
export class PlayerStatAccumulator {
  private lines = new Map<string, GamePlayerStatLine>();

  private get(player: RatedPlayer): GamePlayerStatLine {
    const existing = this.lines.get(player.id);
    if (existing) return existing;
    const fresh: GamePlayerStatLine = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      position: player.position,
    };
    this.lines.set(player.id, fresh);
    return fresh;
  }

  addPassing(player: RatedPlayer, yards: number, touchdown: boolean, interception: boolean) {
    const line = this.get(player);
    line.passingYards = (line.passingYards ?? 0) + yards;
    if (touchdown) line.passingTouchdowns = (line.passingTouchdowns ?? 0) + 1;
    if (interception) line.interceptions = (line.interceptions ?? 0) + 1;
  }

  addRushing(player: RatedPlayer, yards: number, touchdown: boolean) {
    const line = this.get(player);
    line.rushingYards = (line.rushingYards ?? 0) + yards;
    if (touchdown) line.rushingTouchdowns = (line.rushingTouchdowns ?? 0) + 1;
  }

  addReceiving(player: RatedPlayer, yards: number, touchdown: boolean) {
    const line = this.get(player);
    line.receivingYards = (line.receivingYards ?? 0) + yards;
    if (touchdown) line.receivingTouchdowns = (line.receivingTouchdowns ?? 0) + 1;
  }

  addTackle(player: RatedPlayer) {
    const line = this.get(player);
    line.tackles = (line.tackles ?? 0) + 1;
  }

  addSack(player: RatedPlayer) {
    const line = this.get(player);
    line.sacks = (line.sacks ?? 0) + 1;
  }

  addForcedFumble(player: RatedPlayer) {
    const line = this.get(player);
    line.forcedFumbles = (line.forcedFumbles ?? 0) + 1;
  }

  addInterceptionMade(player: RatedPlayer) {
    const line = this.get(player);
    line.interceptionsMade = (line.interceptionsMade ?? 0) + 1;
  }

  addFieldGoal(player: RatedPlayer) {
    const line = this.get(player);
    line.fieldGoalsMade = (line.fieldGoalsMade ?? 0) + 1;
  }

  addKickReturn(player: RatedPlayer, yards: number, touchdown: boolean) {
    const line = this.get(player);
    line.kickReturnYards = (line.kickReturnYards ?? 0) + yards;
    if (touchdown) line.kickReturnTouchdowns = (line.kickReturnTouchdowns ?? 0) + 1;
  }

  addPuntReturn(player: RatedPlayer, yards: number, touchdown: boolean) {
    const line = this.get(player);
    line.puntReturnYards = (line.puntReturnYards ?? 0) + yards;
    if (touchdown) line.puntReturnTouchdowns = (line.puntReturnTouchdowns ?? 0) + 1;
  }

  values(): GamePlayerStatLine[] {
    return Array.from(this.lines.values());
  }
}

function performanceScore(line: GamePlayerStatLine): number {
  return (
    (line.passingYards ?? 0) * 0.04 +
    (line.passingTouchdowns ?? 0) * 4 +
    (line.rushingYards ?? 0) * 0.1 +
    (line.rushingTouchdowns ?? 0) * 6 +
    (line.receivingYards ?? 0) * 0.1 +
    (line.receivingTouchdowns ?? 0) * 6 +
    (line.tackles ?? 0) * 1 +
    (line.sacks ?? 0) * 2 +
    (line.forcedFumbles ?? 0) * 3 +
    (line.interceptionsMade ?? 0) * 4 +
    (line.fieldGoalsMade ?? 0) * 3 +
    (line.kickReturnYards ?? 0) * 0.08 +
    (line.kickReturnTouchdowns ?? 0) * 6 +
    (line.puntReturnYards ?? 0) * 0.1 +
    (line.puntReturnTouchdowns ?? 0) * 6 -
    (line.interceptions ?? 0) * 2
  );
}

export function selectTopPerformers(lines: GamePlayerStatLine[], count = 3): GamePlayerStatLine[] {
  return [...lines].sort((a, b) => performanceScore(b) - performanceScore(a)).slice(0, count);
}
