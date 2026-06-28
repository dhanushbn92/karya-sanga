"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  const lesson = await prisma.lesson.findFirst({
    where: { id: parsed.data.lessonId, published: true },
    select: { id: true },
  });
  if (!lesson) return { ok: false as const, error: "Lesson not found" };

  await prisma.progress.upsert({
    where: {
      userId_lessonId: { userId: user.id, lessonId: lesson.id },
    },
    create: {
      userId: user.id,
      lessonId: lesson.id,
      completed: true,
      completedAt: new Date(),
    },
    update: {
      completed: true,
      completedAt: new Date(),
    },
  });

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lesson.id}`);
  return { ok: true as const };
}

export async function unmarkLessonComplete(formData: FormData) {
  const user = await requireUser();
  const parsed = markCompleteSchema.safeParse({
    lessonId: formData.get("lessonId"),
  });
  if (!parsed.success) return { ok: false as const, error: "Invalid lesson" };

  await prisma.progress
    .delete({
      where: {
        userId_lessonId: { userId: user.id, lessonId: parsed.data.lessonId },
      },
    })
    .catch(() => {
      /* no row to delete is fine */
    });

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${parsed.data.lessonId}`);
  return { ok: true as const };
}
