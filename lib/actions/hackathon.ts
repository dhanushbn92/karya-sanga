"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, asc, eq, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  db,
  hackathonConfig,
  team,
  teamMember,
  teamWokwiLink,
  lookingForTeam,
  teamMessage,
  user,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Hackathon team formation + workspace actions.
 *
 * Rules baked in:
 *  - One team per user across the workshop (enforced via @@unique on
 *    TeamMember.userId).
 *  - Team creator becomes captain. Captains can rename, delete, and toggle
 *    "looking for members". Any member can edit workspace fields.
 *  - Joining respects HackathonConfig.maxTeamSize (default 5).
 */

async function getMaxTeamSize() {
  const [cfg] = await db
    .insert(hackathonConfig)
    .values({ id: "default", updatedAt: new Date() })
    .onConflictDoUpdate({
      target: hackathonConfig.id,
      set: { id: "default" },
    })
    .returning({ maxTeamSize: hackathonConfig.maxTeamSize });
  return cfg.maxTeamSize;
}

/**
 * Every workshop (cohort) a user belongs to — primary `User.cohortId` plus any
 * secondary `UserCohort` memberships. The hackathon is workshop-scoped: a user
 * can only form/join teams inside a workshop they're part of.
 */
async function getUserCohortIds(userId: string): Promise<string[]> {
  const me = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { cohortId: true },
    with: {
      userCohorts: {
        columns: { cohortId: true },
        orderBy: (uc, { asc }) => [asc(uc.joinedAt)],
      },
    },
  });
  if (!me) return [];
  const ids = new Set<string>();
  if (me.cohortId) ids.add(me.cohortId);
  for (const uc of me.userCohorts) if (uc.cohortId) ids.add(uc.cohortId);
  return [...ids];
}

// =====================================================================
// Team formation
// =====================================================================

const createTeamSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Too long"),
  description: z.string().max(280).optional(),
});

export async function createTeam(formData: FormData): Promise<void> {
  const user_ = await requireUser();

  // Prevent double-team membership before we touch the DB.
  const existing = await db.query.teamMember.findFirst({
    where: eq(teamMember.userId, user_.id),
    columns: { teamId: true },
  });
  if (existing) {
    throw new Error("You're already on a team. Leave it first to create another.");
  }

  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // A team always belongs to a workshop. A user who isn't in any workshop
  // can't create one — the hackathon runs inside workshops, not globally.
  const cohortIds = await getUserCohortIds(user_.id);
  if (cohortIds.length === 0) {
    throw new Error(
      "You need to be in a workshop to create a hackathon team. Ask your instructor to add you to one.",
    );
  }
  const teamCohortId = cohortIds[0];

  // Atomic create-team-and-add-captain.
  const teamId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(team).values({
      id: teamId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      cohortId: teamCohortId,
      updatedAt: new Date(),
    });
    await tx.insert(teamMember).values({
      id: createId(),
      teamId,
      userId: user_.id,
      isCaptain: true,
    });
  });

  revalidatePath("/hackathon");
  redirect(`/hackathon/teams/${teamId}`);
}

export async function joinTeam(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Missing team id");

  const existing = await db.query.teamMember.findFirst({
    where: eq(teamMember.userId, user_.id),
    columns: { teamId: true },
  });
  if (existing) {
    throw new Error("You're already on a team.");
  }

  const teamRow = await db.query.team.findFirst({
    where: eq(team.id, teamId),
  });
  if (!teamRow) throw new Error("Team not found");

  // A team is workshop-scoped: only members of the team's workshop can join.
  const cohortIds = await getUserCohortIds(user_.id);
  if (!teamRow.cohortId || !cohortIds.includes(teamRow.cohortId)) {
    throw new Error("You can only join a team in your own workshop.");
  }

  if (!teamRow.lookingForMembers) {
    throw new Error("This team isn't accepting new members right now.");
  }
  const memberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, teamRow.id),
  );
  const maxSize = await getMaxTeamSize();
  if (memberCount >= maxSize) {
    throw new Error(`Team is full (${maxSize} max).`);
  }

  await db.insert(teamMember).values({
    id: createId(),
    teamId: teamRow.id,
    userId: user_.id,
  });

  // If joining filled the team, flip off "looking for members".
  if (memberCount + 1 >= maxSize) {
    await db
      .update(team)
      .set({ lookingForMembers: false, updatedAt: new Date() })
      .where(eq(team.id, teamRow.id));
  }

  // Remove the user's looking-for-team post if they had one.
  await db
    .delete(lookingForTeam)
    .where(eq(lookingForTeam.userId, user_.id))
    .catch(() => {});

  revalidatePath("/hackathon");
  redirect(`/hackathon/teams/${teamRow.id}`);
}

