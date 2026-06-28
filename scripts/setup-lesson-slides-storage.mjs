// One-shot: create the private `lesson-slides` Supabase Storage bucket
// and set up RLS so an admin/instructor can upload to their own folder.
//
// Idempotent — safe to run multiple times.
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  process.exit(1);
}

const sb = createClient(url, secret, { auth: { persistSession: false } });

const BUCKET = "lesson-slides";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — slide decks can be big
const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
];

async function ensureBucket() {
  const { data: existing } = await sb.storage.getBucket(BUCKET);
  if (existing) {
    console.log(`  Bucket "${BUCKET}" exists — updating settings`);
    const { error } = await sb.storage.updateBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
  } else {
    console.log(`  Creating bucket "${BUCKET}"`);
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (error) throw error;
  }
}

// We only let authenticated users upload to their own <userId>/ folder.
// (Role-based gating happens at the server-action layer, not in RLS — RLS
// only sees the JWT's `sub`, not the public.User.role column.)
const policySql = `
drop policy if exists "lesson_slides_upload_own" on storage.objects;
drop policy if exists "lesson_slides_delete_own" on storage.objects;

create policy "lesson_slides_upload_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = '${BUCKET}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lesson_slides_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = '${BUCKET}'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
`;

async function applyPolicies() {
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
  console.log("Setting up Supabase Storage for lesson slide files...");
  await ensureBucket();
  await applyPolicies();
  console.log("✔ Storage ready.");
} catch (err) {
  console.error("FAIL:", err?.message ?? err);
  process.exitCode = 1;
}
