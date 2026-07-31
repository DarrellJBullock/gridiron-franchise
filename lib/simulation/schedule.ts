export interface ScheduledMatchup {
  week: number;
  homeTeamId: string;
  awayTeamId: string;
}

// Standard circle-method round robin: N-1 weeks for an even number of teams,
// alternating home/away assignment each round so it doesn't always favor one slot.
export function generateRoundRobinSchedule(teamIds: string[]): ScheduledMatchup[] {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push("__BYE__");

  const n = ids.length;
  const rounds = n - 1;
  const schedule: ScheduledMatchup[] = [];
  const fixed = ids[0];
  let rotating = ids.slice(1);

  for (let round = 0; round < rounds; round++) {
    const roundTeams = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const teamA = roundTeams[i];
      const teamB = roundTeams[n - 1 - i];
      if (teamA === "__BYE__" || teamB === "__BYE__") continue;
      const homeFirst = (round + i) % 2 === 0;
      schedule.push({
        week: round + 1,
        homeTeamId: homeFirst ? teamA : teamB,
        awayTeamId: homeFirst ? teamB : teamA,
      });
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return schedule;
}
