import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { PositionBadge } from "./PositionBadge";
import type { Position } from "@/types/football";

interface LeaderRowBase {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation: string;
}

type ColumnTone = "muted" | "highlight" | "primary";

const TONE_CLASS: Record<ColumnTone, string> = {
  muted: "text-right tabular-nums text-text-muted",
  highlight: "text-right font-bold tabular-nums text-accent",
  primary: "text-right tabular-nums text-text-primary",
};

export interface LeaderTableColumn<T> {
  label: string;
  value: (row: T) => string | number;
  /** Defaults to "muted". Use "highlight" for the category's headline stat. */
  tone?: ColumnTone;
}

/**
 * Generic leaderboard table: rank / player / position / team, plus
 * whatever stat-specific columns the caller configures. Every "Stat
 * Leaders" category (single-value like sacks, or multi-value like
 * passing) renders through this one component.
 */
export function LeaderTable<T extends LeaderRowBase>({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: T[];
  columns: LeaderTableColumn<T>[];
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
              {columns.map((col) => (
                <Th key={col.label} className="text-right">
                  {col.label}
                </Th>
              ))}
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
                {columns.map((col) => (
                  <Td key={col.label} className={TONE_CLASS[col.tone ?? "muted"]}>
                    {col.value(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Card>
  );
}
