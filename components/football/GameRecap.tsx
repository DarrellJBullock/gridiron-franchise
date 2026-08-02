import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import type { GameTeamStatLine } from "@/types/football";

interface GameRecapProps {
  homeName: string;
  awayName: string;
  homeQuarters: number[];
  awayQuarters: number[];
  homeStats: GameTeamStatLine;
  awayStats: GameTeamStatLine;
  summary: string;
  turningPoint: string;
  playStyleSummary: string;
}

const STAT_ROWS: { key: keyof GameTeamStatLine; label: string }[] = [
  { key: "totalYards", label: "Total Yards" },
  { key: "passingYards", label: "Passing Yards" },
  { key: "rushingYards", label: "Rushing Yards" },
  { key: "firstDowns", label: "First Downs" },
  { key: "thirdDownConversions", label: "3rd Down Conv." },
  { key: "turnovers", label: "Turnovers" },
  { key: "penalties", label: "Penalties" },
  { key: "timeOfPossession", label: "Time of Possession" },
];

export function GameRecap({
  homeName,
  awayName,
  homeQuarters,
  awayQuarters,
  homeStats,
  awayStats,
  summary,
  turningPoint,
  playStyleSummary,
}: GameRecapProps) {
  const quarterCount = Math.max(homeQuarters.length, awayQuarters.length, 4);
  const quarterLabels = Array.from({ length: quarterCount }, (_, i) => (i < 4 ? `Q${i + 1}` : "OT"));

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Quarter by Quarter</p>
        <Table>
          <Thead>
            <Tr>
              <Th>Team</Th>
              {quarterLabels.map((label) => (
                <Th key={label} className="text-center">
                  {label}
                </Th>
              ))}
              <Th className="text-center">Final</Th>
            </Tr>
          </Thead>
          <Tbody>
            <Tr>
              <Td className="font-semibold">{awayName}</Td>
              {awayQuarters.map((q, i) => (
                <Td key={i} className="text-center tabular-nums">{q}</Td>
              ))}
              <Td className="text-center font-bold tabular-nums text-accent">
                {awayQuarters.reduce((a, b) => a + b, 0)}
              </Td>
            </Tr>
            <Tr>
              <Td className="font-semibold">{homeName}</Td>
              {homeQuarters.map((q, i) => (
                <Td key={i} className="text-center tabular-nums">{q}</Td>
              ))}
              <Td className="text-center font-bold tabular-nums text-accent">
                {homeQuarters.reduce((a, b) => a + b, 0)}
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </Card>

      <Card className="p-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Team Stats</p>
        <Table>
          <Thead>
            <Tr>
              <Th>{awayName}</Th>
              <Th className="text-center">Stat</Th>
              <Th className="text-right">{homeName}</Th>
            </Tr>
          </Thead>
          <Tbody>
            {STAT_ROWS.map((row) => (
              <Tr key={row.key}>
                <Td className="font-semibold text-accent">{String(awayStats[row.key])}</Td>
                <Td className="text-center text-text-muted">{row.label}</Td>
                <Td className="text-right font-semibold text-accent-blue">{String(homeStats[row.key])}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      <Card className="p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Game Summary</p>
        <p className="text-sm text-text-primary">{summary}</p>
        <p className="mt-3 text-sm text-text-muted">
          <span className="font-semibold text-text-primary">Turning point: </span>
          {turningPoint}
        </p>
        <p className="mt-1 text-sm text-text-muted">{playStyleSummary}</p>
      </Card>
    </div>
  );
}
