import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { TeamLogo } from "./TeamLogo";

export interface TeamCardData {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  state: string | null;
  primaryColor: string;
  secondaryColor: string;
  overallRating: number;
  offenseRating: number;
  defenseRating: number;
  wins?: number;
  losses?: number;
  ties?: number;
  rosterSize?: number;
}

export function TeamCard({ team }: { team: TeamCardData }) {
  const record =
    team.wins !== undefined ? `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}` : null;

  return (
    <Link href={`/teams/${team.id}`}>
      <Card
        className="group relative overflow-hidden p-5 transition-transform hover:-translate-y-0.5 hover:border-accent/50"
        style={{
          background: `linear-gradient(135deg, ${team.secondaryColor}22 0%, transparent 60%)`,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{ background: `linear-gradient(90deg, ${team.primaryColor}, ${team.secondaryColor})` }}
        />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <TeamLogo
              seed={team.id}
              primaryColor={team.primaryColor}
              secondaryColor={team.secondaryColor}
              abbreviation={team.abbreviation}
              size={44}
            />
            <div>
              <p className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                {team.name}
              </p>
              <p className="text-xs text-text-faint">
                {team.city}
                {team.state ? `, ${team.state}` : ""}
              </p>
            </div>
          </div>
          <RatingBadge value={team.overallRating} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-faint">Offense</p>
            <p className="text-lg font-bold text-accent">{team.offenseRating}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-faint">Defense</p>
            <p className="text-lg font-bold text-accent-blue">{team.defenseRating}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-faint">
              {record ? "Record" : "Roster"}
            </p>
            <p className="text-lg font-bold text-text-primary">{record ?? team.rosterSize ?? "—"}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
