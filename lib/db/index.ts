import { cache } from "react";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as relations from "./relations";

type Db = ReturnType<typeof create>;

function create() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // max:1 keeps us under the Workers 6-connection cap; a fresh pool per request
  // (see below) means parallel queries on one page still share one connection,
  // which is fine for this app's small query counts.
  const pool = new Pool({ connectionString, max: 1 });
  return drizzle(pool, { schema: { ...schema, ...relations } });
}

// Cloudflare Workers close every socket at the end of a request, so a pooled
// connection opened in one request is dead by the next — reusing a module-level
// singleton there throws on the 2nd+ request. So in production we create a
// fresh client per request (memoized within the request by React's `cache`).
// In dev (Node) connections persist fine across requests, so we keep one shared
// singleton to avoid leaking a pool on every render.
const globalForDb = globalThis as unknown as { db?: Db };
const requestDb = cache(create);

function resolve(): Db {
  return process.env.NODE_ENV === "production"
    ? requestDb()
    : (globalForDb.db ??= create());
}

// Proxy so `import { db }` keeps working unchanged across the app while each
// request transparently gets its own connection on the worker.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const instance = resolve() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
}) as Db;

// Re-export the schema tables/enums for convenient importing alongside `db`.
export * from "./schema";
