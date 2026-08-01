import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import type { TeamSeasonRecord } from "@/lib/stats/team-season-record";

export function TeamSeasonHistoryTable({ records }: { records: TeamSeasonRecord[] }) {
  if (records.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-text-faint">No season history yet.</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-x-auto p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Record by Season</p>
      <Table>
        <Thead>
          <Tr>
            <Th>Season</Th>
            <Th className="text-center">Record</Th>
            <Th className="text-right">PF</Th>
            <Th className="text-right">PA</Th>
            <Th className="text-right">Diff</Th>
            <Th className="text-right">Streak</Th>
          </Tr>
        </Thead>
        <Tbody>
          {records.map((r) => {
            const diff = r.pointsFor - r.pointsAgainst;
            return (
              <Tr key={r.seasonId}>
                <Td className="font-medium text-text-primary">
                  {r.seasonName} <span className="text-text-faint">({r.year})</span>
                </Td>
                <Td className="text-center font-semibold tabular-nums text-text-primary">
                  {r.wins}-{r.losses}
                  {r.ties ? `-${r.ties}` : ""}
                </Td>
                <Td className="text-right tabular-nums">{r.pointsFor}</Td>
                <Td className="text-right tabular-nums">{r.pointsAgainst}</Td>
                <Td className={`text-right tabular-nums font-semibold ${diff > 0 ? "text-success" : diff < 0 ? "text-danger" : "text-text-muted"}`}>
                  {diff > 0 ? "+" : ""}
                  {diff}
                </Td>
                <Td className="text-right tabular-nums text-text-muted">{r.streak}</Td>
              </Tr>
            );
          })}
        </Tbody>
      </Table>
    </Card>
  );
}
