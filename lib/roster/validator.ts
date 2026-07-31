import { rosterRowSchema, type RosterRowInput } from "@/lib/validation/player-ratings";
import type { ParsedRosterRow } from "./parser";
import type { Position } from "@/types/football";

export type IssueSeverity = "ERROR" | "WARNING";

export interface ValidationIssue {
  rowNumber: number;
  severity: IssueSeverity;
  fieldName: string;
  message: string;
}

export interface ValidRosterRow {
  rowNumber: number;
  data: RosterRowInput;
}

export interface TeamImportSummary {
  teamName: string;
  teamAbbreviation: string;
  playerCount: number;
  warnings: string[];
}

export interface RosterValidationResult {
  issues: ValidationIssue[];
  validRows: ValidRosterRow[];
  invalidRowCount: number;
  errorCount: number;
  warningCount: number;
  teamSummaries: TeamImportSummary[];
}

const OL_POSITIONS: Position[] = ["LT", "LG", "C", "RG", "RT"];
const DB_POSITIONS: Position[] = ["CB", "FS", "SS"];

export function validateRosterRows(rows: ParsedRosterRow[]): RosterValidationResult {
  const issues: ValidationIssue[] = [];
  const validRows: ValidRosterRow[] = [];

  const seenJerseyByTeam = new Map<string, Set<number>>();

  for (const row of rows) {
    const result = rosterRowSchema.safeParse(row.data);
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          rowNumber: row.rowNumber,
          severity: "ERROR",
          fieldName: String(issue.path[0] ?? "row"),
          message: issue.message,
        });
      }
      continue;
    }

    const data = result.data;
    const teamKey = data.teamAbbreviation;
    const jerseySet = seenJerseyByTeam.get(teamKey) ?? new Set<number>();
    if (jerseySet.has(data.jerseyNumber)) {
      issues.push({
        rowNumber: row.rowNumber,
        severity: "ERROR",
        fieldName: "jerseyNumber",
        message: `Duplicate jersey number ${data.jerseyNumber} on team ${teamKey}`,
      });
      continue;
    }
    jerseySet.add(data.jerseyNumber);
    seenJerseyByTeam.set(teamKey, jerseySet);

    validRows.push({ rowNumber: row.rowNumber, data });
  }

  // Team-level aggregate checks.
  const byTeam = new Map<string, ValidRosterRow[]>();
  for (const row of validRows) {
    const key = row.data.teamAbbreviation;
    const list = byTeam.get(key) ?? [];
    list.push(row);
    byTeam.set(key, list);
  }

  const teamSummaries: TeamImportSummary[] = [];
  for (const [abbr, teamRows] of byTeam.entries()) {
    const warnings: string[] = [];
    const teamName = teamRows[0].data.teamName;
    const positions = teamRows.map((r) => r.data.position);

    if (teamRows.length < 22) {
      warnings.push(`Team ${abbr} has only ${teamRows.length} players (recommended minimum is 22)`);
    }
    if (!positions.includes("QB")) {
      warnings.push(`Team ${abbr} has no QB on the roster`);
    }
    if (!positions.includes("K")) {
      warnings.push(`Team ${abbr} has no kicker on the roster`);
    }
    const olCount = positions.filter((p) => OL_POSITIONS.includes(p)).length;
    if (olCount < 5) {
      warnings.push(`Team ${abbr} has fewer than 5 offensive linemen (${olCount})`);
    }
    const dbCount = positions.filter((p) => DB_POSITIONS.includes(p)).length;
    if (dbCount < 4) {
      warnings.push(`Team ${abbr} has fewer than 4 defensive backs (${dbCount})`);
    }

    for (const warning of warnings) {
      issues.push({
        rowNumber: 0,
        severity: "WARNING",
        fieldName: "team",
        message: warning,
      });
    }

    teamSummaries.push({
      teamName,
      teamAbbreviation: abbr,
      playerCount: teamRows.length,
      warnings,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const invalidRowNumbers = new Set(
    issues.filter((i) => i.severity === "ERROR" && i.rowNumber > 0).map((i) => i.rowNumber)
  );

  return {
    issues,
    validRows,
    invalidRowCount: invalidRowNumbers.size,
    errorCount,
    warningCount,
    teamSummaries,
  };
}
