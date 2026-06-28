import { NextResponse } from "next/server";

/**
 * Cheap liveness endpoint. Skipped by the proxy (no auth checks, no DB
 * hits) — useful for measuring pure server-side response time without the
 * Supabase/Prisma layer.
 *
 *   curl -w "@-" -s -o /dev/null http://localhost:3000/api/health <<'EOF'
 *   time_total: %{time_total}\n
 *   EOF
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
