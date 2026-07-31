# Gridiron Franchise, Claude Code Instructions

## Project

Project name:
gridiron-franchise

Build a complete football franchise simulation game with custom Excel roster uploads, 0-100 player ratings, team management, depth charts, game simulation, season tracking, standings, stats, and polished React dashboards.

Portfolio angle:
Built a football franchise simulation platform with custom roster uploads, Excel template validation, 0-100 player skill ratings, team management, depth charts, game simulation, season tracking, and polished React dashboards.

## Legal and branding rules

Do not use Madden, EA Sports, NFL, NCAA, real NFL team names, real NFL logos, real NFL players, real college teams, real school logos, or copyrighted assets.

Use fictional:
- teams
- players
- leagues
- logos
- uniforms
- stadiums
- conferences

This is an original football simulation game.

## Default Claude behavior

Do not ask clarifying questions unless blocked.
Make reasonable assumptions, document them, and continue building.
Batch any required questions into one list before coding.
Do not stop after planning.
Create the plan, then implement it.
Build a working MVP first, then polish.
Prefer progress over waiting for small decisions.
Use placeholders where details are missing.
Document placeholders clearly in README and source comments.

## Core stack

Use:
- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Zod
- xlsx or ExcelJS
- Recharts
- Zustand or React state
- Vercel-ready deployment notes

## Game expectations

This should feel like a football operations command center.

Build:
- league dashboard
- team dashboard
- roster upload workflow
- roster template download
- player ratings
- player cards
- team depth charts
- team ratings
- matchup preview
- game simulator
- game recap
- season simulator
- standings
- stats leaders
- franchise home page

Do not build only a CRUD app.

## Player rating system

All skill ratings must be 0-100.

Core player fields:
- firstName
- lastName
- jerseyNumber
- position
- height
- weight
- classYear or experience
- hometown
- archetype
- overall
- speed
- acceleration
- strength
- agility
- awareness
- stamina
- injury
- toughness

Quarterback ratings:
- throwPower
- shortAccuracy
- mediumAccuracy
- deepAccuracy
- throwOnRun
- playAction
- pocketPresence

Running back ratings:
- carrying
- ballCarrierVision
- trucking
- elusiveness
- spinMove
- jukeMove
- breakTackle

Receiver and tight end ratings:
- catching
- routeRunning
- release
- spectacularCatch
- catchInTraffic

Offensive line ratings:
- passBlock
- runBlock
- impactBlock
- footwork
- handTechnique

Defensive line ratings:
- blockShed
- powerMove
- finesseMove
- pursuit

Linebacker ratings:
- tackling
- pursuit
- blockShed
- zoneCoverage
- hitPower

Defensive back ratings:
- manCoverage
- zoneCoverage
- press
- playRecognition
- catching

Kicker and punter ratings:
- kickPower
- kickAccuracy

## Excel roster upload

Create a downloadable Excel template.

Template file:
public/templates/roster-template.xlsx

Also create a CSV fallback template:
public/templates/roster-template.csv

The Excel template should include columns:

teamName
teamAbbreviation
teamCity
teamState
teamPrimaryColor
teamSecondaryColor
firstName
lastName
jerseyNumber
position
height
weight
classYear
hometown
archetype
overall
speed
acceleration
strength
agility
awareness
stamina
injury
toughness
throwPower
shortAccuracy
mediumAccuracy
deepAccuracy
throwOnRun
playAction
pocketPresence
carrying
ballCarrierVision
trucking
elusiveness
spinMove
jukeMove
breakTackle
catching
routeRunning
release
spectacularCatch
catchInTraffic
passBlock
runBlock
impactBlock
footwork
handTechnique
blockShed
powerMove
finesseMove
pursuit
tackling
zoneCoverage
manCoverage
press
playRecognition
hitPower
kickPower
kickAccuracy

Validation rules:
- required teamName
- required teamAbbreviation
- required firstName
- required lastName
- required jerseyNumber
- required position
- all ratings must be numbers from 0 to 100
- jerseyNumber must be 0 to 99
- position must be one of QB, RB, FB, WR, TE, LT, LG, C, RG, RT, LE, RE, DT, LOLB, MLB, ROLB, CB, FS, SS, K, P
- teamAbbreviation should be 2 to 4 uppercase letters
- each team should have at least 22 players
- warn if team has no QB
- warn if team has no kicker
- warn if team has fewer than 5 offensive linemen
- warn if team has fewer than 4 defensive backs

Upload workflow:
1. Download template
2. Upload completed Excel file
3. Parse file
4. Validate file
5. Show validation errors and warnings
6. Preview roster
7. Confirm import
8. Create team and players
9. Show team dashboard

## Data model

Use Prisma.

Models:
- League
- Team
- Player
- PlayerRating
- DepthChart
- Game
- GameTeamStats
- GamePlayerStats
- Season
- SeasonTeam
- Standing
- RosterImport
- RosterImportRow
- RosterValidationIssue
- AuditEvent

