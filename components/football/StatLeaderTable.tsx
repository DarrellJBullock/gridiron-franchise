import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { PositionBadge } from "./PositionBadge";
import type { Position } from "@/types/football";

export interface StatLeaderRow {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
  value: number;
}

export function StatLeaderTable({
  title,
  unit,
  rows,
}: {
  title: string;
  unit: string;
  rows: StatLeaderRow[];
}) {
  return (
    <Card className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-faint">No stats recorded yet. Simulate a game first.</p>
      ) : (
        <Table>
          <Thead>
            <Tr>
              <Th className="w-8">#</Th>
              <Th>Player</Th>
              <Th>Pos</Th>
              <Th>Team</Th>
              <Th className="text-right">{unit}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, i) => (
              <Tr key={row.playerId}>
                <Td className="text-text-faint">{i + 1}</Td>
                <Td>
                  <Link href={`/players/${row.playerId}`} className="font-medium text-text-primary hover:text-accent">
                    {row.playerName}
                  </Link>
                </Td>
                <Td>
                  <PositionBadge position={row.position} />
                </Td>
                <Td className="text-text-muted">{row.teamAbbreviation}</Td>
                <Td className="text-right font-bold tabular-nums text-accent">{row.value}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  );
}
