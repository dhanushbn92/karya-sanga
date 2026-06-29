"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, projectReaction, projectComment, teamMember, team } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import type { ReactionType } from "../../generated/prisma/client";

/**
 * Server actions for the project gallery detail page.
 *
 *  - toggleProjectReaction: per (team, user, type), insert or remove.
 *  - postProjectComment / deleteProjectComment: thread on a project.
 *  - addProjectMedia / removeProjectMedia: team members + mods only manage
 *    the embed-able URL list on a team.
 */

const reactionSchema = z.object({
  teamId: z.string().min(1),
  type: z.enum(["clap", "love", "idea"]),
});

export async function toggleProjectReaction(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = reactionSchema.safeParse({
    teamId: formData.get("teamId"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { teamId, type } = parsed.data;

  // Toggle: if exists, delete; else insert.
  const existing = await db.query.projectReaction.findFirst({
    where: and(
      eq(projectReaction.teamId, teamId),
      eq(projectReaction.userId, user.id),
      eq(projectReaction.type, type as ReactionType),
    ),
    columns: { id: true },
  });
  if (existing) {
    await db
      .delete(projectReaction)
      .where(eq(projectReaction.id, existing.id));
  } else {
    await db.insert(projectReaction).values({
      id: createId(),
      teamId,
      userId: user.id,
      type: type as ReactionType,
    });
  }
  revalidatePath(`/gallery/${teamId}`);
}

const commentSchema = z.object({
  teamId: z.string().min(1),
  body: z.string().min(1, "Say something").max(2000),
});

export async function postProjectComment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    teamId: formData.get("teamId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await db.insert(projectComment).values({
    id: createId(),
    teamId: parsed.data.teamId,
    authorId: user.id,
    body: parsed.data.body.trim(),
    updatedAt: new Date(),
  });
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}

export async function deleteProjectComment(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const c = await db.query.projectComment.findFirst({
    where: eq(projectComment.id, id),
    columns: { authorId: true, teamId: true },
  });
  if (!c) return;
  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod && c.authorId !== user.id) {
    throw new Error("Not allowed");
  }
  await db.delete(projectComment).where(eq(projectComment.id, id));
  revalidatePath(`/gallery/${c.teamId}`);
}

const mediaSchema = z.object({
  teamId: z.string().min(1),
  url: z
    .string()
    .url("Paste a full URL (https://…)")
    .max(1000),
});

/**
 * Team-member-or-mod gated. Adds a single URL to the team's `mediaUrls`. We
 * de-dupe in code so re-adding the same URL is a no-op.
 */
export async function addProjectMedia(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = mediaSchema.safeParse({
    teamId: formData.get("teamId"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod) {
    const m = await db.query.teamMember.findFirst({
      where: eq(teamMember.userId, user.id),
      columns: { teamId: true },
    });
    if (!m || m.teamId !== parsed.data.teamId) {
      throw new Error("Only team members can manage media");
    }
  }

  const t = await db.query.team.findFirst({
    where: eq(team.id, parsed.data.teamId),
    columns: { mediaUrls: true },
  });
  if (!t) throw new Error("Team not found");
  const current = t.mediaUrls ?? [];
  if (current.includes(parsed.data.url)) return; // no-op
  await db
    .update(team)
    .set({ mediaUrls: [...current, parsed.data.url], updatedAt: new Date() })
    .where(eq(team.id, parsed.data.teamId));
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}

const removeMediaSchema = z.object({
  teamId: z.string().min(1),
  url: z.string().min(1),
});

export async function removeProjectMedia(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const parsed = removeMediaSchema.safeParse({
    teamId: formData.get("teamId"),
    url: formData.get("url"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod) {
    const m = await db.query.teamMember.findFirst({
      where: eq(teamMember.userId, user.id),
      columns: { teamId: true },
    });
    if (!m || m.teamId !== parsed.data.teamId) {
      throw new Error("Only team members can manage media");
    }
  }

  const t = await db.query.team.findFirst({
    where: eq(team.id, parsed.data.teamId),
    columns: { mediaUrls: true },
  });
  if (!t) return;
  const current = t.mediaUrls ?? [];
  await db
    .update(team)
    .set({
      mediaUrls: current.filter((u) => u !== parsed.data.url),
      updatedAt: new Date(),
    })
    .where(eq(team.id, parsed.data.teamId));
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}