League:
id
name
description
createdAt
updatedAt

Team:
id
leagueId
name
abbreviation
city
state
primaryColor
secondaryColor
logoPlaceholder
offenseRating
defenseRating
overallRating
createdAt
updatedAt

Player:
id
teamId
firstName
lastName
jerseyNumber
position
height
weight
classYear
hometown
archetype
overall
createdAt
updatedAt

PlayerRating:
id
playerId
ratingName
ratingValue

DepthChart:
id
teamId
position
starterPlayerId
backup1PlayerId
backup2PlayerId

Game:
id
seasonId
homeTeamId
awayTeamId
homeScore
awayScore
status
week
gameDate
summary
createdAt
updatedAt

GameTeamStats:
id
gameId
teamId
totalYards
passingYards
rushingYards
turnovers
firstDowns
thirdDownConversions
timeOfPossession

GamePlayerStats:
id
gameId
playerId
passingYards
passingTouchdowns
interceptions
rushingYards
rushingTouchdowns
receivingYards
receivingTouchdowns
tackles
sacks
forcedFumbles
fieldGoalsMade

RosterImport:
id
fileName
status
rowCount
validRowCount
errorCount
warningCount
createdAt

RosterValidationIssue:
id
rosterImportId
rowNumber
severity
fieldName
message

AuditEvent:
id
eventType
resourceType
resourceId
message
createdAt

## Game simulation

Create a simple but believable football simulation engine.

File:
lib/simulation/game-engine.ts

Simulation should consider:
team overall
QB rating
offensive line rating
receiver ratings
running back ratings
defensive line rating
linebacker ratings
defensive back ratings
home field advantage
turnover chance
big play chance
red zone efficiency
special teams
randomness

Game result should include:
final score
quarter scores
team stats
key player stats
game summary
top performers
turning point
play style summary

Do not attempt real physics.
This is a franchise simulation engine.

## Team rating formulas

Create:
lib/simulation/team-ratings.ts

Calculate:
overallRating
offenseRating
defenseRating
specialTeamsRating

Offense should weigh:
QB
RB
WR
TE
OL

Defense should weigh:
DL
LB
CB
S

Special teams should weigh:
K
P

## App routes

Create:

/
 /league
 /teams
 /teams/[id]
 /players
 /players/[id]
 /roster-upload
 /depth-chart
 /matchup
 /game/[id]
 /season
 /standings
 /stats
 /about

Home page:
Show:
project title
portfolio summary
quick actions
recent teams
simulation snapshot
roster upload CTA
fictional branding notice

League page:
Show:
league overview
teams
standings preview
season controls

Teams page:
Show:
team cards
overall ratings
offense ratings
defense ratings
record
roster size

Team detail page:
Show:
team profile
ratings summary
roster
depth chart
top players
team strengths
team weaknesses

Players page:
Show:
searchable player table
position filters
rating filters
team filters

Player detail page:
Show:
player card
ratings radar chart
position-specific ratings
team info
archetype
overall

Roster Upload page:
Show:
download Excel template
download CSV template
upload Excel file
validation results
preview table
confirm import
recent imports

Depth Chart page:
Show:
position groups
starters
backups
drag-and-drop if practical
simple select dropdown fallback if drag-and-drop is too much

Matchup page:
Show:
select home team
select away team
team comparison
key advantages
simulate game button

Game page:
Show:
final score
quarter breakdown
team stats
player stats
game summary
top performers

Season page:
Show:
create season
generate schedule
simulate week
simulate full season
season progress

Standings page:
Show:
team records
points for
points against
streak
division or conference placeholder

Stats page:
Show:
passing leaders
rushing leaders
receiving leaders
defensive leaders
kicking leaders

About page:
Show:
project purpose
tech stack
roster upload explanation
simulation engine explanation
portfolio value
future roadmap
legal note about fictional teams and players

## UI design

Build a polished sports franchise command center.

Visual style:
- dark mode
- premium sports broadcast feel
- team color accents
- clean cards
- scoreboard UI
- player rating bars
- depth chart panels
- field/playbook-inspired backgrounds
- responsive mobile-first layout
- accessible contrast

Do not make it generic.

## Components

components/ui:
- AppShell
- Sidebar
- Navbar
- Card
- MetricCard
- Button
- Badge
- Table
- EmptyState
- Skeleton
- RatingBar
- RatingBadge

components/football:
- Scoreboard
- TeamCard
- PlayerCard
- PlayerRatingGrid
- PositionBadge
- DepthChartPanel
- MatchupComparison
- GameRecap
- StatLeaderTable
- StandingsTable

components/roster:
- RosterTemplateDownload
- RosterUploadDropzone
- RosterValidationSummary
- RosterPreviewTable
- ImportHistoryTable

components/simulation:
- SimulationControls
- TeamAdvantagePanel
- GameSummaryCard
- TopPerformers

