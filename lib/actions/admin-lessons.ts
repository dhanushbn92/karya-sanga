"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { deleteLessonSlide } from "@/lib/supabase/admin";

/**
 * Admin / instructor actions for module + lesson authoring.
 *
 * These run as `<form action={...}>` server actions, so they MUST return
 * void / Promise<void>. On validation failure we throw — the framework's
 * error boundary renders a clean page. On success we revalidate the
 * affected paths or redirect.
 *
 * Server-side `requireRole` is the source of truth — never trust the UI.
 */

const wokwiUrl = z
  .string()
  .url()
  .refine(
    (u) => /^https?:\/\/wokwi\.com\//i.test(u),
    "Must be a https://wokwi.com/... URL",
  )
  .or(z.literal(""))
  .optional();

const moduleSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});

function fail(message: string): never {
  throw new Error(message);
}

export async function createModule(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = moduleSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const created = await prisma.module.create({
    data: parsed.data,
    select: { id: true },
  });
  revalidatePath("/admin/modules");
  revalidatePath("/lessons");
  redirect(`/admin/modules/${created.id}`);
}

const updateModuleSchema = moduleSchema.extend({
  id: z.string().min(1),
});

export async function updateModule(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = updateModuleSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { id, ...rest } = parsed.data;
  await prisma.module.update({
    where: { id },
    data: { ...rest, description: rest.description || null },
  });
  revalidatePath("/admin/modules");
  revalidatePath(`/admin/modules/${id}`);
  revalidatePath("/lessons");
}

export async function deleteModule(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  if (!id) fail("Missing id");
  await prisma.module.delete({ where: { id } });
  revalidatePath("/admin/modules");
  revalidatePath("/lessons");
  redirect("/admin/modules");
}

const lessonSchema = z.object({
  moduleId: z.string().min(1, "Module id is required"),
  title: z.string().min(1, "Title is required"),
  summary: z.string().optional(),
  body: z.string().default(""),
  wokwiProjectUrl: wokwiUrl,
  slidesUrl: z
    .string()
    .url("Must be a URL")
    .or(z.literal(""))
    .optional(),
  difficulty: z
    .enum(["Easy", "Medium", "Hard"])
    .optional()
    .or(z.literal("")),
  order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(false),
});

