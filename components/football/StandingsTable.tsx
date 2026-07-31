import Link from "next/link";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { TeamLogo } from "./TeamLogo";

export interface StandingRow {
  teamId: string;
  teamName: string;
  abbreviation: string;
  primaryColor: string;
  secondaryColor: string;
  division: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string;
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const byDivision = rows.reduce<Record<string, StandingRow[]>>((acc, row) => {
    (acc[row.division] ??= []).push(row);
    return acc;
  }, {});

  for (const division of Object.keys(byDivision)) {
    byDivision[division].sort((a, b) => {
      const winPctA = a.wins / Math.max(1, a.wins + a.losses + a.ties);
      const winPctB = b.wins / Math.max(1, b.wins + b.losses + b.ties);
      return winPctB - winPctA || b.pointsFor - a.pointsFor;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(byDivision).map(([division, teams]) => (
        <div key={division}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{division} Division</p>
          <Table>
            <Thead>
              <Tr>
                <Th>Team</Th>
                <Th className="text-center">W</Th>
                <Th className="text-center">L</Th>
                <Th className="text-center">T</Th>
                <Th className="text-center">PF</Th>
                <Th className="text-center">PA</Th>
                <Th className="text-center">Diff</Th>
                <Th className="text-center">Streak</Th>
              </Tr>
            </Thead>
            <Tbody>
              {teams.map((team) => (
                <Tr key={team.teamId}>
                  <Td>
                    <Link href={`/teams/${team.teamId}`} className="flex items-center gap-2 font-medium text-text-primary hover:text-accent">
                      <TeamLogo
                        seed={team.teamId}
                        primaryColor={team.primaryColor}
                        secondaryColor={team.secondaryColor}
                        abbreviation={team.abbreviation}
                        size={24}
                      />
                      {team.teamName}
                    </Link>
                  </Td>
                  <Td className="text-center tabular-nums">{team.wins}</Td>
                  <Td className="text-center tabular-nums">{team.losses}</Td>
                  <Td className="text-center tabular-nums">{team.ties}</Td>
                  <Td className="text-center tabular-nums">{team.pointsFor}</Td>
                  <Td className="text-center tabular-nums">{team.pointsAgainst}</Td>
                  <Td className="text-center tabular-nums">
                    {team.pointsFor - team.pointsAgainst > 0 ? "+" : ""}
                    {team.pointsFor - team.pointsAgainst}
                  </Td>
                  <Td className="text-center">
                    <Badge tone={team.streak.startsWith("W") ? "success" : team.streak.startsWith("L") ? "danger" : "neutral"}>
                      {team.streak}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      ))}
    </div>
  );
}
