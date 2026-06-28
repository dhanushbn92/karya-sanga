// Enable Row-Level Security + add WallPost / Reaction / Comment to the
// Supabase realtime publication so authenticated browser clients can
// subscribe to changes.
//
// Idempotent — safe to run multiple times.
//
// Why we need RLS for realtime:
//   Supabase Realtime's Postgres CDC only delivers rows that pass RLS for
//   the subscribing client. Without RLS, anon/authenticated clients get
//   nothing. Prisma still bypasses RLS because it connects as the `postgres`
//   superuser role — so our server code is unaffected.
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" });

const sql = `
-- ---------------------------------------------------------------------
-- Enable RLS on the three tables (idempotent)
-- ---------------------------------------------------------------------
alter table public."WallPost" enable row level security;
alter table public."Reaction" enable row level security;
alter table public."Comment"  enable row level security;

-- ---------------------------------------------------------------------
-- SELECT policies for the 'authenticated' Supabase role.
-- (INSERT / UPDATE / DELETE are intentionally NOT granted — all writes go
-- through server actions running as postgres, which bypasses RLS.)
-- ---------------------------------------------------------------------

-- WallPost: see approved posts + your own pending/rejected ones.
drop policy if exists "wallpost_select_authenticated" on public."WallPost";
create policy "wallpost_select_authenticated" on public."WallPost"
  for select to authenticated
  using (approved = true or "authorId" = auth.uid());

-- Reaction: see all reactions (any authenticated user can count claps).
-- The bigger gate is post visibility — if you can't see the post, you
-- generally won't query its reactions client-side.
drop policy if exists "reaction_select_authenticated" on public."Reaction";
create policy "reaction_select_authenticated" on public."Reaction"
  for select to authenticated
  using (true);

-- Comment: same simplification as Reaction.
drop policy if exists "comment_select_authenticated" on public."Comment";
create policy "comment_select_authenticated" on public."Comment"
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- Realtime publication: subscribe browser clients to change events.
-- The default Supabase publication is 'supabase_realtime'. We add our
-- three tables. Use a DO block so re-adds don't error.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'WallPost'
  ) then
    alter publication supabase_realtime add table public."WallPost";
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Reaction'
  ) then
    alter publication supabase_realtime add table public."Reaction";
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'Comment'
  ) then
    alter publication supabase_realtime add table public."Comment";
  end if;
end $$;
`;

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
try {
  await client.connect();
  console.log("Applying wall realtime + RLS setup...");
  await client.query(sql);
  console.log("✔ Done.");
} catch (err) {
  console.error("FAIL:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
