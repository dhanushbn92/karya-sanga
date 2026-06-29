"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, ne, or } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  db,
  user,
  cohort,
  cohortPost,
  team,
  teamMember,
  buildLogEntry,
  badge,
  earnedBadge,
  userCohort,
} from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";

/**
 * Server actions for the Builders / Alumni platform (per spec).
 *
 * Grouped by feature:
 *  - Profile / handle management (Feature 7)
 *  - Cohort admin + cohort feed (Feature 8)
 *  - Project gallery curation (Feature 1)
 *  - Build log entries (Feature 1 - "keep building")
 *  - Badge award / revoke (Feature 3)
 */

// =====================================================================
// Profile (Feature 7)
// =====================================================================

const handleRegex = /^[a-z0-9-]{3,30}$/;

const profileSchema = z.object({
  name: z.string().min(1).max(60),
  handle: z
    .string()
    .regex(handleRegex, "Lowercase a-z, 0-9 and dashes, 3-30 chars")
    .optional()
    .or(z.literal("")),
  bio: z.string().max(200).optional(),
  buildingNow: z.string().max(120).optional(),
  ageBand: z
    .enum(["under_15", "15-17", "18-20", "20+"])
    .optional()
    .or(z.literal("")),
  profilePublic: z.coerce.boolean().default(false),
  mentorAvailable: z.coerce.boolean().default(false),
  /// YYYY-MM-DD from a <input type="date">. Empty string clears.
  dob: z.string().optional(),
});

export async function updateMyProfile(formData: FormData): Promise<void> {
  const me = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    handle: (formData.get("handle") ?? "").toString().toLowerCase().trim(),
    bio: formData.get("bio") ?? undefined,
    buildingNow: formData.get("buildingNow") ?? undefined,
    ageBand: formData.get("ageBand") ?? undefined,
    profilePublic: formData.get("profilePublic") === "on",
    mentorAvailable: formData.get("mentorAvailable") === "on",
    dob: formData.get("dob") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Handle uniqueness — surface a friendly error rather than the DB constraint.
  if (parsed.data.handle && parsed.data.handle.length > 0) {
    const taken = await db.query.user.findFirst({
      where: and(eq(user.handle, parsed.data.handle), ne(user.id, me.id)),
      columns: { id: true },
    });
    if (taken) throw new Error("That handle is taken. Try another.");
  }

  await db
    .update(user)
    .set({
      name: parsed.data.name,
      handle: parsed.data.handle || null,
      bio: parsed.data.bio || null,
      buildingNow: parsed.data.buildingNow || null,
      ageBand: parsed.data.ageBand || null,
      profilePublic: parsed.data.profilePublic,
      mentorAvailable: parsed.data.mentorAvailable,
      dob: parsed.data.dob ? new Date(parsed.data.dob) : null,
    })
    .where(eq(user.id, me.id));

  revalidatePath("/settings/profile");
  revalidatePath("/builders");
  if (parsed.data.handle) revalidatePath(`/builders/${parsed.data.handle}`);
  revalidatePath("/dashboard");
}

// =====================================================================
// Cohort (Feature 8)
// =====================================================================

const cohortSchema = z.object({
  name: z.string().min(2).max(80),
  startedOn: z.string().optional(),
  endedOn: z.string().optional(),
  description: z.string().max(1000).optional(),
  current: z.coerce.boolean().default(false),
});

