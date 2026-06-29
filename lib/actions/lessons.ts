"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, lesson, progress } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Participant-side actions for the /lessons surface.
 */

const markCompleteSchema = z.object({
  lessonId: z.string().min(1),
});

export async function markLessonComplete(formData: FormData) {
  const user = await requireUser();
  const parsed = markCompleteSchema.safeParse({
    lessonId: formData.get("lessonId"),
  });
  if (!parsed.success) {
    return { ok: false as const, error: "Invalid lesson" };
  }

  // Verify the lesson exists and is published.
  const found = await db.query.lesson.findFirst({
    where: and(eq(lesson.id, parsed.data.lessonId), eq(lesson.published, true)),
    columns: { id: true },
  });
  if (!found) return { ok: false as const, error: "Lesson not found" };

  await db
    .insert(progress)
    .values({
      id: createId(),
      userId: user.id,
      lessonId: found.id,
      completed: true,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [progress.userId, progress.lessonId],
      set: {
        completed: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${found.id}`);
  return { ok: true as const };
}

export async function unmarkLessonComplete(formData: FormData) {
  const user = await requireUser();
  const parsed = markCompleteSchema.safeParse({
    lessonId: formData.get("lessonId"),
  });
  if (!parsed.success) return { ok: false as const, error: "Invalid lesson" };

  await db
    .delete(progress)
    .where(
      and(
        eq(progress.userId, user.id),
        eq(progress.lessonId, parsed.data.lessonId),
      ),
    )
    .catch(() => {
      /* no row to delete is fine */
    });

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${parsed.data.lessonId}`);
  return { ok: true as const };
}