export async function createLesson(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = lessonSchema.safeParse({
    moduleId: formData.get("moduleId"),
    title: formData.get("title"),
    summary: formData.get("summary") ?? undefined,
    body: formData.get("body") ?? "",
    wokwiProjectUrl: formData.get("wokwiProjectUrl") ?? "",
    slidesUrl: formData.get("slidesUrl") ?? "",
    difficulty: formData.get("difficulty") ?? "",
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await prisma.lesson.create({
    data: {
      ...parsed.data,
      wokwiProjectUrl: parsed.data.wokwiProjectUrl || null,
      slidesUrl: parsed.data.slidesUrl || null,
      difficulty: parsed.data.difficulty || null,
      summary: parsed.data.summary || null,
    },
  });
  revalidatePath(`/admin/modules/${parsed.data.moduleId}`);
  revalidatePath("/lessons");
}

const updateLessonSchema = lessonSchema.extend({
  id: z.string().min(1),
});

export async function updateLesson(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = updateLessonSchema.safeParse({
    id: formData.get("id"),
    moduleId: formData.get("moduleId"),
    title: formData.get("title"),
    summary: formData.get("summary") ?? undefined,
    body: formData.get("body") ?? "",
    wokwiProjectUrl: formData.get("wokwiProjectUrl") ?? "",
    slidesUrl: formData.get("slidesUrl") ?? "",
    difficulty: formData.get("difficulty") ?? "",
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { id, ...rest } = parsed.data;
  await prisma.lesson.update({
    where: { id },
    data: {
      ...rest,
      wokwiProjectUrl: rest.wokwiProjectUrl || null,
      slidesUrl: rest.slidesUrl || null,
      difficulty: rest.difficulty || null,
      summary: rest.summary || null,
    },
  });
  revalidatePath(`/admin/modules/${rest.moduleId}`);
  revalidatePath(`/lessons/${id}`);
  revalidatePath("/lessons");
}

export async function deleteLesson(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  const moduleId = String(formData.get("moduleId") ?? "");
  if (!id) fail("Missing id");
  // Pull the slide path so we can clean up storage in the same pass.
  const existing = await prisma.lesson.findUnique({
    where: { id },
    select: { slideFilePath: true },
  });
  await prisma.lesson.delete({ where: { id } });
  if (existing?.slideFilePath) {
    await deleteLessonSlide(existing.slideFilePath).catch(() => {});
  }
  if (moduleId) revalidatePath(`/admin/modules/${moduleId}`);
  revalidatePath("/lessons");
}

// =====================================================================
// Slide-file attachment (PDF / PPT / PPTX)
//
// Upload flow:
//   1. Browser uploads the file to lesson-slides/<userId>/<rand>.<ext>
//      using the user-authenticated Supabase client. Storage RLS enforces
//      the <userId>/ prefix.
//   2. Browser POSTs the resulting path + mime + original filename to
//      attachSlideFile, which records it on the lesson row.
// =====================================================================

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const attachSlideSchema = z.object({
  lessonId: z.string().min(1),
  slideFilePath: z
    .string()
    .min(3)
    .refine(
      (p) => !p.includes("..") && !p.startsWith("/"),
      "Invalid file path",
    ),
  slideFileType: z
    .string()
    .min(1)
    .refine((m) => ALLOWED_MIME.has(m), "Unsupported file type"),
  slideFileName: z.string().min(1).max(200),
});

export async function attachSlideFile(formData: FormData): Promise<void> {
  const user = await requireRole(["admin", "instructor"]);
  const parsed = attachSlideSchema.safeParse({
    lessonId: formData.get("lessonId"),
    slideFilePath: formData.get("slideFilePath"),
    slideFileType: formData.get("slideFileType"),
    slideFileName: formData.get("slideFileName"),
  });
  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Defense in depth: the storage RLS already enforces the <userId>/ prefix.
  if (!parsed.data.slideFilePath.startsWith(`${user.id}/`)) {
    fail("Slide file path must be under your own folder");
  }

  // If the lesson already had a slide file, clean up the old object.
  const existing = await prisma.lesson.findUnique({
    where: { id: parsed.data.lessonId },
    select: { slideFilePath: true, moduleId: true },
  });
  if (!existing) fail("Lesson not found");

  await prisma.lesson.update({
    where: { id: parsed.data.lessonId },
    data: {
      slideFilePath: parsed.data.slideFilePath,
      slideFileType: parsed.data.slideFileType,
      slideFileName: parsed.data.slideFileName,
    },
  });

  if (existing.slideFilePath && existing.slideFilePath !== parsed.data.slideFilePath) {
    await deleteLessonSlide(existing.slideFilePath).catch(() => {});
  }

  revalidatePath(`/admin/modules/${existing.moduleId}`);
  revalidatePath(`/lessons/${parsed.data.lessonId}`);
  revalidatePath(`/lessons/${parsed.data.lessonId}/deck`);
  revalidatePath("/lessons");
}

export async function removeSlideFile(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const lessonId = String(formData.get("lessonId") ?? "");
  if (!lessonId) fail("Missing lesson id");
  const existing = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { slideFilePath: true, moduleId: true },
  });
  if (!existing) fail("Lesson not found");

  await prisma.lesson.update({
    where: { id: lessonId },
    data: { slideFilePath: null, slideFileType: null, slideFileName: null },
  });
  if (existing.slideFilePath) {
    await deleteLessonSlide(existing.slideFilePath).catch(() => {});
  }

  revalidatePath(`/admin/modules/${existing.moduleId}`);
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath(`/lessons/${lessonId}/deck`);
  revalidatePath("/lessons");
}

// =====================================================================
// WorkshopModule attach / detach / reorder
// =====================================================================

const attachModuleSchema = z.object({
  cohortId: z.string().min(1),
  moduleId: z.string().min(1),
});

/**
 * Attach a library module to a workshop. Order is appended (max order + 1
 * within the cohort). Idempotent via the @@unique(cohortId, moduleId).
 */
export async function attachModuleToCohort(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = attachModuleSchema.safeParse({
    cohortId: formData.get("cohortId"),
    moduleId: formData.get("moduleId"),
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { cohortId, moduleId } = parsed.data;

  const last = await prisma.workshopModule.findFirst({
    where: { cohortId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? -1) + 1;

  await prisma.workshopModule.upsert({
    where: { cohortId_moduleId: { cohortId, moduleId } },
    create: { cohortId, moduleId, order: nextOrder },
    update: {}, // already attached — no-op
  });

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/lessons");
}

export async function detachModuleFromCohort(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = attachModuleSchema.safeParse({
    cohortId: formData.get("cohortId"),
    moduleId: formData.get("moduleId"),
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { cohortId, moduleId } = parsed.data;

  await prisma.workshopModule.deleteMany({
    where: { cohortId, moduleId },
  });

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/lessons");
}

const moveSchema = z.object({
  cohortId: z.string().min(1),
  moduleId: z.string().min(1),
  direction: z.enum(["up", "down"]),
});

/**
 * Swap the order of two adjacent attached modules. Cheap (two updates inside a
 * transaction) and works for any list size — no drag-drop dependency.
 */
export async function moveAttachedModule(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = moveSchema.safeParse({
    cohortId: formData.get("cohortId"),
    moduleId: formData.get("moduleId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) throw new Error("Invalid input");
  const { cohortId, moduleId, direction } = parsed.data;

  const items = await prisma.workshopModule.findMany({
    where: { cohortId },
    orderBy: { order: "asc" },
    select: { id: true, moduleId: true, order: true },
  });
  const idx = items.findIndex((r) => r.moduleId === moduleId);
  if (idx === -1) return;
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return; // edge — silently ignore

  const a = items[idx];
  const b = items[swapIdx];
  await prisma.$transaction([
    prisma.workshopModule.update({
      where: { id: a.id },
      data: { order: b.order },
    }),
    prisma.workshopModule.update({
      where: { id: b.id },
      data: { order: a.order },
    }),
  ]);

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
}
