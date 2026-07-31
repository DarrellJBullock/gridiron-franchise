import ExcelJS from "exceljs";

// The full ordered column list for the roster upload template, shared by both
// the Excel and CSV generators so the two stay in sync.
export const ROSTER_TEMPLATE_COLUMNS = [
  "teamName",
  "teamAbbreviation",
  "teamCity",
  "teamState",
  "teamPrimaryColor",
  "teamSecondaryColor",
  "firstName",
  "lastName",
  "jerseyNumber",
  "position",
  "height",
  "weight",
  "classYear",
  "hometown",
  "archetype",
  "overall",
  "speed",
  "acceleration",
  "strength",
  "agility",
  "awareness",
  "stamina",
  "injury",
  "toughness",
  "throwPower",
  "shortAccuracy",
  "mediumAccuracy",
  "deepAccuracy",
  "throwOnRun",
  "playAction",
  "pocketPresence",
  "carrying",
  "ballCarrierVision",
  "trucking",
  "elusiveness",
  "spinMove",
  "jukeMove",
  "breakTackle",
  "catching",
  "routeRunning",
  "release",
  "spectacularCatch",
  "catchInTraffic",
  "passBlock",
  "runBlock",
  "impactBlock",
  "footwork",
  "handTechnique",
  "blockShed",
  "powerMove",
  "finesseMove",
  "pursuit",
  "tackling",
  "zoneCoverage",
  "manCoverage",
  "press",
  "playRecognition",
  "hitPower",
  "kickPower",
  "kickAccuracy",
] as const;

const SAMPLE_ROWS: Record<string, string | number>[] = [
  {
    teamName: "Delaware Storm",
    teamAbbreviation: "DLS",
    teamCity: "Wilmington",
    teamState: "DE",
    teamPrimaryColor: "#0EA5E9",
    teamSecondaryColor: "#0F172A",
    firstName: "Marcus",
    lastName: "Whitfield",
    jerseyNumber: 7,
    position: "QB",
    height: 74,
    weight: 220,
    classYear: "Veteran",
    hometown: "Newark, DE",
    archetype: "Field General",
    overall: 88,
    speed: 62,
    acceleration: 65,
    strength: 58,
    agility: 68,
    awareness: 91,
    stamina: 85,
    injury: 80,
    toughness: 82,
    throwPower: 89,
    shortAccuracy: 92,
    mediumAccuracy: 87,
    deepAccuracy: 80,
    throwOnRun: 78,
    playAction: 85,
    pocketPresence: 90,
  },
  {
    teamName: "Delaware Storm",
    teamAbbreviation: "DLS",
    teamCity: "Wilmington",
    teamState: "DE",
    teamPrimaryColor: "#0EA5E9",
    teamSecondaryColor: "#0F172A",
    firstName: "Devon",
    lastName: "Ashe",
    jerseyNumber: 22,
    position: "RB",
    height: 70,
    weight: 210,
    classYear: "3rd Year",
    hometown: "Dover, DE",
    archetype: "Power Back",
    overall: 84,
    speed: 88,
    acceleration: 90,
    strength: 79,
    agility: 84,
    awareness: 75,
    stamina: 88,
    injury: 74,
    toughness: 86,
    carrying: 85,
    ballCarrierVision: 82,
    trucking: 80,
    elusiveness: 78,
    spinMove: 70,
    jukeMove: 75,
    breakTackle: 81,
  },
];

export async function generateRosterTemplateWorkbook(): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gridiron Franchise";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Roster Template");
  sheet.columns = ROSTER_TEMPLATE_COLUMNS.map((col) => ({
    header: col,
    key: col,
    width: Math.max(14, col.length + 2),
  }));

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" },
  };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of SAMPLE_ROWS) {
    sheet.addRow(row);
  }

  const instructions = workbook.addWorksheet("Instructions");
  instructions.columns = [{ width: 100 }];
  const lines = [
    "Gridiron Franchise Roster Upload Template",
    "",
    "1. Do not rename, remove, or reorder the header row on the 'Roster Template' tab.",
    "2. Every row is one player. Repeat teamName/teamAbbreviation on every row for that team.",
    "3. All rating columns must be whole numbers from 0 to 100.",
    "4. jerseyNumber must be a whole number from 0 to 99.",
    "5. position must be one of: QB, RB, FB, WR, TE, LT, LG, C, RG, RT, LE, RE, DT, LOLB, MLB, ROLB, CB, FS, SS, K, P.",
    "6. teamAbbreviation must be 2 to 4 uppercase letters (e.g. DLS).",
    "7. Only fill in rating columns relevant to the player's position. Leave others blank.",
    "8. Each team should have at least 22 players for a full roster.",
    "9. Include at least one QB, one kicker, five offensive linemen, and four defensive backs per team to avoid warnings.",
    "10. Save as .xlsx and upload on the Roster Upload page.",
    "",
    "This is a fictional football simulation. Use original team and player names only.",
  ];
  lines.forEach((line, i) => {
    instructions.getCell(i + 1, 1).value = line;
    if (i === 0) instructions.getCell(i + 1, 1).font = { bold: true, size: 14 };
  });

  return workbook.xlsx.writeBuffer();
}

export function generateRosterTemplateCsv(): string {
  const header = ROSTER_TEMPLATE_COLUMNS.join(",");
  const rows = SAMPLE_ROWS.map((row) =>
    ROSTER_TEMPLATE_COLUMNS.map((col) => {
      const val = row[col];
      if (val === undefined || val === null) return "";
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    }).join(",")
  );
  return [header, ...rows].join("\n") + "\n";
}
