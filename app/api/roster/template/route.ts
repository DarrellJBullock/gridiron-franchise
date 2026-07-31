import { NextResponse } from "next/server";
import { generateRosterTemplateWorkbook, generateRosterTemplateCsv } from "@/lib/roster/template";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") === "csv" ? "csv" : "xlsx";

  if (format === "csv") {
    const csv = generateRosterTemplateCsv();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="roster-template.csv"',
      },
    });
  }

  const buffer = await generateRosterTemplateWorkbook();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="roster-template.xlsx"',
    },
  });
}
