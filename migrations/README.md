# Database migrations

Schema is managed manually: apply each numbered `.sql` file **in order** in the
Supabase SQL editor, then keep `lib/db/schema.ts` (+ `lib/db/relations.ts`) in
sync so the Drizzle client matches the database.

- **Baseline:** the schema as introspected into `lib/db/schema.ts` at the time
  Drizzle replaced Prisma. Migrations below are changes applied *since* then.
- Each file is idempotent where practical (`IF NOT EXISTS` / `IF EXISTS`) so a
  re-run is safe.
- After applying, the running app picks up the change immediately (no deploy
  needed for data-only schema changes; redeploy if app code also changed).

| # | File | Applied | Summary |
|---|------|---------|---------|
| 0001 | `0001_workshop-feedback-and-multi-badges.sql` | ☐ | Allow a badge to be earned multiple times + tie awards to a workshop (`EarnedBadge.cohortId`); add `WorkshopFeedback` (per-user workshop rating + comment). |

> Tick the **Applied** box (and optionally add a date) once you've run a file in Supabase.
