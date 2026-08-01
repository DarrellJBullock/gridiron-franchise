import Link from "next/link";
import { LinkButton } from "./Button";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-line bg-bg-elevated/95 px-4 py-3 backdrop-blur md:px-8">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-black">
          GF
        </span>
        <span className="text-sm font-bold text-text-primary">Gridiron Franchise</span>
      </Link>
      <nav className="flex items-center gap-2">
        <Link href="/about" className="hidden px-3 py-2 text-sm text-text-muted hover:text-text-primary sm:block">
          About
        </Link>
        <LinkButton href="/sign-in" variant="ghost" size="sm">
          Sign In
        </LinkButton>
        <LinkButton href="/sign-up" size="sm">
          Start My Franchise
        </LinkButton>
      </nav>
    </header>
  );
}
