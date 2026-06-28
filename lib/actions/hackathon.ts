"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
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
  const cfg = await prisma.hackathonConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
    select: { maxTeamSize: true },
  });
  return cfg.maxTeamSize;
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
  const user = await requireUser();

  // Prevent double-team membership before we touch the DB.
  const existing = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    select: { teamId: true },
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

  // Scope the team to the captain's workshop. The hackathon page filters
  // teams by `Team.cohortId` so without this set the team falls out of every
  // workshop's view. Prefer the user's primary cohortId; fall back to their
  // first secondary membership (when they don't have a primary set yet).
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      cohortId: true,
      workshops: {
        select: { cohortId: true },
        orderBy: { joinedAt: "asc" },
        take: 1,
      },
    },
  });
  const teamCohortId =
    me?.cohortId ?? me?.workshops[0]?.cohortId ?? null;

  // Atomic create-team-and-add-captain.
  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      cohortId: teamCohortId,
      members: {
        create: {
          userId: user.id,
          isCaptain: true,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/hackathon");
  redirect(`/hackathon/teams/${team.id}`);
}

export async function joinTeam(formData: FormData): Promise<void> {
  const user = await requireUser();
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Missing team id");

  const existing = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    select: { teamId: true },
  });
  if (existing) {
    throw new Error("You're already on a team.");
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { _count: { select: { members: true } } },
  });
  if (!team) throw new Error("Team not found");
  if (!team.lookingForMembers) {
    throw new Error("This team isn't accepting new members right now.");
  }
  const maxSize = await getMaxTeamSize();
  if (team._count.members >= maxSize) {
    throw new Error(`Team is full (${maxSize} max).`);
  }

  await prisma.teamMember.create({
    data: { teamId: team.id, userId: user.id },
  });

  // If joining filled the team, flip off "looking for members".
  if (team._count.members + 1 >= maxSize) {
    await prisma.team.update({
      where: { id: team.id },
      data: { lookingForMembers: false },
    });
  }

  // Remove the user's looking-for-team post if they had one.
  await prisma.lookingForTeam
    .delete({ where: { userId: user.id } })
    .catch(() => {});

  revalidatePath("/hackathon");
  redirect(`/hackathon/teams/${team.id}`);
}

export async function leaveTeam(): Promise<void> {
  const user = await requireUser();
  const member = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!member) throw new Error("You aren't on a team.");

  // If you're the last member, delete the team entirely (cascade drops members + links).
  if (member.team._count.members === 1) {
    await prisma.team.delete({ where: { id: member.teamId } });
  } else {
    // If you were captain, promote the next member by joinedAt asc.
    if (member.isCaptain) {
      const next = await prisma.teamMember.findFirst({
        where: { teamId: member.teamId, NOT: { id: member.id } },
        orderBy: { joinedAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await prisma.teamMember.update({
          where: { id: next.id },
          data: { isCaptain: true },
        });
      }
    }
    await prisma.teamMember.delete({ where: { id: member.id } });
    // Team may now have room — make sure it's findable again.
    await prisma.team.update({
      where: { id: member.teamId },
      data: { lookingForMembers: true },
    });
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
  const member = await prisma.teamMember.findFirst({
    where: { userId, teamId },
    select: { id: true, isCaptain: true },
  });
  if (!member) throw new Error("You aren't on this team.");
  return member;
}

export async function updateTeamWorkspace(formData: FormData): Promise<void> {
  const user = await requireUser();
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

  await requireTeamMember(user.id, parsed.data.teamId);

  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: {
      projectTitle: parsed.data.projectTitle || null,
      projectDescription: parsed.data.projectDescription || null,
      repoUrl: parsed.data.repoUrl || null,
      buildLog: parsed.data.buildLog || null,
      lookingForMembers: parsed.data.lookingForMembers,
    },
  });

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
  const user = await requireUser();
  const parsed = wokwiLinkSchema.safeParse({
    teamId: formData.get("teamId"),
    label: formData.get("label"),
    wokwiProjectUrl: formData.get("wokwiProjectUrl"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await requireTeamMember(user.id, parsed.data.teamId);

  await prisma.teamWokwiLink.create({
    data: {
      teamId: parsed.data.teamId,
      label: parsed.data.label,
      wokwiProjectUrl: parsed.data.wokwiProjectUrl,
      addedById: user.id,
    },
  });
  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
}

export async function removeTeamWokwiLink(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  if (!id || !teamId) throw new Error("Missing id");
  await requireTeamMember(user.id, teamId);
  await prisma.teamWokwiLink.delete({ where: { id } });
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
  const user = await requireUser();

  const onTeam = await prisma.teamMember.findUnique({
    where: { userId: user.id },
    select: { id: true },
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

  await prisma.lookingForTeam.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      skills: parsed.data.skills,
      interests: parsed.data.interests || null,
      contact: parsed.data.contact || null,
    },
    update: {
      skills: parsed.data.skills,
      interests: parsed.data.interests || null,
      contact: parsed.data.contact || null,
    },
  });
  revalidatePath("/hackathon");
}

export async function removeLookingForTeam(): Promise<void> {
  const user = await requireUser();
  await prisma.lookingForTeam
    .delete({ where: { userId: user.id } })
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
  const user = await requireUser();
  const parsed = teamMessageSchema.safeParse({
    teamId: formData.get("teamId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const { teamId, body } = parsed.data;

  const isMod = user.role === "admin" || user.role === "instructor";
  if (!isMod) {
    const member = await prisma.teamMember.findUnique({
      where: { userId: user.id },
      select: { teamId: true },
    });
    if (!member || member.teamId !== teamId) {
      throw new Error("Only team members can post in the team chat");
    }
  }

  await prisma.teamMessage.create({
    data: { teamId, authorId: user.id, body: body.trim() },
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
  const user = await requireUser();
  const parsed = deleteTeamMessageSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const msg = await prisma.teamMessage.findUnique({
    where: { id: parsed.data.id },
    select: { authorId: true, teamId: true },
  });
  if (!msg) return;

  const isMod = user.role === "admin" || user.role === "instructor";
  const isAuthor = msg.authorId === user.id;
  if (!isMod && !isAuthor) {
    throw new Error("Not allowed");
  }
  await prisma.teamMessage.delete({ where: { id: parsed.data.id } });
  revalidatePath(`/hackathon/teams/${msg.teamId}`);
}
