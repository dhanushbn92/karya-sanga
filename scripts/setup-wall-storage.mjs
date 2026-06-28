// One-shot: create the private `wall-images` Supabase Storage bucket and set
// up RLS policies so authenticated users can upload to their own folder.
//
// Idempotent — safe to run multiple times.
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(url, secret, {
  auth: { persistSession: false },
});

const BUCKET = "wall-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

async function ensureBucket() {
  const { data: existing } = await supabase.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`  Bucket "${BUCKET}" already exists — updating settings`);
    const { error } = await supabase.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
  } else {
    console.log(`  Creating bucket "${BUCKET}"`);
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
  }
}

// Storage RLS is configured on the storage.objects table. We grant:
//   - authenticated users can INSERT into wall-images/<their-uid>/...
//   - authenticated users can DELETE their own
//   - SELECT stays closed to authenticated (signed URLs from server only).
const policySql = `
-- Drop and recreate so we own the definition.
drop policy if exists "wall_upload_own" on storage.objects;
drop policy if exists "wall_delete_own" on storage.objects;

create policy "wall_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = '${BUCKET}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "wall_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = '${BUCKET}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
`;

async function applyPolicies() {
  // Supabase JS SDK can't execute arbitrary SQL. Use the direct Postgres
  // connection (DIRECT_URL) — same trick as scripts/apply-triggers.mjs.
  const pgModule = await import("pg");
  const pg = pgModule.default;
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    console.log("  Applying RLS policies on storage.objects");
    await client.query(policySql);
  } finally {
    await client.end();
  }
}

try {
  console.log("Setting up Supabase Storage for the photo wall...");
  await ensureBucket();
  await applyPolicies();
  console.log("✔ Storage ready.");
} catch (err) {
  console.error("FAIL:", err?.message ?? err);
  process.exitCode = 1;
}
