import type { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { PublicHeader } from "./PublicHeader";

export async function AppShell({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex min-h-screen flex-col">
        <PublicHeader />
        <main className="field-texture flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <footer className="border-t border-border-line px-4 py-4 text-center text-xs text-text-faint md:px-8">
          Gridiron Franchise is an original fictional simulation. No real leagues, teams, or players are depicted.
        </footer>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div className="flex min-h-screen flex-1 flex-col">
        <Navbar />
        <main className="field-texture flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
        <footer className="border-t border-border-line px-4 py-4 text-center text-xs text-text-faint md:px-8">
          Gridiron Franchise is an original fictional simulation. No real leagues, teams, or players are depicted.
        </footer>
      </div>
    </div>
  );
}
