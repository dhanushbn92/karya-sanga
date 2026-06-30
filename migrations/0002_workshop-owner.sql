-- 0002 — workshop owner
-- Run in the Supabase SQL editor. Keep in sync with lib/db/schema.ts.

-- Each workshop can have an owner (a User) with full management control of it.
ALTER TABLE "Cohort" ADD COLUMN IF NOT EXISTS "ownerId" uuid;

ALTER TABLE "Cohort" DROP CONSTRAINT IF EXISTS "Cohort_ownerId_fkey";
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Cohort_ownerId_idx" ON "Cohort" ("ownerId");
