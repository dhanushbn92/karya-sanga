import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase rolled out new key names in late 2025: `sb_publishable_*` replaces
 * the old `anon` JWT key. The two are functionally equivalent for the SSR
 * client, so we accept either env var to support fresh projects and older
 * ones without a config change.
 */
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_PUBLIC_KEY,
  );
}
