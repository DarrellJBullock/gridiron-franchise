import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { Scoreboard } from "@/components/football/Scoreboard";
import { GameRecap } from "@/components/football/GameRecap";
import { PlayByPlayLog } from "@/components/football/PlayByPlayLog";
import { TopPerformers } from "@/components/simulation/TopPerformers";
import { selectTopPerformers } from "@/lib/simulation/player-stats";
import { LinkButton } from "@/components/ui/Button";
import type { GamePlayerStatLine } from "@/types/football";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const league = await getOrCreateUserLeague(userId);
  const { id } = await params;

  const game = await prisma.game.findFirst({
    where: { id, homeTeam: { leagueId: league.id } },
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
    interceptionsMade: s.interceptionsMade,
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
      <div className="flex justify-end">
        <LinkButton href={`/game/${game.id}/live`} variant="secondary" size="sm">
          🎬 Watch Graphical Replay
        </LinkButton>
      </div>

      <Scoreboard
        home={{
          id: game.homeTeam.id,
          name: game.homeTeam.name,
          abbreviation: game.homeTeam.abbreviation,
          primaryColor: game.homeTeam.primaryColor,
          secondaryColor: game.homeTeam.secondaryColor,
          score: game.homeScore,
        }}
        away={{
          id: game.awayTeam.id,
          name: game.awayTeam.name,
          abbreviation: game.awayTeam.abbreviation,
          primaryColor: game.awayTeam.primaryColor,
          secondaryColor: game.awayTeam.secondaryColor,
          score: game.awayScore,
        }}
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
