"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Instructor-only team management.
 *
 * Difference from `lib/actions/hackathon.ts`:
 *  - These ignore the participant-facing `lookingForMembers` gate; an
 *    instructor can place anyone on any team.
 *  - These still enforce `HackathonConfig.maxTeamSize` (the instructor can
 *    raise it from `/admin/hackathon` if they need more headroom).
 *  - These still enforce "one team per user" (TeamMember.userId is unique).
 *    Moving a user means deleting + recreating, which we do atomically.
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
// Create / rename / delete teams
// =====================================================================

const createWithMembersSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
  /// Comma-separated emails. Trimmed, deduped, lowercased.
  memberEmails: z.string().max(2000).optional(),
  captainEmail: z.string().max(120).optional(),
});

export async function adminCreateTeamWithMembers(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = createWithMembersSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    memberEmails: formData.get("memberEmails") ?? undefined,
    captainEmail: formData.get("captainEmail") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Parse emails — fall back to empty array if blank.
  const emails = Array.from(
    new Set(
      (parsed.data.memberEmails ?? "")
        .split(/[,\n;]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0),
    ),
  );

  const maxSize = await getMaxTeamSize();
  if (emails.length > maxSize) {
    throw new Error(
      `Too many members (${emails.length}) for max team size ${maxSize}.`,
    );
  }

  // Look up all users in one go; flag missing ones for the caller.
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      })
    : [];

  const missing = emails.filter(
    (e) => !users.some((u) => u.email.toLowerCase() === e),
  );
  if (missing.length > 0) {
    throw new Error(
      `No account for: ${missing.join(", ")}. Ask them to sign up first.`,
    );
  }

  // None of these users may already be on a team — keep one-team-per-user.
  if (users.length > 0) {
    const existing = await prisma.teamMember.findMany({
      where: { userId: { in: users.map((u) => u.id) } },
      include: { user: { select: { email: true } } },
    });
    if (existing.length > 0) {
      throw new Error(
        `Already on a team: ${existing.map((m) => m.user.email).join(", ")}. Remove them first.`,
      );
    }
  }

  // Decide captain — explicit, else first listed, else nobody.
  const captainEmail = parsed.data.captainEmail?.trim().toLowerCase() || null;
  const captainUserId = captainEmail
    ? users.find((u) => u.email.toLowerCase() === captainEmail)?.id ?? null
    : (users[0]?.id ?? null);
  if (captainEmail && !captainUserId) {
    throw new Error(`Captain ${captainEmail} isn't in the member list.`);
  }

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      lookingForMembers: users.length < maxSize,
      members: {
        create: users.map((u) => ({
          userId: u.id,
          isCaptain: u.id === captainUserId,
        })),
      },
    },
    select: { id: true },
  });

  // Clear any "looking for team" posts for placed users.
  if (users.length > 0) {
    await prisma.lookingForTeam.deleteMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
  }

  revalidatePath("/admin/hackathon");
  revalidatePath("/admin/hackathon/teams");
  revalidatePath("/hackathon");
  redirect(`/admin/hackathon/teams?team=${team.id}#team-${team.id}`);
}

const renameSchema = z.object({
  teamId: z.string().min(1),
  name: z.string().min(2).max(60),
  description: z.string().max(280).optional(),
});

