"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, wokwiStarter } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { STARTER_BOARDS as BOARDS } from "@/lib/starter-boards";

const createSchema = z.object({
  label: z.string().min(2, "At least 2 chars").max(80, "Too long"),
  description: z.string().max(280).optional(),
  board: z.enum(BOARDS).default("esp32"),
  category: z.string().max(60).optional(),
  wokwiProjectUrl: z
    .string()
    .url("Must be a URL")
    .refine(
      (u) => /^https?:\/\/wokwi\.com\//i.test(u),
      "Must be a wokwi.com URL",
    ),
  order: z.coerce.number().int().min(0).default(0),
  published: z.coerce.boolean().default(true),
});

export async function createStarter(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = createSchema.safeParse({
    label: formData.get("label"),
    description: formData.get("description") ?? undefined,
    board: formData.get("board") ?? "esp32",
    category: formData.get("category") ?? undefined,
    wokwiProjectUrl: formData.get("wokwiProjectUrl"),
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await db.insert(wokwiStarter).values({
    id: createId(),
    label: parsed.data.label,
    description: parsed.data.description || null,
    board: parsed.data.board,
    category: parsed.data.category || null,
    wokwiProjectUrl: parsed.data.wokwiProjectUrl,
    order: parsed.data.order,
    published: parsed.data.published,
    updatedAt: new Date(),
  });
  revalidatePath("/admin/simulator/starters");
  revalidatePath("/simulator");
}

const updateSchema = createSchema.extend({ id: z.string().min(1) });

export async function updateStarter(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = updateSchema.safeParse({
    id: formData.get("id"),
    label: formData.get("label"),
    description: formData.get("description") ?? undefined,
    board: formData.get("board") ?? "esp32",
    category: formData.get("category") ?? undefined,
    wokwiProjectUrl: formData.get("wokwiProjectUrl"),
    order: formData.get("order") ?? 0,
    published: formData.get("published") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { id, ...rest } = parsed.data;
  await db
    .update(wokwiStarter)
    .set({
      ...rest,
      description: rest.description || null,
      category: rest.category || null,
      updatedAt: new Date(),
    })
    .where(eq(wokwiStarter.id, id));
  revalidatePath("/admin/simulator/starters");
  revalidatePath("/simulator");
}

export async function deleteStarter(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await db.delete(wokwiStarter).where(eq(wokwiStarter.id, id));
  revalidatePath("/admin/simulator/starters");
  revalidatePath("/simulator");
}
