"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RosterTemplateDownload } from "@/components/roster/RosterTemplateDownload";
import { RosterUploadDropzone } from "@/components/roster/RosterUploadDropzone";
import { RosterValidationSummary } from "@/components/roster/RosterValidationSummary";
import { RosterPreviewTable } from "@/components/roster/RosterPreviewTable";
import { ImportHistoryTable, type ImportHistoryRow } from "@/components/roster/ImportHistoryTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ValidationIssue, TeamImportSummary, ValidRosterRow } from "@/lib/roster/validator";

interface ValidateResponse {
  rosterImportId: string;
  rowCount: number;
  validRowCount: number;
  errorCount: number;
  warningCount: number;
  issues: ValidationIssue[];
  teamSummaries: TeamImportSummary[];
  validRows: ValidRosterRow[];
}

export default function RosterUploadPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [imports, setImports] = useState<ImportHistoryRow[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const loadHistory = () => {
    fetch("/api/roster/upload")
      .then((r) => r.json())
      .then((data) => setImports(data.imports ?? []));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleFileSelected(selected: File) {
    setFile(selected);
    setValidation(null);
    setImportError(null);
    setImportSuccess(null);
    setIsValidating(true);

    const formData = new FormData();
    formData.append("mode", "validate");
    formData.append("file", selected);

    try {
      const res = await fetch("/api/roster/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      setValidation(data);
      loadHistory();
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleConfirmImport() {
    if (!validation) return;
    setIsImporting(true);
    setImportError(null);

    const formData = new FormData();
    formData.append("mode", "confirm");
    formData.append("rosterImportId", validation.rosterImportId);

    try {
      const res = await fetch("/api/roster/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setImportSuccess(`Imported ${data.teamIds.length} team(s) successfully.`);
      loadHistory();
      setTimeout(() => {
        if (data.teamIds[0]) router.push(`/teams/${data.teamIds[0]}`);
      }, 1200);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">Rosters</p>
        <h1 className="text-2xl font-black text-text-primary">Roster Upload</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Download the template, fill in your fictional team and player data with 0-100 ratings, then
          upload it here for validation before importing.
        </p>
      </div>

      <RosterTemplateDownload />

      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Step 2</p>
        <h3 className="mt-1 mb-4 text-lg font-bold text-text-primary">Upload your completed roster</h3>
        <RosterUploadDropzone onFileSelected={handleFileSelected} fileName={file?.name} isBusy={isValidating} />
      </Card>

      {importError && (
        <Card className="border-danger/40 p-4 text-sm text-danger">{importError}</Card>
      )}
      {importSuccess && (
        <Card className="border-success/40 p-4 text-sm text-success">{importSuccess}</Card>
      )}

      {validation && (
        <>
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Step 3-5 — Validation Results</p>
            <RosterValidationSummary
              issues={validation.issues}
              teamSummaries={validation.teamSummaries}
              errorCount={validation.errorCount}
              warningCount={validation.warningCount}
              validRowCount={validation.validRowCount}
            />
          </div>

          {validation.validRows.length > 0 && (
            <>
              <RosterPreviewTable rows={validation.validRows} />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Step 6-7 — Confirm Import</p>
                <Button size="lg" onClick={handleConfirmImport} disabled={isImporting}>
                  {isImporting ? "Importing…" : `✅ Confirm Import (${validation.validRowCount} players)`}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <ImportHistoryTable imports={imports} />
    </div>
  );
}
