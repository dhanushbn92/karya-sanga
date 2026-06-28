import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Bring our own env loading (matches prisma.config.ts): `.env.local` first.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  dialect: "postgresql",
  // Introspection (drizzle-kit pull) writes schema.ts + relations.ts here.
  out: "./lib/db",
  schema: "./lib/db/schema.ts",
  dbCredentials: {
    // Use the direct (non-pooled) connection for introspection / migrations.
    url: process.env.DIRECT_URL!,
  },
  // Limit introspection to the application schema.
  schemaFilter: ["public"],
});
