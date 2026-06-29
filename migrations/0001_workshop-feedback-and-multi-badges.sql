-- 0001 — Workshop feedback + multi-award workshop badges
-- Run in the Supabase SQL editor. Keep in sync with lib/db/schema.ts.

-- ---------------------------------------------------------------------------
-- EarnedBadge: a badge can now be earned MULTIPLE times, and each award is
-- tied to the workshop it was earned in.
-- ---------------------------------------------------------------------------

-- Drop the old "one badge per user" uniqueness (it was a unique index).
ALTER TABLE "EarnedBadge" DROP CONSTRAINT IF EXISTS "EarnedBadge_userId_badgeId_key";
DROP INDEX IF EXISTS "EarnedBadge_userId_badgeId_key";

-- Which workshop the award was given in.
ALTER TABLE "EarnedBadge" ADD COLUMN IF NOT EXISTS "cohortId" text;

ALTER TABLE "EarnedBadge" DROP CONSTRAINT IF EXISTS "EarnedBadge_cohortId_fkey";
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_cohortId_fkey"
  FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON UPDATE CASCADE ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "EarnedBadge_cohortId_idx" ON "EarnedBadge" ("cohortId");

-- Backfill: tie existing workshop-badge awards to the badge's workshop.
UPDATE "EarnedBadge" eb
   SET "cohortId" = b."cohortId"
  FROM "Badge" b
 WHERE eb."badgeId" = b."id"
   AND b."cohortId" IS NOT NULL
   AND eb."cohortId" IS NULL;

-- ---------------------------------------------------------------------------
-- WorkshopFeedback: one rating (1-5) + optional comment per user per workshop.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "WorkshopFeedback" (
  "id"        text PRIMARY KEY,
  "cohortId"  text    NOT NULL REFERENCES "Cohort"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "userId"    uuid    NOT NULL REFERENCES "User"("id")   ON UPDATE CASCADE ON DELETE CASCADE,
  "rating"    integer NOT NULL,
  "comment"   text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopFeedback_cohortId_userId_key"
  ON "WorkshopFeedback" ("cohortId", "userId");
CREATE INDEX IF NOT EXISTS "WorkshopFeedback_cohortId_idx"
  ON "WorkshopFeedback" ("cohortId");