function parseDateOrNull(s: string | undefined) {
  if (!s || s.trim() === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function createCohort(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = cohortSchema.safeParse({
    name: formData.get("name"),
    startedOn: formData.get("startedOn") ?? undefined,
    endedOn: formData.get("endedOn") ?? undefined,
    description: formData.get("description") ?? undefined,
    current: formData.get("current") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Only one "current" cohort at a time; auto-clear any prior one.
  if (parsed.data.current) {
    await db
      .update(cohort)
      .set({ current: false, updatedAt: new Date() })
      .where(eq(cohort.current, true));
  }

  const [created] = await db
    .insert(cohort)
    .values({
      id: createId(),
      name: parsed.data.name,
      description: parsed.data.description || null,
      startedOn: parseDateOrNull(parsed.data.startedOn),
      endedOn: parseDateOrNull(parsed.data.endedOn),
      current: parsed.data.current,
      updatedAt: new Date(),
    })
    .returning({ id: cohort.id });

  revalidatePath("/admin/cohorts");
  redirect(`/admin/cohorts/${created.id}`);
}

const updateCohortSchema = cohortSchema.extend({ id: z.string().min(1) });

export async function updateCohort(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = updateCohortSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    startedOn: formData.get("startedOn") ?? undefined,
    endedOn: formData.get("endedOn") ?? undefined,
    description: formData.get("description") ?? undefined,
    current: formData.get("current") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  if (parsed.data.current) {
    await db
      .update(cohort)
      .set({ current: false, updatedAt: new Date() })
      .where(and(eq(cohort.current, true), ne(cohort.id, parsed.data.id)));
  }

  await db
    .update(cohort)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      startedOn: parseDateOrNull(parsed.data.startedOn),
      endedOn: parseDateOrNull(parsed.data.endedOn),
      current: parsed.data.current,
      updatedAt: new Date(),
    })
    .where(eq(cohort.id, parsed.data.id));
  revalidatePath("/admin/cohorts");
  revalidatePath(`/admin/cohorts/${parsed.data.id}`);
  revalidatePath(`/cohorts/${parsed.data.id}`);
}

export async function deleteCohort(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await db.delete(cohort).where(eq(cohort.id, id));
  revalidatePath("/admin/cohorts");
  revalidatePath("/builders");
  redirect("/admin/cohorts");
}

const assignCohortSchema = z.object({
  userId: z.string().uuid(),
  cohortId: z.string().min(1).or(z.literal("")),
});

export async function adminAssignUserToCohort(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = assignCohortSchema.safeParse({
    userId: formData.get("userId"),
    cohortId: formData.get("cohortId") ?? "",
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db
    .update(user)
    .set({ cohortId: parsed.data.cohortId || null })
    .where(eq(user.id, parsed.data.userId));
  revalidatePath("/admin/cohorts");
  revalidatePath("/builders");
}

// =====================================================================
// Cohort feed (Feature 8 — text posts)
// =====================================================================

const cohortPostSchema = z.object({
  cohortId: z.string().min(1),
  body: z.string().min(1, "Say something").max(2000, "Too long"),
});

export async function createCohortPost(formData: FormData): Promise<void> {
  const me = await requireUser();
  const parsed = cohortPostSchema.safeParse({
    cohortId: formData.get("cohortId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Cohort membership check — anyone on the cohort can post.
  // Admin / instructor can post in any cohort (e.g. instructor recap).
  const isMod = me.role === "admin" || me.role === "instructor";
  if (!isMod) {
    const u = await db.query.user.findFirst({
      where: eq(user.id, me.id),
      columns: { cohortId: true },
    });
    if (!u || u.cohortId !== parsed.data.cohortId) {
      throw new Error("You're not in this cohort.");
    }
  }

  await db.insert(cohortPost).values({
    id: createId(),
    cohortId: parsed.data.cohortId,
    authorId: me.id,
    body: parsed.data.body.trim(),
    updatedAt: new Date(),
  });
  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
}

export async function deleteCohortPost(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const post = await db.query.cohortPost.findFirst({
    where: eq(cohortPost.id, id),
    columns: { authorId: true, cohortId: true },
  });
  if (!post) throw new Error("Post not found");

  const isMod = me.role === "admin" || me.role === "instructor";
  if (!isMod && post.authorId !== me.id) {
    throw new Error("Not allowed");
  }

  await db.delete(cohortPost).where(eq(cohortPost.id, id));
  revalidatePath(`/cohorts/${post.cohortId}`);
}

export async function pinCohortPost(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  const pinned = formData.get("pinned") === "on";
  const [post] = await db
    .update(cohortPost)
    .set({ pinned, updatedAt: new Date() })
    .where(eq(cohortPost.id, id))
    .returning({ cohortId: cohortPost.cohortId });
  revalidatePath(`/cohorts/${post.cohortId}`);
}

// =====================================================================
// Project gallery (Feature 1)
// =====================================================================

const projectGallerySchema = z.object({
  teamId: z.string().min(1),
  story: z.string().max(8000).optional(),
  architecture: z.string().max(8000).optional(),
  tags: z.string().max(400).optional(),
  status: z.enum(["active", "archived", "shipped"]),
  cohortId: z.string().optional().or(z.literal("")),
});

export async function updateProjectGallery(formData: FormData): Promise<void> {
  const me = await requireUser();
  const parsed = projectGallerySchema.safeParse({
    teamId: formData.get("teamId"),
    story: formData.get("story") ?? undefined,
    architecture: formData.get("architecture") ?? undefined,
    tags: formData.get("tags") ?? undefined,
    status: formData.get("status") ?? "active",
    cohortId: formData.get("cohortId") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Editable by: team members, or admin/instructor.
  const isMod = me.role === "admin" || me.role === "instructor";
  if (!isMod) {
    const member = await db.query.teamMember.findFirst({
      where: and(
        eq(teamMember.userId, me.id),
        eq(teamMember.teamId, parsed.data.teamId),
      ),
      columns: { id: true },
    });
    if (!member) throw new Error("Only team members can edit this project.");
  }

  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 32)
    .slice(0, 16);

  await db
    .update(team)
    .set({
      story: parsed.data.story || null,
      architecture: parsed.data.architecture || null,
      tags: Array.from(new Set(tags)),
      status: parsed.data.status,
      cohortId: parsed.data.cohortId || null,
      updatedAt: new Date(),
    })
    .where(eq(team.id, parsed.data.teamId));

  revalidatePath(`/gallery/${parsed.data.teamId}`);
  revalidatePath("/gallery");
}

export async function adminFeatureProject(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const teamId = String(formData.get("teamId") ?? "");
  const featured = formData.get("featured") === "on";
  if (!teamId) throw new Error("Missing team id");
  await db
    .update(team)
    .set({
      featured,
      featuredAt: featured ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(team.id, teamId));
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${teamId}`);
  revalidatePath("/admin/gallery");
}

// =====================================================================
// Build log entries (Feature 1 — "keep building")
// =====================================================================

const buildLogSchema = z.object({
  teamId: z.string().min(1),
  body: z.string().min(1, "Say what changed").max(4000, "Too long"),
  wokwiUrl: z
    .string()
    .url("Must be a URL")
    .refine(
      (u) => /^https?:\/\/wokwi\.com\//i.test(u),
      "Must be a wokwi.com URL",
    )
    .or(z.literal(""))
    .optional(),
});

export async function addBuildLogEntry(formData: FormData): Promise<void> {
  const me = await requireUser();
  const parsed = buildLogSchema.safeParse({
    teamId: formData.get("teamId"),
    body: formData.get("body"),
    wokwiUrl: formData.get("wokwiUrl") ?? "",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const isMod = me.role === "admin" || me.role === "instructor";
  if (!isMod) {
    const member = await db.query.teamMember.findFirst({
      where: and(
        eq(teamMember.userId, me.id),
        eq(teamMember.teamId, parsed.data.teamId),
      ),
      columns: { id: true },
    });
    if (!member) {
      throw new Error("Only team members can post to this build log.");
    }
  }

  await db.insert(buildLogEntry).values({
    id: createId(),
    teamId: parsed.data.teamId,
    authorId: me.id,
    body: parsed.data.body.trim(),
    wokwiUrl: parsed.data.wokwiUrl || null,
  });
  revalidatePath(`/gallery/${parsed.data.teamId}`);
}

export async function removeBuildLogEntry(formData: FormData): Promise<void> {
  const me = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  const entry = await db.query.buildLogEntry.findFirst({
    where: eq(buildLogEntry.id, id),
    columns: { authorId: true, teamId: true },
  });
  if (!entry) throw new Error("Entry not found");

  const isMod = me.role === "admin" || me.role === "instructor";
  if (!isMod && entry.authorId !== me.id) {
    throw new Error("Not allowed");
  }

  await db.delete(buildLogEntry).where(eq(buildLogEntry.id, id));
  revalidatePath(`/gallery/${entry.teamId}`);
}

// =====================================================================
// Badges (Feature 3)
// =====================================================================

const awardSchema = z.object({
  userId: z.string().uuid(),
  badgeSlug: z.string().min(1),
  note: z.string().max(280).optional(),
});

export async function adminAwardBadge(formData: FormData): Promise<void> {
  const me = await requireRole(["admin", "instructor"]);
  const parsed = awardSchema.safeParse({
    userId: formData.get("userId"),
    badgeSlug: formData.get("badgeSlug"),
    note: formData.get("note") ?? undefined,
  });
  if (!parsed.success) throw new Error("Invalid input");

  const badgeRow = await db.query.badge.findFirst({
    where: eq(badge.slug, parsed.data.badgeSlug),
    columns: { id: true, cohortId: true },
  });
  if (!badgeRow) throw new Error("Unknown badge");

  // If the badge is scoped to a specific workshop, only admins or the
  // teachers of THAT workshop can award it. Admins bypass; instructors must
  // be members of the cohort (primary FK or UserCohort secondary).
  if (badgeRow.cohortId && me.role !== "admin") {
    const badgeCohortId = badgeRow.cohortId;
    // Primary FK membership: User.cohortId === badge.cohortId
    const primary = await db.query.user.findFirst({
      where: and(eq(user.id, me.id), eq(user.cohortId, badgeCohortId)),
      columns: { id: true },
    });
    // Secondary membership via the UserCohort join.
    const secondary = primary
      ? undefined
      : await db.query.userCohort.findFirst({
          where: and(
            eq(userCohort.userId, me.id),
            eq(userCohort.cohortId, badgeCohortId),
          ),
          columns: { id: true },
        });
    if (!primary && !secondary) {
      throw new Error(
        "You can only award this badge in the workshop it belongs to.",
      );
    }
  }

  await db
    .insert(earnedBadge)
    .values({
      id: createId(),
      userId: parsed.data.userId,
      badgeId: badgeRow.id,
      note: parsed.data.note || null,
      awardedById: me.id,
    })
    .onConflictDoUpdate({
      target: [earnedBadge.userId, earnedBadge.badgeId],
      set: {
        note: parsed.data.note || null,
        awardedById: me.id,
      },
    });

  revalidatePath("/builders");
  revalidatePath("/admin/badges");
}

export async function adminRevokeBadge(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");
  await db.delete(earnedBadge).where(eq(earnedBadge.id, id));
  revalidatePath("/builders");
  revalidatePath("/admin/badges");
}

// =====================================================================
// Workshop-scoped badges (admin)
// =====================================================================

const workshopBadgeSchema = z.object({
  cohortId: z.string().min(1),
  slug: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters / numbers / dashes"),
  name: z.string().min(2).max(60),
  description: z.string().min(2).max(280),
  icon: z.string().min(1).max(40),
  tone: z.enum(["primary", "secondary", "tertiary"]).default("primary"),
});

/**
 * Create a badge scoped to a specific workshop. Admins of any workshop can
 * mint these for kid-specific accomplishments ("First buzzer wired up").
 * Always category="workshop"; selfAward off by default.
 */
export async function createWorkshopBadge(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = workshopBadgeSchema.safeParse({
    cohortId: formData.get("cohortId"),
    slug: String(formData.get("slug") ?? "").toLowerCase(),
    name: formData.get("name"),
    description: formData.get("description"),
    icon: String(formData.get("icon") ?? "stars"),
    tone: formData.get("tone") ?? "primary",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await db.insert(badge).values({
    id: createId(),
    slug: parsed.data.slug,
    name: parsed.data.name,
    description: parsed.data.description,
    criteria: parsed.data.description, // workshop badges: criteria == description
    icon: parsed.data.icon,
    tone: parsed.data.tone,
    category: "workshop",
    cohortId: parsed.data.cohortId,
  });

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  revalidatePath("/admin/badges");
}

export async function deleteWorkshopBadge(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const id = String(formData.get("id") ?? "");
  const cohortId = String(formData.get("cohortId") ?? "");
  if (!id) throw new Error("Missing id");
  await db.delete(badge).where(eq(badge.id, id));
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath("/admin/badges");
}

// =====================================================================
// Multi-workshop membership (UserCohort join)
// =====================================================================

const multiAssignSchema = z.object({
  userId: z.string().uuid(),
  cohortId: z.string().min(1),
});

/**
 * Add a user to a workshop via the `UserCohort` join table. Unlike
 * `adminAssignUserToCohort` (which sets the user's PRIMARY workshop on
 * `User.cohortId`), this adds them as a *secondary* membership — useful
 * for alumni returning to a later workshop, mentors in multiple cohorts,
 * etc. Idempotent via the @@unique on the join.
 */
export async function addUserToWorkshop(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = multiAssignSchema.safeParse({
    userId: formData.get("userId"),
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db
    .insert(userCohort)
    .values({
      id: createId(),
      userId: parsed.data.userId,
      cohortId: parsed.data.cohortId,
    })
    .onConflictDoNothing({
      target: [userCohort.userId, userCohort.cohortId],
    });

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
  revalidatePath("/workshops");
}

// =====================================================================
// Self-service workshop join / leave (any signed-in user)
// =====================================================================

const selfWorkshopSchema = z.object({
  cohortId: z.string().min(1),
});

/**
 * Let the signed-in user add themselves to a workshop via the `UserCohort`
 * join. This is the self-service equivalent of `addUserToWorkshop` —
 * intended to be called from the `/workshops` listing or the workshop view.
 *
 * Idempotent. If the user already has a `UserCohort` row for this cohort,
 * the upsert is a no-op. If they have no primary cohortId yet, we also set
 * it so the rest of the platform (dashboard, hackathon scoping, etc.)
 * treats this workshop as their main one.
 */
export async function joinWorkshop(formData: FormData): Promise<void> {
  const currentUser = await requireUser();
  const parsed = selfWorkshopSchema.safeParse({
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const cohortRow = await db.query.cohort.findFirst({
    where: eq(cohort.id, parsed.data.cohortId),
    columns: { id: true },
  });
  if (!cohortRow) throw new Error("Workshop not found");

  await db
    .insert(userCohort)
    .values({
      id: createId(),
      userId: currentUser.id,
      cohortId: parsed.data.cohortId,
    })
    .onConflictDoNothing({
      target: [userCohort.userId, userCohort.cohortId],
    });

  // If they had no primary workshop, set this one as primary so the rest
  // of the platform (dashboard, hackathon, etc.) treats it as default.
  const me = await db.query.user.findFirst({
    where: eq(user.id, currentUser.id),
    columns: { cohortId: true },
  });
  if (!me?.cohortId) {
    await db
      .update(user)
      .set({ cohortId: parsed.data.cohortId })
      .where(eq(user.id, currentUser.id));
  }

  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
  revalidatePath(`/cohorts/${parsed.data.cohortId}/people`);
  revalidatePath("/workshops");
  revalidatePath("/dashboard");
}

/**
 * Let the signed-in user remove themselves from a workshop's `UserCohort`
 * join. Does NOT touch their primary `User.cohortId` — that's still the
 * admin's call. If they're leaving their primary workshop, the `UserCohort`
 * row goes away but their primary stays so they're not orphaned mid-session.
 */
export async function leaveWorkshop(formData: FormData): Promise<void> {
  const currentUser = await requireUser();
  const parsed = selfWorkshopSchema.safeParse({
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db
    .delete(userCohort)
    .where(
      and(
        eq(userCohort.userId, currentUser.id),
        eq(userCohort.cohortId, parsed.data.cohortId),
      ),
    )
    .catch(() => {});

  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
  revalidatePath(`/cohorts/${parsed.data.cohortId}/people`);
  revalidatePath("/workshops");
  revalidatePath("/dashboard");
}

/**
 * Remove a user from a workshop's `UserCohort` membership. Does NOT touch
 * `User.cohortId` (the primary FK) — that's still managed by
 * `adminAssignUserToCohort`. If the row doesn't exist, no-op.
 */
export async function removeUserFromWorkshop(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = multiAssignSchema.safeParse({
    userId: formData.get("userId"),
    cohortId: formData.get("cohortId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  await db
    .delete(userCohort)
    .where(
      and(
        eq(userCohort.userId, parsed.data.userId),
        eq(userCohort.cohortId, parsed.data.cohortId),
      ),
    )
    .catch(() => {});

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
  revalidatePath("/workshops");
}
