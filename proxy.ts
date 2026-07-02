import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase session-refresh proxy (Next 16 renamed `middleware` -> `proxy`;
 * see node_modules/next/dist/docs/.../file-conventions/proxy.md).
 *
 * Why this exists: Server Components can read cookies but cannot WRITE them,
 * so when a user's access token has expired the SSR client can't persist a
 * rotated token — and if the refresh token is dead it can't clear the stale
 * cookie either. That left returning users stuck re-emitting
 * "AuthApiError: Invalid Refresh Token" on every request.
 *
 * Running `getUser()` here, where we CAN write to the response, makes Supabase
 * either rotate the tokens (writing fresh cookies) or clear a dead session —
 * so the error self-heals instead of recurring.
 *
 * Runtime note: `proxy` is Node.js-only (the `edge` runtime is not supported),
 * which is what the Cloudflare `nodejs_compat` deploy uses anyway.
 */

// Accept either the new `sb_publishable_*` key or the legacy anon JWT — they're
// equivalent for the SSR client (kept in sync with lib/supabase/server.ts).
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export async function proxy(request: NextRequest) {
  // Start with a pass-through response; the cookie adapter below re-creates it
  // whenever Supabase wants to write cookies, so refreshed tokens ride along.
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

  // Do NOT run code between createServerClient and getUser — per Supabase's SSR
  // guidance, that can desync the session and cause random logouts. getUser()
  // triggers the token refresh / cookie write (or clears a dead session).
  const { data, error } = await supabase.auth.getUser();

  // Deterministic self-heal: if the server gave a definitive auth rejection
  // (expired/revoked/invalid session — status 400/401, e.g. "Invalid Refresh
  // Token"), expire the stale Supabase auth cookies ourselves. Without this the
  // dead cookie lingers and the *browser* Supabase client keeps trying to
  // refresh it, re-logging the error on every page. We gate on `error.status`
  // so a transient network blip (no status) never logs a valid user out.
  const status = (error as { status?: number } | null)?.status;
  if (!data.user && (status === 400 || status === 401)) {
    for (const c of request.cookies.getAll()) {
      if (/^sb-.*-auth-token(\.\d+)?$/.test(c.name)) {
        response.cookies.set(c.name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every path EXCEPT:
     *  - api            (health check + any route handlers set their own cookies)
     *  - callback       (OAuth/email code exchange writes the session itself)
     *  - _next/static, _next/image  (build assets)
     *  - favicon + common image files
     */
    "/((?!api|callback|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
