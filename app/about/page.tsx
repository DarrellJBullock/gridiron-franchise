import { Card } from "@/components/ui/Card";

const STACK = [
  "Next.js App Router",
  "React & TypeScript",
  "Tailwind CSS v4",
  "PostgreSQL + Prisma",
  "Zod validation",
  "ExcelJS for roster templates & parsing",
  "Recharts for radar/data visualization",
];

const ROADMAP = [
  "Drag-and-drop depth chart reordering",
  "Multi-season franchise mode with player progression and retirement",
  "Trade and free agency simulation",
  "Authentication so each user manages their own franchise",
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">About</p>
        <h1 className="text-2xl font-black text-text-primary">About Gridiron Franchise</h1>
      </div>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Project Purpose</h2>
        <p className="text-sm text-text-muted">
          Gridiron Franchise is a portfolio project that demonstrates a full-stack, franchise-style
          football simulation platform. It combines a real data model, a working file-upload and
          validation pipeline, a probabilistic simulation engine, and a polished sports-broadcast style
          dashboard UI — built entirely with an original, fictional league so it can be shared publicly
          without touching any real-world sports IP.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Tech Stack</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm text-text-primary sm:grid-cols-3">
          {STACK.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-accent">▸</span> {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Roster Upload Explanation</h2>
        <p className="text-sm text-text-muted">
          Users download an Excel (or CSV) template pre-built with every column the simulator needs — team
          info plus 0-100 ratings for every position group. On upload, the file is parsed with ExcelJS,
          validated row-by-row with Zod (range checks, required fields, position enums, jersey numbers),
          and checked team-by-team for roster composition warnings (missing QB/kicker, thin offensive
          line, thin secondary). Users see a full error/warning report and a preview table before anything
          is written to the database.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Simulation Engine Explanation</h2>
        <p className="text-sm text-text-muted">
          The engine in <code className="rounded bg-surface-hover px-1">lib/simulation/game-engine.ts</code>{" "}
          is a statistical, drive-based simulator — not a physics engine. Each team&apos;s offense, defense,
          and special teams ratings are derived from its roster (
          <code className="rounded bg-surface-hover px-1">lib/simulation/team-ratings.ts</code>), then every
          simulated drive resolves probabilistically from the rating differential between the offense and
          the opposing defense, with home-field advantage, turnover chance, big-play chance, red-zone
          efficiency, and controlled randomness all factored in. Player-level stats are then attributed to
          the top players at each relevant position.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Portfolio Value</h2>
        <p className="text-sm text-text-muted">
          This project showcases relational data modeling, file parsing and validation pipelines, a
          non-trivial rules-based simulation algorithm, REST API design, and a cohesive, dark-mode sports
          dashboard UI — all without relying on a simple CRUD scaffold.
        </p>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 text-lg font-bold text-text-primary">Future Roadmap</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-text-primary">
          {ROADMAP.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-accent">▸</span> {item}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="border-warning/30 p-6">
        <h2 className="mb-2 text-lg font-bold text-warning">Legal Note</h2>
        <p className="text-sm text-text-muted">
          Gridiron Franchise is an entirely original, fictional football simulation. It does not use or
          reference Madden, EA Sports, the NFL, NCAA, any real team, player, school, or logo. All teams,
          players, leagues, and branding shown in this app are invented for demonstration purposes only.
        </p>
      </Card>
    </div>
  );
}