export async function adminRenameTeam(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = renameSchema.safeParse({
    teamId: formData.get("teamId"),
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  await prisma.team.update({
    where: { id: parsed.data.teamId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
  revalidatePath("/hackathon");
}

export async function adminDeleteTeam(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Missing team id");
  // Cascade drops TeamMember + TeamWokwiLink + Submission rows.
  await prisma.team.delete({ where: { id: teamId } });
  revalidatePath("/admin/hackathon/teams");
  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon");
}

// =====================================================================
// Add / remove / move members
// =====================================================================

const addMemberSchema = z.object({
  teamId: z.string().min(1),
  /// Solo participants picked by id from a select; we look up the user.
  userId: z.string().uuid("Pick a user"),
});

export async function adminAddMember(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = addMemberSchema.safeParse({
    teamId: formData.get("teamId"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Make sure the team exists and check capacity.
  const team = await prisma.team.findUnique({
    where: { id: parsed.data.teamId },
    include: { _count: { select: { members: true } } },
  });
  if (!team) throw new Error("Team not found");

  const maxSize = await getMaxTeamSize();
  if (team._count.members >= maxSize) {
    throw new Error(
      `Team is at the limit (${maxSize}). Bump the max in settings or remove someone first.`,
    );
  }

  // User must not already be on a team.
  const existing = await prisma.teamMember.findUnique({
    where: { userId: parsed.data.userId },
    select: { teamId: true },
  });
  if (existing) {
    throw new Error(
      existing.teamId === parsed.data.teamId
        ? "That participant is already on this team."
        : "That participant is already on another team. Remove them from it first.",
    );
  }

  await prisma.teamMember.create({
    data: {
      teamId: parsed.data.teamId,
      userId: parsed.data.userId,
    },
  });

  // Once added, auto-flip team off "open" if it just filled up.
  if (team._count.members + 1 >= maxSize) {
    await prisma.team.update({
      where: { id: team.id },
      data: { lookingForMembers: false },
    });
  }

  // Remove any "looking for team" post they had.
  await prisma.lookingForTeam
    .delete({ where: { userId: parsed.data.userId } })
    .catch(() => {});

  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
  revalidatePath("/hackathon");
}

const removeMemberSchema = z.object({
  memberId: z.string().min(1),
});

export async function adminRemoveMember(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = removeMemberSchema.safeParse({
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) throw new Error("Missing member id");

  const member = await prisma.teamMember.findUnique({
    where: { id: parsed.data.memberId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!member) throw new Error("Member not found");

  if (member.team._count.members === 1) {
    // Removing the last member deletes the team entirely.
    await prisma.team.delete({ where: { id: member.teamId } });
  } else {
    if (member.isCaptain) {
      // Promote the next-oldest member.
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
    // Team has room again — make it discoverable.
    await prisma.team.update({
      where: { id: member.teamId },
      data: { lookingForMembers: true },
    });
  }

  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${member.teamId}`);
  revalidatePath("/hackathon");
}

const moveSchema = z.object({
  memberId: z.string().min(1),
  toTeamId: z.string().min(1),
});

export async function adminMoveMember(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = moveSchema.safeParse({
    memberId: formData.get("memberId"),
    toTeamId: formData.get("toTeamId"),
  });
  if (!parsed.success) throw new Error("Invalid input");

  const member = await prisma.teamMember.findUnique({
    where: { id: parsed.data.memberId },
    include: { team: { include: { _count: { select: { members: true } } } } },
  });
  if (!member) throw new Error("Member not found");
  if (member.teamId === parsed.data.toTeamId) return; // no-op

  const destination = await prisma.team.findUnique({
    where: { id: parsed.data.toTeamId },
    include: { _count: { select: { members: true } } },
  });
  if (!destination) throw new Error("Destination team not found");

  const maxSize = await getMaxTeamSize();
  if (destination._count.members >= maxSize) {
    throw new Error(`Destination team is at the limit (${maxSize}).`);
  }

  const fromTeamId = member.teamId;
  const fromWasLast = member.team._count.members === 1;

  await prisma.$transaction(async (tx) => {
    // If captain was leaving and team has others, promote the next oldest.
    if (member.isCaptain && !fromWasLast) {
      const next = await tx.teamMember.findFirst({
        where: { teamId: fromTeamId, NOT: { id: member.id } },
        orderBy: { joinedAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.teamMember.update({
          where: { id: next.id },
          data: { isCaptain: true },
        });
      }
    }

    // Re-point the membership. We do an update rather than delete+create to
    // preserve the `joinedAt` timestamp and the unique-userId constraint.
    await tx.teamMember.update({
      where: { id: member.id },
      data: {
        teamId: parsed.data.toTeamId,
        isCaptain: false,
      },
    });

    // If origin team is now empty, delete it.
    if (fromWasLast) {
      await tx.team.delete({ where: { id: fromTeamId } });
    } else {
      await tx.team.update({
        where: { id: fromTeamId },
        data: { lookingForMembers: true },
      });
    }

    // Destination may now be full → auto-close it.
    if (destination._count.members + 1 >= maxSize) {
      await tx.team.update({
        where: { id: parsed.data.toTeamId },
        data: { lookingForMembers: false },
      });
    }
  });

  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${fromTeamId}`);
  revalidatePath(`/hackathon/teams/${parsed.data.toTeamId}`);
  revalidatePath("/hackathon");
}

const transferSchema = z.object({
  memberId: z.string().min(1),
});

export async function adminTransferCaptain(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = transferSchema.safeParse({
    memberId: formData.get("memberId"),
  });
  if (!parsed.success) throw new Error("Missing member id");

  const member = await prisma.teamMember.findUnique({
    where: { id: parsed.data.memberId },
    select: { id: true, teamId: true, isCaptain: true },
  });
  if (!member) throw new Error("Member not found");
  if (member.isCaptain) return; // no-op

  await prisma.$transaction([
    prisma.teamMember.updateMany({
      where: { teamId: member.teamId, isCaptain: true },
      data: { isCaptain: false },
    }),
    prisma.teamMember.update({
      where: { id: member.id },
      data: { isCaptain: true },
    }),
  ]);

  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${member.teamId}`);
}

// =====================================================================
// Per-workshop hackathon config
// =====================================================================

const workshopConfigSchema = z.object({
  cohortId: z.string().min(1),
  maxTeamSize: z.coerce.number().int().min(1).max(20),
  submitBy: z.string().optional(),
  leaderboardPublic: z.string().optional(),
  wallRequireApproval: z.string().optional(),
});

/**
 * Set (upsert) the hackathon config for a specific workshop. Falls back to
 * the global default if a workshop has no override.
 */
export async function setWorkshopHackathonConfig(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = workshopConfigSchema.safeParse({
    cohortId: formData.get("cohortId"),
    maxTeamSize: formData.get("maxTeamSize"),
    submitBy: formData.get("submitBy") ?? undefined,
    leaderboardPublic: formData.get("leaderboardPublic") ?? undefined,
    wallRequireApproval: formData.get("wallRequireApproval") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // datetime-local input gives "YYYY-MM-DDTHH:mm" — empty string clears.
  const submitBy = parsed.data.submitBy
    ? new Date(parsed.data.submitBy)
    : null;

  await prisma.hackathonConfig.upsert({
    where: { cohortId: parsed.data.cohortId },
    create: {
      cohortId: parsed.data.cohortId,
      maxTeamSize: parsed.data.maxTeamSize,
      submitBy,
      leaderboardPublic: parsed.data.leaderboardPublic === "on",
      wallRequireApproval: parsed.data.wallRequireApproval === "on",
    },
    update: {
      maxTeamSize: parsed.data.maxTeamSize,
      submitBy,
      leaderboardPublic: parsed.data.leaderboardPublic === "on",
      wallRequireApproval: parsed.data.wallRequireApproval === "on",
    },
  });

  revalidatePath(`/admin/cohorts/${parsed.data.cohortId}`);
  revalidatePath(`/cohorts/${parsed.data.cohortId}`);
  revalidatePath("/hackathon");
}

/**
 * Remove the per-workshop config — workshop reverts to global default.
 */
export async function clearWorkshopHackathonConfig(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const cohortId = String(formData.get("cohortId") ?? "");
  if (!cohortId) throw new Error("Missing workshop");
  await prisma.hackathonConfig
    .delete({ where: { cohortId } })
    .catch(() => {});
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/hackathon");
}
