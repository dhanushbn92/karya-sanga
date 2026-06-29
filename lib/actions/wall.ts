"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, hackathonConfig, wallPost, reaction, comment } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { deleteWallImage } from "@/lib/supabase/admin";
import type { ReactionType } from "../../generated/prisma/client";

/**
 * Photo wall server actions.
 *
 * Upload flow:
 *   1. Browser uploads the image to Supabase Storage at
 *      wall-images/<userId>/<random>.<ext> (RLS enforces the userId prefix).
 *   2. Browser POSTs the resulting storage path + caption to `createWallPost`.
 *   3. This action validates ownership of the path, creates a WallPost row,
 *      and auto-approves it if wallRequireApproval is off.
 *
 * Moderation:
 *   - admin / instructor can approve, reject, or delete any post.
 *   - Authors can delete their own posts.
 */

async function getWallConfig() {
  const [row] = await db
    .insert(hackathonConfig)
    .values({ id: "default", updatedAt: new Date() })
    .onConflictDoUpdate({ target: hackathonConfig.id, set: {} })
    .returning({ wallRequireApproval: hackathonConfig.wallRequireApproval });
  return row;
}

/**
 * Per-kind validation rules:
 *   photo  — imagePath required; caption optional
 *   update — body required (≤ 1000 chars); no image required
 *   blog   — title required (≤ 140), body required (≤ 10k); image optional
 */
const createSchema = z
  .object({
    kind: z.enum(["photo", "update", "blog"]).default("photo"),
    imagePath: z
      .string()
      .max(500)
      .refine(
        (p) => !p || (!p.includes("..") && !p.startsWith("/")),
        "Invalid image path",
      )
      .optional(),
    caption: z.string().max(500).optional(),
    title: z.string().max(140).optional(),
    body: z.string().max(10_000).optional(),
    tags: z.string().max(200).optional(),
    /// Comma- or newline-separated list of media URLs (YouTube, Vimeo,
    /// SoundCloud, images, PDFs, etc.). Parsed and de-duped server-side.
    media: z.string().max(4000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "photo" && !val.imagePath) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["imagePath"],
        message: "Photo posts need an image.",
      });
    }
    if (val.kind === "update") {
      const len = (val.body ?? "").trim().length;
      if (len < 1)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body"],
          message: "Updates need a message.",
        });
      if (len > 1000)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body"],
          message: "Updates are 1000 characters max.",
        });
    }
    if (val.kind === "blog") {
      if (!val.title?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["title"],
          message: "Blog posts need a title.",
        });
      if (!val.body?.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body"],
          message: "Blog posts need a body.",
        });
    }
  });

export async function createWallPost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = createSchema.safeParse({
    kind: formData.get("kind") ?? "photo",
    imagePath: formData.get("imagePath") || undefined,
    caption: formData.get("caption") ?? undefined,
    title: formData.get("title") ?? undefined,
    body: formData.get("body") ?? undefined,
    tags: formData.get("tags") ?? undefined,
    media: formData.get("media") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // If an image is supplied, it must live under the user's own folder. The
  // storage RLS policy enforces this; we double-check before recording.
  if (parsed.data.imagePath) {
    const expectedPrefix = `${user.id}/`;
    if (!parsed.data.imagePath.startsWith(expectedPrefix)) {
      throw new Error("Image path must be under your own folder");
    }
  }

  const cfg = await getWallConfig();
  const autoApprove = !cfg.wallRequireApproval;

  // Tags: comma-separated → trimmed, deduped, lowercase, capped at 8.
  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 24)
    .slice(0, 8);

  // Media URLs: split on newlines + commas, trim, validate as URL, dedupe,
  // cap at 8 entries to keep posts focused.
  const mediaUrls = Array.from(
    new Set(
      (parsed.data.media ?? "")
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .filter((s) => {
          try {
            const u = new URL(s);
            return u.protocol === "http:" || u.protocol === "https:";
          } catch {
            return false;
          }
        }),
    ),
  ).slice(0, 8);

  await db.insert(wallPost).values({
    id: createId(),
    authorId: user.id,
    kind: parsed.data.kind,
    imagePath: parsed.data.imagePath || null,
    caption: parsed.data.caption || null,
    title: parsed.data.title?.trim() || null,
    body: parsed.data.body?.trim() || null,
    tags: Array.from(new Set(tags)),
    mediaUrls,
    approved: autoApprove,
    approvedAt: autoApprove ? new Date() : null,
    updatedAt: new Date(),
  });

  revalidatePath("/wall");
  revalidatePath("/admin/wall");
}

