import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateUserLeague } from "@/lib/league/get-or-create-user-league";
import { CONFERENCE_DIVISIONS } from "@/lib/league/provision-league";
import { parseRosterFile } from "@/lib/roster/parser";
import { validateRosterRows, type ValidRosterRow } from "@/lib/roster/validator";
import { calculateTeamRatings, type RatedPlayer } from "@/lib/simulation/team-ratings";
import { ALL_RATING_NAMES, type Position } from "@/types/football";

export const runtime = "nodejs";

async function persistValidationRun(leagueId: string, fileName: string, rowCount: number, result: ReturnType<typeof validateRosterRows>, rawRows: { rowNumber: number; data: Record<string, unknown> }[]) {
  const status = result.errorCount > 0 && result.validRows.length === 0 ? "FAILED" : "VALIDATED";

  const rosterImport = await prisma.rosterImport.create({
    data: {
      leagueId,
      fileName,
      status,
      rowCount,
      validRowCount: result.validRows.length,
      errorCount: result.errorCount,
      warningCount: result.warningCount,
      rows: {
        create: rawRows.map((r) => ({
          rowNumber: r.rowNumber,
          rawData: JSON.parse(JSON.stringify(r.data)),
          isValid: !result.issues.some((i) => i.rowNumber === r.rowNumber && i.severity === "ERROR"),
        })),
      },
      issues: {
        create: result.issues.map((i) => ({
          rowNumber: i.rowNumber,
          severity: i.severity,
          fieldName: i.fieldName,
          message: i.message,
        })),
      },
    },
  });

  return rosterImport;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const formData = await req.formData();
  const mode = String(formData.get("mode") ?? "validate");

  if (mode === "confirm") {
    const rosterImportId = String(formData.get("rosterImportId") ?? "");
    const rosterImport = await prisma.rosterImport.findFirst({
      where: { id: rosterImportId, leagueId: league.id },
      include: { rows: true },
    });
    if (!rosterImport) {
      return NextResponse.json({ error: "Roster import not found" }, { status: 404 });
    }

    const rawRows = rosterImport.rows.map((r) => ({
      rowNumber: r.rowNumber,
      data: r.rawData as Record<string, unknown>,
    }));
    const result = validateRosterRows(rawRows);

    const byTeam = new Map<string, ValidRosterRow[]>();
    for (const row of result.validRows) {
      const list = byTeam.get(row.data.teamAbbreviation) ?? [];
      list.push(row);
      byTeam.set(row.data.teamAbbreviation, list);
    }

    const createdTeamIds: string[] = [];

    for (const [abbreviation, rows] of byTeam.entries()) {
      const first = rows[0].data;
      let team = await prisma.team.findFirst({ where: { abbreviation, leagueId: league.id } });

      if (team) {
        await prisma.player.deleteMany({ where: { teamId: team.id } });
        await prisma.depthChart.deleteMany({ where: { teamId: team.id } });
        team = await prisma.team.update({
          where: { id: team.id },
          data: {
            name: first.teamName,
            city: first.teamCity || team.city,
            state: first.teamState || team.state,
            primaryColor: first.teamPrimaryColor || team.primaryColor,
            secondaryColor: first.teamSecondaryColor || team.secondaryColor,
          },
        });
      } else {
        // Spread new teams across divisions round-robin so an uploaded
        // roster doesn't just pile onto one default division.
        const existingTeamCount = await prisma.team.count({ where: { leagueId: league.id } });
        const { conference, division } = CONFERENCE_DIVISIONS[existingTeamCount % CONFERENCE_DIVISIONS.length];
        team = await prisma.team.create({
          data: {
            leagueId: league.id,
            name: first.teamName,
            abbreviation,
            city: first.teamCity || "Unknown",
            state: first.teamState || "",
            conference,
            division,
            primaryColor: first.teamPrimaryColor || "#0EA5E9",
            secondaryColor: first.teamSecondaryColor || "#0F172A",
          },
        });
      }

      const ratedPlayers: RatedPlayer[] = [];
      const byPosition = new Map<Position, { id: string; overall: number }[]>();

      for (const row of rows) {
        const data = row.data;
        const ratingEntries = ALL_RATING_NAMES.filter(
          (name) => name !== "overall" && data[name as keyof typeof data] !== undefined
        ).map((name) => ({ ratingName: name, ratingValue: data[name as keyof typeof data] as number }));
        const overall = data.overall ?? Math.round(
          ratingEntries.reduce((sum, r) => sum + r.ratingValue, 0) / Math.max(1, ratingEntries.length)
        );

        const player = await prisma.player.create({
          data: {
            teamId: team.id,
            firstName: data.firstName,
            lastName: data.lastName,
            jerseyNumber: data.jerseyNumber,
            position: data.position,
            height: data.height ?? 72,
            weight: data.weight ?? 210,
            classYear: data.classYear || "Rookie",
            hometown: data.hometown || "Unknown",
            archetype: data.archetype || "Standard",
            overall,
            ratings: { create: ratingEntries },
          },
        });

        ratedPlayers.push({ id: player.id, firstName: player.firstName, lastName: player.lastName, position: player.position, overall: player.overall });
        const list = byPosition.get(player.position) ?? [];
        list.push({ id: player.id, overall: player.overall });
        byPosition.set(player.position, list);
      }

      for (const [position, players] of byPosition.entries()) {
        const sorted = [...players].sort((a, b) => b.overall - a.overall);
        await prisma.depthChart.create({
          data: {
            teamId: team.id,
            position,
            starterPlayerId: sorted[0]?.id,
            backup1PlayerId: sorted[1]?.id,
            backup2PlayerId: sorted[2]?.id,
          },
        });
      }

      const teamRatings = calculateTeamRatings(ratedPlayers);
      await prisma.team.update({
        where: { id: team.id },
        data: {
          overallRating: teamRatings.overallRating,
          offenseRating: teamRatings.offenseRating,
          defenseRating: teamRatings.defenseRating,
          specialTeamsRating: teamRatings.specialTeamsRating,
        },
      });

      createdTeamIds.push(team.id);
    }

    await prisma.rosterImport.update({ where: { id: rosterImportId }, data: { status: "IMPORTED" } });
    await prisma.auditEvent.create({
      data: {
        eventType: "ROSTER_IMPORTED",
        resourceType: "RosterImport",
        resourceId: rosterImportId,
        message: `Imported ${result.validRows.length} players across ${createdTeamIds.length} team(s).`,
      },
    });

    return NextResponse.json({ teamIds: createdTeamIds });
  }

  // mode === "validate"
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const parsed = await parseRosterFile(file);
  const result = validateRosterRows(parsed.rows);
  const rosterImport = await persistValidationRun(league.id, file.name, parsed.rows.length, result, parsed.rows);

  return NextResponse.json({
    rosterImportId: rosterImport.id,
    rowCount: parsed.rows.length,
    validRowCount: result.validRows.length,
    errorCount: result.errorCount,
    warningCount: result.warningCount,
    issues: result.issues,
    teamSummaries: result.teamSummaries,
    validRows: result.validRows,
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const league = await getOrCreateUserLeague(userId);

  const imports = await prisma.rosterImport.findMany({
    where: { leagueId: league.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return NextResponse.json({ imports });
}
