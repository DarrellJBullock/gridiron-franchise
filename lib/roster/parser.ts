import ExcelJS from "exceljs";
import { ROSTER_TEMPLATE_COLUMNS } from "./template";

export interface ParsedRosterRow {
  rowNumber: number;
  data: Record<string, unknown>;
}

export interface ParseResult {
  rows: ParsedRosterRow[];
  columnsFound: string[];
}

const NUMERIC_COLUMNS = new Set(
  ROSTER_TEMPLATE_COLUMNS.filter(
    (c) => !["teamName", "teamAbbreviation", "teamCity", "teamState", "teamPrimaryColor", "teamSecondaryColor", "firstName", "lastName", "position", "classYear", "hometown", "archetype"].includes(c)
  )
);

function coerceValue(column: string, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === "") return undefined;
  if (NUMERIC_COLUMNS.has(column as (typeof ROSTER_TEMPLATE_COLUMNS)[number])) {
    const num = typeof raw === "number" ? raw : Number(String(raw).trim());
    return Number.isNaN(num) ? raw : num;
  }
  if (raw instanceof Date) return raw.toISOString();
  return typeof raw === "string" ? raw.trim() : raw;
}

export async function parseRosterExcel(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], columnsFound: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim();
  });

  const rows: ParsedRosterRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data: Record<string, unknown> = {};
    let hasAnyValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      let value: unknown = cell.value;
      if (value && typeof value === "object" && "result" in value) {
        value = (value as { result: unknown }).result;
      }
      if (value && typeof value === "object" && "text" in value) {
        value = (value as { text: unknown }).text;
      }
      const coerced = coerceValue(header, value);
      if (coerced !== undefined) hasAnyValue = true;
      data[header] = coerced;
    });
    if (hasAnyValue) {
      rows.push({ rowNumber, data });
    }
  });

  return { rows, columnsFound: headers.filter(Boolean) };
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

export function parseRosterCsv(text: string): ParseResult {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], columnsFound: [] };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: ParsedRosterRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const data: Record<string, unknown> = {};
    let hasAnyValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const coerced = coerceValue(header, values[idx]);
      if (coerced !== undefined) hasAnyValue = true;
      data[header] = coerced;
    });
    if (hasAnyValue) {
      rows.push({ rowNumber: i + 1, data });
    }
  }

  return { rows, columnsFound: headers.filter(Boolean) };
}

export async function parseRosterFile(file: {
  name: string;
  arrayBuffer(): Promise<ArrayBuffer>;
}): Promise<ParseResult> {
  const lowerName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (lowerName.endsWith(".csv")) {
    const text = new TextDecoder("utf-8").decode(buffer);
    return parseRosterCsv(text);
  }
  return parseRosterExcel(buffer);
}
