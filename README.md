# Gridiron Franchise

A polished, original football franchise simulation platform: upload custom Excel rosters, rate every
player from 0-100 across position-specific skills, build depth charts, preview matchups, and simulate
full seasons with a franchise-style game engine.

**All teams, players, and branding are entirely fictional.** No real NFL, NCAA, Madden, EA Sports, or
other copyrighted names, logos, or players are used anywhere in this project.

## Portfolio Angle

Built a football franchise simulation platform with custom roster uploads, Excel template validation,
0-100 player skill ratings, team management, depth charts, game simulation, season tracking, and
polished React dashboards.

## Problem Statement

Fantasy and franchise sports games are usually either shallow CRUD apps (add a player, list some stats)
or closed commercial products you can't build a portfolio around. Gridiron Franchise demonstrates what a
real football operations product looks like end-to-end: a real relational data model, a file-upload and
validation pipeline that mirrors how production import tools work, a rules-based simulation engine, and a
cohesive sports-broadcast-style dashboard UI — all original IP so it's safe to publish and demo publicly.

## Tech Stack

- **Next.js App Router** + **React 19** + **TypeScript**
- **Tailwind CSS v4** for a dark, sports-broadcast-inspired design system
- **PostgreSQL** + **Prisma ORM** for the relational data model
- **Zod** for schema validation (0-100 rating ranges, position enums, jersey numbers, etc.)
- **ExcelJS** for generating and parsing the roster upload template
- **Recharts** for the player ratings radar chart
- Vercel-ready deployment configuration

## Features

- League, team, and player management backed by a real relational schema
- Downloadable Excel and CSV roster templates with sample rows and an instructions tab
- Full roster upload pipeline: parse → validate → preview → confirm → import
- Row-level and team-level validation (missing QB/kicker, thin O-line, thin secondary, duplicate jerseys, out-of-range ratings)
- Every player rated 0-100 across ~20-25 core + position-specific skills
- Player cards with a radar chart and grouped rating bars
- Drag-and-drop depth charts per position (with up/down buttons as a keyboard/mobile-friendly fallback)
- Matchup preview with team comparison bars and a simulated win probability
- A drive-based statistical game simulation engine (not physics) with quarter-by-quarter scoring, team stats, player stat lines, a full play-by-play log, a summary, turning point, and top performers
- Full season creation with a round-robin schedule, week-by-week or full-season simulation, and live standings
- Optional 4-team single-elimination playoff bracket, seeded by regular-season record
- Multi-season franchise mode: advance to the next year and every player ages, ratings drift up or down based on age, some retire, and rookies are drafted in to backfill — with a franchise history view showing each season's champion
- League-wide stat leaderboards: passing, rushing, receiving, rushing/receiving touchdowns, points, defensive impact, sacks, interceptions, and kicking
- Procedurally generated team logos and player jerseys — deterministic SVGs built from each team's own colors, no external images or generation services
- Dark, responsive, mobile-first "football operations command center" UI

This is intentionally **not** a basic CRUD app — the roster validator, rating system, and simulation
engine are all real, non-trivial pieces of logic.

## Roster Upload Workflow

1. Download the Excel (`.xlsx`) or CSV template from the Roster Upload page
2. Fill in team info and player rows — one row per player, repeating team info per row
3. Upload the file (drag-and-drop or browse)
4. The server parses it with ExcelJS/CSV parsing and validates every row with Zod
5. Errors (must fix) and warnings (informational) are shown, along with a per-team summary
6. A preview table shows every valid player before anything is written to the database
7. Confirm import — teams and players (with full rating sets and a starter depth chart) are created
8. You're taken to the new team's dashboard

### Excel Template Columns

```
teamName, teamAbbreviation, teamCity, teamState, teamPrimaryColor, teamSecondaryColor,
firstName, lastName, jerseyNumber, position, height, weight, classYear, hometown, archetype,
overall, speed, acceleration, strength, agility, awareness, stamina, injury, toughness,
throwPower, shortAccuracy, mediumAccuracy, deepAccuracy, throwOnRun, playAction, pocketPresence,
carrying, ballCarrierVision, trucking, elusiveness, spinMove, jukeMove, breakTackle,
catching, routeRunning, release, spectacularCatch, catchInTraffic,
passBlock, runBlock, impactBlock, footwork, handTechnique,
blockShed, powerMove, finesseMove, pursuit,
tackling, zoneCoverage, manCoverage, press, playRecognition, hitPower,
kickPower, kickAccuracy
```

