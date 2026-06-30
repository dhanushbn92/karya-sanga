-- 0003 — reusable lessons (a lesson can belong to many chapters)
-- Run in the Supabase SQL editor. Keep in sync with lib/db/schema.ts.

-- Join table: chapter membership + per-chapter order for lessons.
CREATE TABLE IF NOT EXISTS "ModuleLesson" (
  "id"        text PRIMARY KEY,
  "moduleId"  text    NOT NULL REFERENCES "Module"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "lessonId"  text    NOT NULL REFERENCES "Lesson"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  "order"     integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ModuleLesson_moduleId_lessonId_key" ON "ModuleLesson" ("moduleId", "lessonId");
CREATE INDEX IF NOT EXISTS "ModuleLesson_moduleId_order_idx" ON "ModuleLesson" ("moduleId", "order");
CREATE INDEX IF NOT EXISTS "ModuleLesson_lessonId_idx" ON "ModuleLesson" ("lessonId");

-- Backfill: one attachment per existing lesson, preserving its chapter + order.
INSERT INTO "ModuleLesson" ("id", "moduleId", "lessonId", "order")
  SELECT gen_random_uuid()::text, "moduleId", "id", "order"
    FROM "Lesson"
   WHERE "moduleId" IS NOT NULL
  ON CONFLICT ("moduleId", "lessonId") DO NOTHING;

-- Lessons no longer require a home chapter, and deleting a chapter must NOT
-- delete the lesson (it may live in other chapters / the library).
ALTER TABLE "Lesson" ALTER COLUMN "moduleId" DROP NOT NULL;
ALTER TABLE "Lesson" DROP CONSTRAINT IF EXISTS "Lesson_moduleId_fkey";
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON UPDATE CASCADE ON DELETE SET NULL;