export async function leaveTeam(): Promise<void> {
  const user_ = await requireUser();
  const member = await db.query.teamMember.findFirst({
    where: eq(teamMember.userId, user_.id),
    with: { team: true },
  });
  if (!member) throw new Error("You aren't on a team.");

  const memberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, member.teamId),
  );

  // If you're the last member, delete the team entirely (cascade drops members + links).
  if (memberCount === 1) {
    await db.delete(team).where(eq(team.id, member.teamId));
  } else {
    // If you were captain, promote the next member by joinedAt asc.
    if (member.isCaptain) {
      const next = await db.query.teamMember.findFirst({
        where: and(
          eq(teamMember.teamId, member.teamId),
          ne(teamMember.id, member.id),
        ),
        orderBy: [asc(teamMember.joinedAt)],
        columns: { id: true },
      });
      if (next) {
        await db
          .update(teamMember)
          .set({ isCaptain: true })
          .where(eq(teamMember.id, next.id));
      }
    }
    await db.delete(teamMember).where(eq(teamMember.id, member.id));
    // Team may now have room — make sure it's findable again.
    await db
      .update(team)
      .set({ lookingForMembers: true, updatedAt: new Date() })
      .where(eq(team.id, member.teamId));
  }

  revalidatePath("/hackathon");
  redirect("/hackathon");
}

// =====================================================================
// Team workspace
// =====================================================================

const workspaceSchema = z.object({
  teamId: z.string().min(1),
  projectTitle: z.string().max(120).optional(),
  projectDescription: z.string().max(2000).optional(),
  repoUrl: z
    .string()
    .url("Must be a URL")
    .or(z.literal(""))
    .optional(),
  buildLog: z.string().max(10000).optional(),
  lookingForMembers: z.coerce.boolean().default(false),
});

async function requireTeamMember(userId: string, teamId: string) {
  const member = await db.query.teamMember.findFirst({
    where: and(eq(teamMember.userId, userId), eq(teamMember.teamId, teamId)),
    columns: { id: true, isCaptain: true },
  });
  if (!member) throw new Error("You aren't on this team.");
  return member;
}