### Validation Rules

- `teamName`, `teamAbbreviation`, `firstName`, `lastName`, `jerseyNumber`, `position` are required
- All rating columns must be whole numbers from 0 to 100
- `jerseyNumber` must be 0-99 and unique within a team
- `position` must be one of `QB, RB, FB, WR, TE, LT, LG, C, RG, RT, LE, RE, DT, LOLB, MLB, ROLB, CB, FS, SS, K, P`
- `teamAbbreviation` must be 2-4 uppercase letters
- **Warnings** (import still allowed): fewer than 22 players on a team, no QB, no kicker, fewer than 5 offensive linemen, fewer than 4 defensive backs

## Player Rating System

Every player has a core rating set (speed, acceleration, strength, agility, awareness, stamina, injury,
toughness, overall) plus a position-specific set, all on a 0-100 scale:

| Group | Ratings |
|---|---|
| QB | throwPower, shortAccuracy, mediumAccuracy, deepAccuracy, throwOnRun, playAction, pocketPresence |
| RB/FB | carrying, ballCarrierVision, trucking, elusiveness, spinMove, jukeMove, breakTackle |
| WR/TE | catching, routeRunning, release, spectacularCatch, catchInTraffic |
| OL (LT/LG/C/RG/RT) | passBlock, runBlock, impactBlock, footwork, handTechnique |
| DL (LE/RE/DT) | blockShed, powerMove, finesseMove, pursuit |
| LB (LOLB/MLB/ROLB) | tackling, pursuit, blockShed, zoneCoverage, hitPower |
| DB (CB/FS/SS) | manCoverage, zoneCoverage, press, playRecognition, catching |
| K/P | kickPower, kickAccuracy |

## Simulation Engine Explanation

`lib/simulation/team-ratings.ts` derives four team ratings — **overall**, **offense**, **defense**, and
**special teams** — by weighting the top players at each relevant position group (QB, RB, WR/TE, and OL
for offense; DL, LB, CB, and S for defense; K and P for special teams).

`lib/simulation/game-engine.ts` is a **statistical, drive-based simulation**, not a physics engine. Each
simulated game runs a fixed number of possessions per quarter. Every drive resolves probabilistically
from the rating differential between the offense and the opposing defense, factoring in:

- Home field advantage (a rating bonus for the home team)
- Turnover chance (higher when the defense outrates the offense)
- Big-play chance and red-zone efficiency
- Run/pass play distribution based on RB vs. WR/TE ratings
- Special teams (field goal chance based on kicker rating)
- Controlled randomness so results vary between simulations of the same matchup

The result includes a final score, quarter-by-quarter scoring, team stat lines, individual player stat
lines (attributed to the top players at each position), a text summary, a turning point, a play-style
summary, and the top performers of the game.

## Multi-Season Franchise Mode

`lib/simulation/franchise-progression.ts` runs the off-season once a season's status is `COMPLETED` and
you click **Advance to Next Season** on the Season page. For every active player on every team:

- Age and years of experience increase by one
- Every rating drifts based on an age curve — players 23 and under trend up, ages 24-27 hold roughly
  steady, and ratings decline gradually from 28 on, steeply past 34
- A retirement roll factors in age (rising sharply after 30, guaranteed at 41) and a low-overall penalty
  for players declining below replacement level
- Retired players are marked `retired` (never deleted, so their career stats and game history stay intact)
  and are immediately backfilled with a rookie at the same position, generated with the same procedural
  logic used to seed the league (`lib/simulation/player-generator.ts`)
- Each team's depth chart is rebuilt from the refreshed active roster, and team ratings are recalculated

A new season is then created with a fresh round-robin schedule and reset standings. The Season page shows
a summary of notable retirements and rookies after each advance, plus a **Franchise History** list of
every past season's champion.

