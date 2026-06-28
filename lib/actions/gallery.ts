"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  const existing = await prisma.projectReaction.findUnique({
    where: {
      teamId_userId_type: { teamId, userId: user.id, type: type as ReactionType },
    },
    select: { id: true },
  });
  if (existing) {
    await prisma.projectReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.projectReaction.create({
      data: { teamId, userId: user.id, type: type as ReactionType },
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
  await prisma.projectComment.create({
    data: {
      teamId: parsed.data.teamId,
      authorId: user.id,
      body: parsed.data.body.trim(),
    },
  });
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}

export async function deleteProjectComment(
  formData: FormData,
): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const c = await prisma.projectComment.findUnique({
    where: { id },
    select: { authorId: true, teamId: true },
  });
  if (!c) return;
  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod && c.authorId !== user.id) {
    throw new Error("Not allowed");
  }
  await prisma.projectComment.delete({ where: { id } });
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
    const m = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      select: { teamId: true },
    });
    if (!m || m.teamId !== parsed.data.teamId) {
      throw new Error("Only team members can manage media");
    }
  }

  const team = await prisma.team.findUnique({
    where: { id: parsed.data.teamId },
    select: { mediaUrls: true },
  });
  if (!team) throw new Error("Team not found");
  if (team.mediaUrls.includes(parsed.data.url)) return; // no-op
  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: { mediaUrls: { set: [...team.mediaUrls, parsed.data.url] } },
  });
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
    const m = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      select: { teamId: true },
    });
    if (!m || m.teamId !== parsed.data.teamId) {
      throw new Error("Only team members can manage media");
    }
  }

  const team = await prisma.team.findUnique({
    where: { id: parsed.data.teamId },
    select: { mediaUrls: true },
  });
  if (!team) return;
  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: {
      mediaUrls: { set: team.mediaUrls.filter((u) => u !== parsed.data.url) },
    },
  });
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}
