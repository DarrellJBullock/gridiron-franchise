"use client";

import { useState } from "react";
import Link from "next/link";
import { Sidebar } from "./Sidebar";
import { LinkButton } from "./Button";

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-line bg-bg-elevated/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-black">
            GF
          </span>
          <span className="text-sm font-bold text-text-primary">Gridiron Franchise</span>
        </Link>
        <div className="flex items-center gap-2">
          <LinkButton href="/roster-upload" size="sm" variant="secondary">
            Upload
          </LinkButton>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-border-line p-2 text-text-primary"
            aria-label="Toggle navigation"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 top-[57px] z-50 bg-background md:hidden">
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