### Playoffs (optional)

Once a season is `COMPLETED`, **Run Playoffs** (`lib/simulation/playoffs.ts`) seeds the top 4 teams by
regular-season record into a single-elimination bracket — 1 vs. 4 and 2 vs. 3 in the semifinals, then a
championship game, with the higher remaining seed hosting each round. Playoff games are simulated with
the same engine as every other game (full play-by-play, box score, recap page) but never affect regular-
season standings. Running the playoffs is entirely optional: skip it and the season's "champion" in
Franchise History falls back to the best regular-season record; run it and the bracket winner takes over
that title instead.

## Data Model

Prisma models: `League`, `Team`, `Player`, `PlayerRating`, `DepthChart`, `Season`, `SeasonTeam`, `Game`,
`GameTeamStats`, `GamePlayerStats`, `Standing`, `RosterImport`, `RosterImportRow`,
`RosterValidationIssue`, `AuditEvent`. See [`prisma/schema.prisma`](prisma/schema.prisma) for the full
schema.

## App Routes

`/`, `/league`, `/teams`, `/teams/[id]`, `/players`, `/players/[id]`, `/roster-upload`, `/depth-chart`,
`/matchup`, `/game/[id]`, `/season`, `/standings`, `/stats`, `/about`

### API Routes

`GET /api/teams`, `GET /api/teams/[id]`, `POST /api/teams/[id]/depth-chart`, `GET /api/players`,
`GET /api/players/[id]`, `POST /api/roster/upload`, `GET /api/roster/upload`,
`GET /api/roster/template`, `GET /api/games`, `GET /api/games/[id]`, `POST /api/games/simulate`,
`POST /api/season/create`, `GET /api/season/create`, `POST /api/season/simulate-week`,
`POST /api/season/simulate-full`, `POST /api/season/simulate-playoffs`, `GET /api/season/simulate-playoffs`,
`POST /api/season/advance`, `GET /api/season/history`, `GET /api/standings`, `GET /api/stats/leaders`

## Local Setup

### Prerequisites

- Node.js 20+
- A running PostgreSQL instance (local or hosted)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure your database

Copy the example environment file and set your own connection string:

```bash
cp .env.example .env
```

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gridiron_franchise
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Note:** `.env.example` is not committed in this workspace because the project's own
> `.claude/settings.json` permission rules deny writing any `.env*` file — a deliberate guardrail against
> ever committing secrets. Create `.env.example` (and your local `.env`) yourself using the two lines
> above.

### 3. Create the database schema

```bash
npx prisma migrate dev --name init
```

### 4. Seed fictional teams and players

```bash
npm run db:seed
```

This creates 8 fictional teams (Delaware Storm, Jersey Iron, Atlanta Firebirds, Orlando Rockets, Chicago
Frost, Seattle Voltage, Houston Copperheads, Philadelphia Founders), 45 rated players each, starter depth
charts, and a full Season 1 schedule.

### 5. Regenerate the static roster templates (optional — already committed)

```bash
npm run generate:templates
```

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to Upload a Roster

1. Go to **Roster Upload** in the sidebar
2. Download the Excel or CSV template
3. Fill in your fictional team and players (see column list above)
4. Drag the file into the upload zone
5. Review validation errors/warnings and the preview table
6. Click **Confirm Import**

## Screenshots

_Add screenshots of the home dashboard, team detail, roster upload, matchup, and game recap pages here._

## Legal Note

Gridiron Franchise is an entirely original, fictional football simulation. It does not use or reference
Madden, EA Sports, the NFL, NCAA, or any real team, player, school, or logo. All teams, players, leagues,
and branding are invented for demonstration purposes only.

## Resume Bullet

> Built a football franchise simulation platform using Next.js, React, TypeScript, PostgreSQL, Prisma,
> Excel roster uploads, 0-100 player skill ratings, team depth charts, game simulation logic, season
> standings, stat leaders, and polished sports dashboard UI.

## Future Roadmap

- Trade and free agency simulation
- Authentication so each user manages their own franchise
