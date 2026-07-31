import fs from "node:fs";
import path from "node:path";
import { generateRosterTemplateWorkbook, generateRosterTemplateCsv } from "../lib/roster/template";

async function main() {
  const outDir = path.join(process.cwd(), "public", "templates");
  fs.mkdirSync(outDir, { recursive: true });

  const xlsxBuffer = await generateRosterTemplateWorkbook();
  fs.writeFileSync(path.join(outDir, "roster-template.xlsx"), Buffer.from(xlsxBuffer));

  const csv = generateRosterTemplateCsv();
  fs.writeFileSync(path.join(outDir, "roster-template.csv"), csv);

  console.log("Generated roster-template.xlsx and roster-template.csv in public/templates");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
