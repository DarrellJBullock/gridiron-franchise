import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { ValidationIssue, TeamImportSummary } from "@/lib/roster/validator";

interface RosterValidationSummaryProps {
  issues: ValidationIssue[];
  teamSummaries: TeamImportSummary[];
  errorCount: number;
  warningCount: number;
  validRowCount: number;
}

export function RosterValidationSummary({
  issues,
  teamSummaries,
  errorCount,
  warningCount,
  validRowCount,
}: RosterValidationSummaryProps) {
  const errors = issues.filter((i) => i.severity === "ERROR").slice(0, 50);
  const warnings = issues.filter((i) => i.severity === "WARNING");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-success">{validRowCount}</p>
          <p className="text-xs text-text-muted">Valid Players</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-danger">{errorCount}</p>
          <p className="text-xs text-text-muted">Errors</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-warning">{warningCount}</p>
          <p className="text-xs text-text-muted">Warnings</p>
        </Card>
      </div>

      {teamSummaries.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Teams Detected</p>
          <div className="flex flex-col gap-2">
            {teamSummaries.map((team) => (
              <div key={team.teamAbbreviation} className="flex items-center justify-between rounded-lg bg-bg-elevated px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    {team.teamName} <span className="text-text-faint">({team.teamAbbreviation})</span>
                  </p>
                  <p className="text-xs text-text-muted">{team.playerCount} players</p>
                </div>
                {team.warnings.length > 0 ? (
                  <Badge tone="warning">{team.warnings.length} warning{team.warnings.length > 1 ? "s" : ""}</Badge>
                ) : (
                  <Badge tone="success">Ready</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {errors.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">Errors (must fix before import)</p>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto scrollbar-thin pr-2 text-sm">
            {errors.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-text-primary">
                <span className="text-danger">✕</span>
                <span>
                  {issue.rowNumber > 0 && <span className="text-text-faint">Row {issue.rowNumber} — </span>}
                  <span className="text-text-faint">{issue.fieldName}:</span> {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-warning">Warnings (import still allowed)</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            {warnings.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-text-primary">
                <span className="text-warning">⚠</span>
                {issue.message}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
