// Apply prisma/triggers.sql + a one-off auto-promote rule.
// Uses DIRECT_URL because triggers are DDL — pgbouncer doesn't always play
// nicely with multi-statement scripts.
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import pg from "pg";

loadEnv({ path: ".env.local" });

const PROMOTE_EMAIL = process.argv[2] ?? "";

const triggerSql = readFileSync("prisma/triggers.sql", "utf8");

const autoPromoteSql = PROMOTE_EMAIL
  ? `
-- One-shot auto-promote: when a User with this email is inserted (which
-- happens via the on_auth_user_created trigger), set role to admin.
-- Safe to leave in place; only matches the one email.
create or replace function public.auto_promote_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = ${pgLiteral(PROMOTE_EMAIL)} then
    new.role = 'admin';
  end if;
  return new;
end;
$$;

drop trigger if exists auto_promote_admin_trigger on public."User";
create trigger auto_promote_admin_trigger
  before insert on public."User"
  for each row execute function public.auto_promote_admin();

-- And if the user already exists (signed up before this trigger), bump them.
update public."User" set role = 'admin' where email = ${pgLiteral(PROMOTE_EMAIL)};
`
  : "";

function pgLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

const client = new pg.Client({ connectionString: process.env.DIRECT_URL });

try {
  await client.connect();
  console.log("Applying auth → User sync trigger from prisma/triggers.sql...");
  await client.query(triggerSql);
  console.log("  ✔ done");

  if (autoPromoteSql) {
    console.log(
      `Installing auto-promote rule for ${PROMOTE_EMAIL} + promoting any existing row...`,
    );
    const res = await client.query(autoPromoteSql);
    console.log(`  ✔ done (existing rows updated: ${res?.rowCount ?? 0})`);
  } else {
    console.log("No promote email passed; skipping auto-promote step.");
  }
} catch (err) {
  console.error("FAIL:", err.code ?? "", err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
