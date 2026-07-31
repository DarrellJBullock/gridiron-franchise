import { Card } from "@/components/ui/Card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export interface ImportHistoryRow {
  id: string;
  fileName: string;
  status: string;
  rowCount: number;
  validRowCount: number;
  errorCount: number;
  warningCount: number;
  createdAt: string;
}

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  IMPORTED: "success",
  FAILED: "danger",
  VALIDATED: "warning",
  PENDING: "neutral",
};

export function ImportHistoryTable({ imports }: { imports: ImportHistoryRow[] }) {
  if (imports.length === 0) {
    return <EmptyState title="No imports yet" description="Uploaded rosters will show up here once you run an import." />;
  }

  return (
    <Card className="p-5">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Recent Imports</p>
      <Table>
        <Thead>
          <Tr>
            <Th>File</Th>
            <Th>Status</Th>
            <Th className="text-center">Rows</Th>
            <Th className="text-center">Valid</Th>
            <Th className="text-center">Errors</Th>
            <Th className="text-center">Warnings</Th>
            <Th>Date</Th>
          </Tr>
        </Thead>
        <Tbody>
          {imports.map((imp) => (
            <Tr key={imp.id}>
              <Td className="font-medium text-text-primary">{imp.fileName}</Td>
              <Td>
                <Badge tone={STATUS_TONE[imp.status] ?? "neutral"}>{imp.status}</Badge>
              </Td>
              <Td className="text-center tabular-nums">{imp.rowCount}</Td>
              <Td className="text-center tabular-nums text-success">{imp.validRowCount}</Td>
              <Td className="text-center tabular-nums text-danger">{imp.errorCount}</Td>
              <Td className="text-center tabular-nums text-warning">{imp.warningCount}</Td>
              <Td className="text-text-muted">{new Date(imp.createdAt).toLocaleString()}</Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Card>
  );
}
