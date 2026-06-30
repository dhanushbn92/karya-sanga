# Database migrations

The schema is managed manually: the database structure is reproducible from the
files here, and `lib/db/schema.ts` (+ `lib/db/relations.ts`) is kept in sync so
the Drizzle client matches the database.

## What's stored here

| File | What it is |
|------|------------|
| `0000_baseline.sql` | **Full schema snapshot** — every table, enum, index, and foreign key. Auto-generated from `lib/db/schema.ts` (`npx drizzle-kit export`). Run this **alone** to provision a fresh database. |
| `0001_*.sql`, `0002_*.sql`, … | **Incremental changes** applied on top of an earlier schema. Run these in order on an existing database. |

So:
- **Fresh database** → run `0000_baseline.sql` only (it already contains everything).
- **Existing database** → apply each new numbered migration as it lands.

The current production DB is already at the latest state, so nothing here needs
re-running on it — these files are the *record* and the way to stand up a new
environment.

## History note

Before the Drizzle migration the schema lived in Prisma (`prisma/migrations/*.sql`
+ `prisma/SCHEMA_BASELINE.sql`). Those were removed when Prisma was dropped
(commit `e664211`) and remain in git history. `0000_baseline.sql` here supersedes
them as the canonical full-schema SQL.

## Change log

| # | File | Applied | Summary |
|---|------|---------|---------|
| 0000 | `0000_baseline.sql` | n/a (snapshot) | Full schema baseline (regenerate with `npx drizzle-kit export`). |
| 0001 | `0001_workshop-feedback-and-multi-badges.sql` | ☑ | Allow a badge to be earned multiple times + tie awards to a workshop (`EarnedBadge.cohortId`); add `WorkshopFeedback` (per-user workshop rating + comment). |
| 0002 | `0002_workshop-owner.sql` | ☐ | Add `Cohort.ownerId` — a workshop owner with scoped management control. |

## Workflow for a new schema change

1. Edit `lib/db/schema.ts` (+ `relations.ts`).
2. Write a new `NNNN_short-name.sql` with the incremental DDL, add a row above.
3. Run it in the Supabase SQL editor.
4. Regenerate the baseline so a fresh DB stays current:
   `npx drizzle-kit export 2>/dev/null > migrations/0000_baseline.sql`
   (re-add the header comment).
