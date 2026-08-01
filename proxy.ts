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
]);

export default clerkMiddleware(async (auth, req) => {
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
  ],
};
