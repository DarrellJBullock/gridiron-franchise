"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

const NAV_SECTIONS: { label: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Home", icon: "🏠" },
      { href: "/league", label: "League", icon: "🏟️" },
    ],
  },
  {
    label: "Football Ops",
    items: [
      { href: "/teams", label: "Teams", icon: "🛡️" },
      { href: "/players", label: "Players", icon: "🧢" },
      { href: "/depth-chart", label: "Depth Charts", icon: "📋" },
    ],
  },
  {
    label: "Rosters",
    items: [{ href: "/roster-upload", label: "Roster Upload", icon: "📤" }],
  },
  {
    label: "Gameday",
    items: [
      { href: "/matchup", label: "Matchup", icon: "⚔️" },
      { href: "/season", label: "Season", icon: "📅" },
      { href: "/standings", label: "Standings", icon: "📊" },
      { href: "/stats", label: "Stat Leaders", icon: "🏆" },
      { href: "/hall-of-fame", label: "Hall of Fame", icon: "🏛️" },
    ],
  },
  {
    label: "Info",
    items: [
      { href: "/about", label: "About", icon: "ℹ️" },
      { href: "/settings", label: "Settings", icon: "⚙️" },
    ],
  },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useUser();

  return (
    <nav className="flex h-full w-64 flex-col border-r border-border-line bg-bg-elevated py-6">
      <div className="flex flex-col gap-6 overflow-y-auto scrollbar-thin px-4">
        <Link href="/" className="flex items-center gap-2 px-2" onClick={onNavigate}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-lg font-black text-black">
            GF
          </span>
          <div>
            <p className="text-sm font-bold leading-tight text-text-primary">Gridiron Franchise</p>
            <p className="text-[10px] uppercase tracking-widest text-text-faint">Operations Center</p>
          </div>
        </Link>

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-text-faint">
              {section.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-accent/10 text-accent"
                        : "text-text-muted hover:bg-surface-hover hover:text-text-primary"
                    )}
                  >
                    <span className="text-base">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-border-line px-4 pt-4">
        <UserButton />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-text-primary">
            {user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "My Franchise"}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-text-faint">Owner</p>
        </div>
      </div>
    </nav>
  );
}
