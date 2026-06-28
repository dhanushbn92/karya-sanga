// Default OpenNext Cloudflare configuration.
//
// `defineCloudflareConfig` returns the full OpenNext config object with
// sensible defaults for the Cloudflare Workers runtime: in-memory
// incremental cache, queue stub, edge converter, etc.
//
// Override only when needed (e.g. to wire R2 caching, custom queues, etc.).
// For this project the defaults are fine — all dynamic data lives in
// Supabase Postgres + Supabase Storage, so no Cloudflare-side cache or
// queue is required.

import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