## Seed data

Create fictional teams:
- Delaware Storm
- Jersey Iron
- Atlanta Firebirds
- Orlando Rockets
- Chicago Frost
- Seattle Voltage
- Houston Copperheads
- Philadelphia Founders

Create fictional players for each team.
Generate enough players per team for a playable roster.
Each player should have realistic position-specific ratings from 0-100.
No real player names.

## API routes

Create API routes for:

GET /api/teams
GET /api/teams/[id]
GET /api/players
GET /api/players/[id]
POST /api/roster/upload
GET /api/roster/template
POST /api/games/simulate
GET /api/games/[id]
POST /api/season/create
POST /api/season/simulate-week
POST /api/season/simulate-full
GET /api/standings
GET /api/stats/leaders

## Files and folders

Create:

app/
components/
lib/
lib/simulation/
lib/roster/
lib/validation/
prisma/
public/templates/
public/logos/
types/
data/
scripts/

Important files:
lib/roster/template.ts
lib/roster/parser.ts
lib/roster/validator.ts
lib/simulation/game-engine.ts
lib/simulation/team-ratings.ts
lib/simulation/player-stats.ts
lib/validation/player-ratings.ts
types/football.ts
prisma/schema.prisma
prisma/seed.ts

## Environment

Create .env.example with:

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/gridiron_franchise
NEXT_PUBLIC_APP_URL=http://localhost:3000

Do not create or commit a real .env file.

## Git behavior

Set up Git after the first successful scaffold build.

Repo name:
gridiron-franchise

## Build order

Step 1:
Create .claude/settings.json exactly as specified above.

Step 2:
Create CLAUDE.md exactly as specified above.

Step 3:
Create Next.js app with TypeScript and Tailwind.

Step 4:
Add Prisma and PostgreSQL setup.

Step 5:
Create data model and seed data.

Step 6:
Create roster Excel template and CSV fallback template.

Step 7:
Create roster parser and validator.

Step 8:
Create app shell, layout, and routes.

Step 9:
Create team, player, roster upload, matchup, game, season, standings, and stats pages.

Step 10:
Create simulation engine.

Step 11:
Connect UI to data and API routes.

Step 12:
Create README.md, .gitignore, .env.example, GitHub Actions, issue templates, and PR template.

Step 13:
Confirm:
npm run lint
npm run build

Step 14:
Initialize Git.

Commands:
git init
git add .
git commit -m "Initial gridiron franchise scaffold"

Step 15:
If GitHub CLI is available and authenticated, create and push repo:

gh repo create gridiron-franchise --public --source=. --remote=origin --push

If GitHub CLI is unavailable, print manual commands:

git remote add origin git@github.com:YOUR_USERNAME/gridiron-franchise.git
git branch -M main
git push -u origin main

## README requirements

Create a professional portfolio-ready README.

Include:
- Project title
- Portfolio angle
- Problem statement
- Tech stack
- Features
- Roster upload workflow
- Excel template columns
- Player rating system
- Simulation engine explanation
- Data model
- App routes
- Local setup
- How to seed data
- How to upload a roster
- Screenshots placeholder
- Legal note about fictional teams and players
- Resume bullet
- Future roadmap

Use this exact resume bullet:

Built a football franchise simulation platform using Next.js, React, TypeScript, PostgreSQL, Prisma, Excel roster uploads, 0-100 player skill ratings, team depth charts, game simulation logic, season standings, stat leaders, and polished sports dashboard UI.

## Acceptance criteria

.claude/settings.json exists.
CLAUDE.md exists.
Next.js app exists.
Prisma schema exists.
Seed data exists.
Roster Excel template exists.
CSV fallback template exists.
Roster upload page exists.
Roster validator catches invalid ratings.
Players have 0-100 skill ratings.
Users can preview uploaded rosters.
Users can import valid rosters.
Teams have rating summaries.
Player cards exist.
Depth charts exist.
Game simulation works.
Game recap page exists.
Season and standings pages exist.
Stats leaders page exists.
README explains the project well.
No real NFL, Madden, EA, NCAA, or copyrighted assets are used.
No secrets are committed.
The app builds successfully.
The UI is responsive and professional.

## Final QA

Review the project as:
- Senior Full-Stack Engineer
- Game Systems Designer
- Sports Simulation Designer
- React Frontend Engineer
- Data Modeling Reviewer
- Recruiter
- Accessibility Reviewer

Check:
- roster upload flow
- Excel validation
- player rating logic
- simulation engine clarity
- data model quality
- dashboard design
- mobile layout
- README strength
- no copyrighted assets
- no exposed secrets
- broken imports
- build errors

Fix issues found.

Run:
npm run lint
npm run build

## Final summary

After building, summarize:
- What was created
- How to run it
- How to download the roster template
- How roster uploads work
- How player ratings work
- How game simulation works
- Where the simulation engine lives
- Where roster validation lives
- What to demo first
- What should be improved next