export async function approveWallPost(formData: FormData): Promise<void> {
  const mod = await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await db
    .update(wallPost)
    .set({
      approved: true,
      approvedAt: new Date(),
      approvedById: mod.id,
      rejected: false,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(eq(wallPost.id, id));
  revalidatePath("/wall");
  revalidatePath("/admin/wall");
}

const rejectSchema = z.object({
  id: z.string().min(1),
  reason: z.string().max(280).optional(),
});

export async function rejectWallPost(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = rejectSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await db
    .update(wallPost)
    .set({
      approved: false,
      rejected: true,
      rejectionReason: parsed.data.reason || null,
      updatedAt: new Date(),
    })
    .where(eq(wallPost.id, parsed.data.id));
  revalidatePath("/wall");
  revalidatePath("/admin/wall");
}

export async function deleteWallPost(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const post = await db.query.wallPost.findFirst({
    where: eq(wallPost.id, id),
    columns: { authorId: true, imagePath: true },
  });
  if (!post) throw new Error("Post not found");

  const isMod = user.role === "admin" || user.role === "instructor";
  const isOwner = post.authorId === user.id;
  if (!isMod && !isOwner) {
    throw new Error("Not allowed");
  }

  await db.delete(wallPost).where(eq(wallPost.id, id));
  // Best-effort cleanup of the underlying storage object (if any — updates
  // don't have one).
  if (post.imagePath) {
    await deleteWallImage(post.imagePath).catch(() => {});
  }

  // If the caller came from the detail page, kick them back to the feed
  // (otherwise their now-deleted row would render a notFound).
  const redirectTo = String(formData.get("redirectTo") ?? "");
  if (redirectTo === "/wall") {
    revalidatePath("/wall");
    revalidatePath("/admin/wall");
    const { redirect } = await import("next/navigation");
    redirect("/wall");
  }

  revalidatePath("/wall");
  revalidatePath("/admin/wall");
}

const wallConfigSchema = z.object({
  wallRequireApproval: z.coerce.boolean().default(true),
});

export async function updateWallConfig(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = wallConfigSchema.safeParse({
    wallRequireApproval: formData.get("wallRequireApproval") === "on",
  });
  if (!parsed.success) throw new Error("Invalid config");

  await db
    .insert(hackathonConfig)
    .values({
      id: "default",
      wallRequireApproval: parsed.data.wallRequireApproval,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: hackathonConfig.id,
      set: {
        wallRequireApproval: parsed.data.wallRequireApproval,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/admin/wall");
  revalidatePath("/wall");
}

// =====================================================================
// Reactions (clap / love / idea) — toggle per (user, post, type)
// =====================================================================

const REACTION_TYPES = ["clap", "love", "idea"] as const;
const reactionSchema = z.object({
  postId: z.string().min(1),
  type: z.enum(REACTION_TYPES),
});

export async function toggleReaction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = reactionSchema.safeParse({
    postId: formData.get("postId"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid reaction");
  }

  // Only let people react to posts they can actually see (approved, or their own).
  const post = await db.query.wallPost.findFirst({
    where: and(
      eq(wallPost.id, parsed.data.postId),
      or(eq(wallPost.approved, true), eq(wallPost.authorId, user.id)),
    ),
    columns: { id: true },
  });
  if (!post) throw new Error("Post not found");

  const existing = await db.query.reaction.findFirst({
    where: and(
      eq(reaction.postId, parsed.data.postId),
      eq(reaction.userId, user.id),
      eq(reaction.type, parsed.data.type as ReactionType),
    ),
    columns: { id: true },
  });

  if (existing) {
    await db.delete(reaction).where(eq(reaction.id, existing.id));
  } else {
    await db.insert(reaction).values({
      id: createId(),
      postId: parsed.data.postId,
      userId: user.id,
      type: parsed.data.type as ReactionType,
    });
  }

  revalidatePath("/wall");
}

// =====================================================================
// Comments — add / delete
// =====================================================================

const commentSchema = z.object({
  postId: z.string().min(1),
  body: z
    .string()
    .min(1, "Say something")
    .max(500, "Keep it short — 500 chars max"),
});

export async function addComment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid comment");
  }

  const post = await db.query.wallPost.findFirst({
    where: and(
      eq(wallPost.id, parsed.data.postId),
      or(eq(wallPost.approved, true), eq(wallPost.authorId, user.id)),
    ),
    columns: { id: true },
  });
  if (!post) throw new Error("Post not found");

  await db.insert(comment).values({
    id: createId(),
    postId: parsed.data.postId,
    authorId: user.id,
    body: parsed.data.body.trim(),
    updatedAt: new Date(),
  });

  revalidatePath("/wall");
}

export async function deleteComment(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing comment id");

  const c = await db.query.comment.findFirst({
    where: eq(comment.id, id),
    columns: { authorId: true },
  });
  if (!c) throw new Error("Comment not found");

  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod && c.authorId !== user.id) {
    throw new Error("Not allowed");
  }

  await db.delete(comment).where(eq(comment.id, id));
  revalidatePath("/wall");
}
