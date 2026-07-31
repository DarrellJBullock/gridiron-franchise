import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function RosterTemplateDownload() {
  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Step 1</p>
      <h3 className="mt-1 text-lg font-bold text-text-primary">Download the roster template</h3>
      <p className="mt-1 text-sm text-text-muted">
        Every column your team and player data needs, with sample rows and an instructions tab. Use the
        Excel template for full validation hints, or the CSV if you prefer a plain spreadsheet.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href="/api/roster/template?format=xlsx" download>
          <Button variant="primary" size="md">
            ⬇ Download Excel Template (.xlsx)
          </Button>
        </a>
        <a href="/api/roster/template?format=csv" download>
          <Button variant="secondary" size="md">
            ⬇ Download CSV Template (.csv)
          </Button>
        </a>
      </div>
    </Card>
  );
}
