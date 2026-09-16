import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Fail-closed: only these routes are reachable while signed out. Everything
// else (every franchise page and almost every API route) requires auth,
// including routes added later — they're protected by default rather than
// needing to be added to an allowlist.
const isPublicRoute = createRouteMatcher([
  "/",
  "/about",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/roster/template",
  // Sentry's error-reporting tunnel (next.config.ts tunnelRoute) and the
  // manual test page — client-side error/session data must reach Sentry
  // even for signed-out visitors, not get bounced to sign-in.
  "/monitoring(.*)",
  "/sentry-example-page",
  "/api/sentry-example-api",
]);

// Clerk's production instance only trusts gridironfranchise.app as its
// origin — visiting the old default *.vercel.app address (or any other
// Vercel-assigned alias) loads a page whose browser origin Clerk's backend
// correctly refuses to attribute, breaking sign-in with no useful error.
// Redirect any such request to the canonical domain before Clerk gets
// involved. Only applies to the actual production deployment, so preview
// deployments (which legitimately live on *.vercel.app) are unaffected.
const CANONICAL_PRODUCTION_HOST = "gridironfranchise.app";

export default clerkMiddleware(async (auth, req) => {
  if (process.env.VERCEL_ENV === "production" && req.nextUrl.hostname !== CANONICAL_PRODUCTION_HOST) {
    const canonicalUrl = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_PRODUCTION_HOST}`);
    return NextResponse.redirect(canonicalUrl, 308);
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Always run for Clerk's Frontend API proxy path (production instances
    // proxy Clerk's script/API through this domain at /__clerk/*, and those
    // requests end in extensions like .js that the static-file skip above
    // would otherwise exclude from ever reaching clerkMiddleware).
    "/__clerk(.*)",
    // Every browser auto-requests /favicon.ico. This app has no such file
    // (it uses icon.svg), so Next.js falls through to a full page render —
    // including the root layout's auth() call — for it. The static-file
    // skip above excludes .ico, so that render was happening with no
    // clerkMiddleware context and throwing on every single page load.
    "/favicon.ico",
  ],
};
