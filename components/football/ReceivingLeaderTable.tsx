import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { PositionBadge } from "./PositionBadge";
import type { ReceivingLeaderRow } from "@/lib/stats/leaders";

export function ReceivingLeaderTable({ rows }: { rows: ReceivingLeaderRow[] }) {
  return (
    <Card className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Receiving Leaders</p>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-faint">No stats recorded yet. Simulate a game first.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th className="w-8">#</Th>
                <Th>Player</Th>
                <Th>Pos</Th>
                <Th>Team</Th>
                <Th className="text-right">Rec</Th>
                <Th className="text-right">Yards</Th>
                <Th className="text-right">Avg</Th>
                <Th className="text-right">TD</Th>
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
                  <Td className="text-right tabular-nums text-text-muted">{row.receptions}</Td>
                  <Td className="text-right font-bold tabular-nums text-accent">{row.yards}</Td>
                  <Td className="text-right tabular-nums text-text-muted">{row.avg.toFixed(1)}</Td>
                  <Td className="text-right tabular-nums text-text-muted">{row.touchdowns}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </Card>
  );
}
