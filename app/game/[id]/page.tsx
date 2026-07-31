import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Scoreboard } from "@/components/football/Scoreboard";
import { GameRecap } from "@/components/football/GameRecap";
import { PlayByPlayLog } from "@/components/football/PlayByPlayLog";
import { TopPerformers } from "@/components/simulation/TopPerformers";
import { selectTopPerformers } from "@/lib/simulation/player-stats";
import type { GamePlayerStatLine } from "@/types/football";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      homeTeam: true,
      awayTeam: true,
      teamStats: true,
      playerStats: { include: { player: true } },
      plays: { orderBy: { sequence: "asc" } },
    },
  });
  if (!game) notFound();

  const homeStats = game.teamStats.find((s) => s.teamId === game.homeTeamId);
  const awayStats = game.teamStats.find((s) => s.teamId === game.awayTeamId);

  const playerLines: GamePlayerStatLine[] = game.playerStats.map((s) => ({
    playerId: s.playerId,
    playerName: `${s.player.firstName} ${s.player.lastName}`,
    position: s.player.position,
    passingYards: s.passingYards,
    passingTouchdowns: s.passingTouchdowns,
    interceptions: s.interceptions,
    rushingYards: s.rushingYards,
    rushingTouchdowns: s.rushingTouchdowns,
    receivingYards: s.receivingYards,
    receivingTouchdowns: s.receivingTouchdowns,
    tackles: s.tackles,
    sacks: s.sacks,
    forcedFumbles: s.forcedFumbles,
    fieldGoalsMade: s.fieldGoalsMade,
  }));
  const topPerformers = selectTopPerformers(playerLines, 3);

  return (
    <div className="flex flex-col gap-8">
      <Scoreboard
        home={{ name: game.homeTeam.name, abbreviation: game.homeTeam.abbreviation, primaryColor: game.homeTeam.primaryColor, score: game.homeScore }}
        away={{ name: game.awayTeam.name, abbreviation: game.awayTeam.abbreviation, primaryColor: game.awayTeam.primaryColor, score: game.awayScore }}
        status={game.status}
        week={game.week}
      />

      {topPerformers.length > 0 && <TopPerformers performers={topPerformers} />}

      {homeStats && awayStats && (
        <GameRecap
          homeName={game.homeTeam.name}
          awayName={game.awayTeam.name}
          homeQuarters={game.homeQuarterScores}
          awayQuarters={game.awayQuarterScores}
          homeStats={homeStats}
          awayStats={awayStats}
          summary={game.summary ?? ""}
          turningPoint={game.turningPoint ?? ""}
          playStyleSummary={game.playStyleSummary ?? ""}
        />
      )}

      <PlayByPlayLog plays={game.plays} />
    </div>
  );
}