export async function updateTeamWorkspace(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const parsed = workspaceSchema.safeParse({
    teamId: formData.get("teamId"),
    projectTitle: formData.get("projectTitle") ?? undefined,
    projectDescription: formData.get("projectDescription") ?? undefined,
    repoUrl: formData.get("repoUrl") ?? undefined,
    buildLog: formData.get("buildLog") ?? undefined,
    lookingForMembers: formData.get("lookingForMembers") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await requireTeamMember(user_.id, parsed.data.teamId);

  await db
    .update(team)
    .set({
      projectTitle: parsed.data.projectTitle || null,
      projectDescription: parsed.data.projectDescription || null,
      repoUrl: parsed.data.repoUrl || null,
      buildLog: parsed.data.buildLog || null,
      lookingForMembers: parsed.data.lookingForMembers,
      updatedAt: new Date(),
    })
    .where(eq(team.id, parsed.data.teamId));

  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
  revalidatePath("/hackathon");
}

const wokwiLinkSchema = z.object({
  teamId: z.string().min(1),
  label: z.string().min(1, "Label is required").max(60),
  wokwiProjectUrl: z
    .string()
    .url("Must be a URL")
    .refine(
      (u) => /^https?:\/\/wokwi\.com\//i.test(u),
      "Must be a wokwi.com URL",
    ),
});

export async function addTeamWokwiLink(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const parsed = wokwiLinkSchema.safeParse({
    teamId: formData.get("teamId"),
    label: formData.get("label"),
    wokwiProjectUrl: formData.get("wokwiProjectUrl"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await requireTeamMember(user_.id, parsed.data.teamId);

  await db.insert(teamWokwiLink).values({
    id: createId(),
    teamId: parsed.data.teamId,
    label: parsed.data.label,
    wokwiProjectUrl: parsed.data.wokwiProjectUrl,
    addedById: user_.id,
  });
  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
}

export async function removeTeamWokwiLink(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!id || !teamId) throw new Error("Missing id");
  await requireTeamMember(user_.id, teamId);
  await db.delete(teamWokwiLink).where(eq(teamWokwiLink.id, id));
  revalidatePath(`/hackathon/teams/${teamId}`);
}

// =====================================================================
// "Looking for a team" board
// =====================================================================

const lookingSchema = z.object({
  skills: z
    .string()
    .min(2, "Tell us a bit about your skills")
    .max(280, "Too long"),
  interests: z.string().max(280).optional(),
  contact: z.string().max(120).optional(),
});

export async function postLookingForTeam(formData: FormData): Promise<void> {
  const user_ = await requireUser();

  const onTeam = await db.query.teamMember.findFirst({
    where: eq(teamMember.userId, user_.id),
    columns: { id: true },
  });
  if (onTeam) {
    throw new Error("You're already on a team; leave it before posting.");
  }

  const parsed = lookingSchema.safeParse({
    skills: formData.get("skills"),
    interests: formData.get("interests") ?? undefined,
    contact: formData.get("contact") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  await db
    .insert(lookingForTeam)
    .values({
      id: createId(),
      userId: user_.id,
      skills: parsed.data.skills,
      interests: parsed.data.interests || null,
      contact: parsed.data.contact || null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: lookingForTeam.userId,
      set: {
        skills: parsed.data.skills,
        interests: parsed.data.interests || null,
        contact: parsed.data.contact || null,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/hackathon");
}

export async function removeLookingForTeam(): Promise<void> {
  const user_ = await requireUser();
  await db
    .delete(lookingForTeam)
    .where(eq(lookingForTeam.userId, user_.id))
    .catch(() => {});
  revalidatePath("/hackathon");
}

// =====================================================================
// Team chat (group discussion)
// =====================================================================

const teamMessageSchema = z.object({
  teamId: z.string().min(1),
  body: z.string().min(1, "Type something").max(2000),
});

/**
 * Post a chat message to your team. Only members + mods can post.
 */
export async function postTeamMessage(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const parsed = teamMessageSchema.safeParse({
    teamId: formData.get("teamId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { teamId, body } = parsed.data;

  const isMod = user_.role === "admin" || user_.role === "instructor";
  if (!isMod) {
    const member = await db.query.teamMember.findFirst({
      where: eq(teamMember.userId, user_.id),
      columns: { teamId: true },
    });
    if (!member || member.teamId !== teamId) {
      throw new Error("Only team members can post in the team chat");
    }
  }

  await db.insert(teamMessage).values({
    id: createId(),
    teamId,
    authorId: user_.id,
    body: body.trim(),
  });
  revalidatePath(`/hackathon/teams/${teamId}`);
}

const deleteTeamMessageSchema = z.object({
  id: z.string().min(1),
});

/**
 * Delete a team chat message. Authors can delete their own; mods can delete
 * any. Returns silently if the message no longer exists.
 */
export async function deleteTeamMessage(formData: FormData): Promise<void> {
  const user_ = await requireUser();
  const parsed = deleteTeamMessageSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const msg = await db.query.teamMessage.findFirst({
    where: eq(teamMessage.id, parsed.data.id),
    columns: { authorId: true, teamId: true },
  });
  if (!msg) return;

  const isMod = user_.role === "admin" || user_.role === "instructor";
  const isAuthor = msg.authorId === user_.id;
  if (!isMod && !isAuthor) {
    throw new Error("Not allowed");
  }
  await db.delete(teamMessage).where(eq(teamMessage.id, parsed.data.id));
  revalidatePath(`/hackathon/teams/${msg.teamId}`);
}
