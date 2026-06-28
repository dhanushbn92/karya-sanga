import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Accept either the new `sb_publishable_*` key (late-2025 Supabase rollout)
// or the legacy anon JWT — they're equivalent for the SSR client.
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Setting cookies in a Server Component is unsupported; the
            // proxy will refresh the session on the next request instead.
          }
        },
      },
    },
  );
}
