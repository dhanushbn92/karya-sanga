import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI loads this config before our app code, so we have to bring our
// own env loading. `.env.local` takes precedence (matches Next.js behavior),
// then `.env`.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

// Read DIRECT_URL directly rather than via prisma's `env()` helper: `env()`
// throws at config-load time when the var is missing, which breaks
// `prisma generate` during CI install/postinstall (where DB env vars aren't
// injected). `prisma generate` doesn't need a URL; db push/migrate do, and by
// then the var is present (build env locally via dotenv, on Cloudflare via the
// build command's environment). Undefined here is harmless for generate.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
