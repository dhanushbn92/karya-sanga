// Quick connectivity sanity check for Supabase Postgres.
// Reads both DATABASE_URL (pooled) and DIRECT_URL (migrate connection) and
// reports which actually accept a connection. Discards results immediately.
import "dotenv/config";
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: ".env.local" });

async function probe(label, url) {
  if (!url) {
    console.log(`${label}: (not set)`);
    return;
  }
  // Mask the password in any logs.
  const masked = url.replace(/:([^:@/]+)@/, ":****@");
  const client = new pg.Client({ connectionString: url });
  const start = Date.now();
  try {
    await client.connect();
    const r = await client.query("select current_user, current_database()");
    console.log(`${label}: OK (${Date.now() - start}ms) ${masked}`);
    console.log(`  current_user = ${r.rows[0].current_user}`);
  } catch (err) {
    console.log(`${label}: FAIL ${masked}`);
    console.log(`  ${err.code ?? ""} ${err.message}`);
  } finally {
    await client.end().catch(() => {});
  }
}

await probe("DATABASE_URL", process.env.DATABASE_URL);
await probe("DIRECT_URL", process.env.DIRECT_URL);
