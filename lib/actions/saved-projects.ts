"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

const saveSchema = z.object({
  name: z.string().min(1, "Give it a name").max(80, "Too long"),
  wokwiProjectUrl: z
    .string()
    .url("Must be a URL")
    .refine(
      (u) => /^https?:\/\/wokwi\.com\//i.test(u),
      "Must be a wokwi.com URL",
    ),
  notes: z.string().max(500, "Too long").optional(),
});

export async function saveProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = saveSchema.safeParse({
    name: formData.get("name"),
    wokwiProjectUrl: formData.get("wokwiProjectUrl"),
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await prisma.savedProject.create({
    data: {
      ownerId: user.id,
      name: parsed.data.name,
      wokwiProjectUrl: parsed.data.wokwiProjectUrl,
      notes: parsed.data.notes || null,
    },
  });
  revalidatePath("/simulator");
  revalidatePath("/dashboard");
}

export async function deleteSavedProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  // Scope delete to the owner to prevent cross-user deletion.
  await prisma.savedProject.deleteMany({
    where: { id, ownerId: user.id },
  });
  revalidatePath("/simulator");
  revalidatePath("/dashboard");
}
