import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { PositionBadge } from "@/components/football/PositionBadge";
import { RatingBadge } from "@/components/ui/RatingBadge";
import type { ValidRosterRow } from "@/lib/roster/validator";

export function RosterPreviewTable({ rows }: { rows: ValidRosterRow[] }) {
  const preview = rows.slice(0, 100);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Roster Preview</p>
        <p className="text-xs text-text-faint">
          Showing {preview.length} of {rows.length} players
        </p>
      </div>
      <Table>
        <Thead>
          <Tr>
            <Th>#</Th>
            <Th>Player</Th>
            <Th>Pos</Th>
            <Th>Team</Th>
            <Th>Archetype</Th>
            <Th className="text-right">OVR</Th>
          </Tr>
        </Thead>
        <Tbody>
          {preview.map((row) => (
            <Tr key={row.rowNumber}>
              <Td className="text-text-faint">{row.data.jerseyNumber}</Td>
              <Td className="font-medium text-text-primary">
                {row.data.firstName} {row.data.lastName}
              </Td>
              <Td>
                <PositionBadge position={row.data.position} />
              </Td>
              <Td className="text-text-muted">{row.data.teamAbbreviation}</Td>
              <Td className="text-text-muted">{row.data.archetype || "—"}</Td>
              <Td className="text-right">
                <RatingBadge value={row.data.overall ?? 0} size="sm" />
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Card>
  );
}
