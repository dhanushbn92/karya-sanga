import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as relations from "./relations";

// Single shared pg pool + Drizzle client (mirrors the old lib/prisma.ts
// singleton). On Cloudflare Workers `pg` talks to Postgres over
// `cloudflare:sockets` via pg-cloudflare; the same connection string used by
// the former Prisma pg adapter works here unchanged.
const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString });
}

const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

// `schema` + `relations` are both passed so the relational query API
// (db.query.<table>.findMany({ with: { ... } })) works.
export const db = drizzle(pool, { schema: { ...schema, ...relations } });

// Re-export the schema tables/enums for convenient importing alongside `db`.
export * from "./schema";
