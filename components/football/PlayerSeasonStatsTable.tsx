import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import type { PlayerSeasonStatLine } from "@/lib/stats/player-season-stats";

interface ColumnDef {
  key: keyof Omit<PlayerSeasonStatLine, "seasonId" | "seasonName" | "year" | "gamesPlayed">;
  label: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: "passingAttempts", label: "Pass Att" },
  { key: "passingCompletions", label: "Comp" },
  { key: "passingYards", label: "Pass Yds" },
  { key: "passingTouchdowns", label: "Pass TD" },
  { key: "interceptions", label: "INT" },
  { key: "rushingAttempts", label: "Rush Att" },
  { key: "rushingYards", label: "Rush Yds" },
  { key: "rushingTouchdowns", label: "Rush TD" },
  { key: "receptions", label: "Rec" },
  { key: "receivingYards", label: "Rec Yds" },
  { key: "receivingTouchdowns", label: "Rec TD" },
  { key: "tackles", label: "Tkl" },
  { key: "sacks", label: "Sck" },
  { key: "forcedFumbles", label: "FF" },
  { key: "interceptionsMade", label: "Def INT" },
  { key: "fieldGoalsMade", label: "FG" },
  { key: "punts", label: "Punts" },
  { key: "puntYards", label: "Punt Yds" },
  { key: "kickReturnYards", label: "KR Yds" },
  { key: "kickReturnTouchdowns", label: "KR TD" },
  { key: "puntReturnYards", label: "PR Yds" },
  { key: "puntReturnTouchdowns", label: "PR TD" },
];

interface PlayerSeasonStatsTableProps {
  seasons: PlayerSeasonStatLine[];
  career: Omit<PlayerSeasonStatLine, "seasonId" | "seasonName" | "year">;
}

export function PlayerSeasonStatsTable({ seasons, career }: PlayerSeasonStatsTableProps) {
  if (seasons.length === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-text-faint">No game stats recorded yet. Simulate a game to start a stat line.</p>
      </Card>
    );
  }

  // Only show stat columns this player has ever actually recorded, so a WR's
  // row isn't padded with a wall of zero passing/defensive columns.
  const columns = ALL_COLUMNS.filter((col) => career[col.key] > 0);

  return (
    <Card className="overflow-x-auto p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Stats by Season</p>
      <Table>
        <Thead>
          <Tr>
            <Th>Season</Th>
            <Th className="text-right">GP</Th>
            {columns.map((col) => (
              <Th key={col.key} className="text-right">
                {col.label}
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {seasons.map((s) => (
            <Tr key={s.seasonId}>
              <Td className="font-medium text-text-primary">
                {s.seasonName}
                {Number.isFinite(s.year) && <span className="text-text-faint"> ({s.year})</span>}
              </Td>
              <Td className="text-right tabular-nums">{s.gamesPlayed}</Td>
              {columns.map((col) => (
                <Td key={col.key} className="text-right tabular-nums">
                  {s[col.key]}
                </Td>
              ))}
            </Tr>
          ))}
          <Tr className="border-t-2 border-border-line">
            <Td className="font-bold text-accent">Career</Td>
            <Td className="text-right font-bold tabular-nums text-accent">{career.gamesPlayed}</Td>
            {columns.map((col) => (
              <Td key={col.key} className="text-right font-bold tabular-nums text-accent">
                {career[col.key]}
              </Td>
            ))}
          </Tr>
        </Tbody>
      </Table>
    </Card>
  );
}
