import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Accept either the new `sb_publishable_*` key or the legacy anon JWT.
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/signup",
  "/reset-password",
]);
const STATIC_PREFIXES = ["/_next", "/favicon", "/api/health"];
// `/builders/:handle` is the public-profile route. It enforces visibility
// against `profilePublic` itself, so we let it through the auth middleware.
// The `/builders` listing still calls requireUser() at the page level.
const PUBLIC_PREFIXES = ["/callback", "/builders/"];

/**
 * Edge proxy that:
 *   1. Refreshes Supabase auth cookies on every authed request (the
 *      `setAll` callback inside `createServerClient` is the refresh path).
 *   2. Redirects unauthenticated users away from protected routes.
 *
 * Why we early-exit before the Supabase call:
 *   `auth.getUser()` makes a network round-trip to the Supabase Auth API.
 *   With our project in Sydney and most users in India, that's ~200ms per
 *   request. For public + static paths we don't care who the user is, so
 *   we skip the network call entirely. The cookie still refreshes naturally
 *   the next time the user hits a protected page.
 */
export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Hard pass: static assets and Next internals don't need auth.
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // For public paths, we still need to refresh the session cookie if it
  // exists — so a signed-in user landing on `/` doesn't get logged out —
  // but only if they actually have an auth cookie. If no cookie, no need
  // to talk to Supabase at all.
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token"),
    );

  if (isPublic && !hasAuthCookie) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    user = null;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
