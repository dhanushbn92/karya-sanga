// Prune unused Prisma query-compiler WASM before bundling the Cloudflare worker.
//
// Prisma 7 ships its WASM query compiler for ALL supported databases
// (postgresql, mysql, sqlite, sqlserver, cockroachdb), in both a "fast" and a
// size-optimized "small" build, as both .js and .mjs — ~67 MB total. This app
// is postgresql-only and uses the "small" compiler (see compilerBuild in
// prisma/schema.prisma), so every other engine/variant is dead weight that
// inflates the worker past Cloudflare's size limit.
//
// We delete every query_compiler_* artifact except the one we actually import:
//   query_compiler_small_bg.postgresql.*
//
// Run AFTER `prisma generate` and BEFORE `opennextjs-cloudflare build`, so the
// Next.js standalone trace copies only the pruned set into the worker bundle.
// Re-runs are safe (a fresh `npm ci` restores the files each build).

import { readdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const KEEP = /^query_compiler_small_bg\.postgresql\./;
const TARGET = /^query_compiler_/;

let removed = 0;
let freed = 0;

/** Recursively walk node_modules, deleting unused query-compiler artifacts. */
function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // unreadable dir — skip
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (TARGET.test(entry.name) && !KEEP.test(entry.name)) {
      try {
        freed += statSync(full).size;
        rmSync(full);
        removed++;
      } catch {
        // ignore — best effort
      }
    }
  }
}

const root = path.resolve("node_modules", "@prisma");
walk(root);

console.log(
  `prune-prisma-engines: removed ${removed} unused query-compiler files ` +
    `(${(freed / 1048576).toFixed(1)} MB freed); kept query_compiler_small_bg.postgresql.*`
);
