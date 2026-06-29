"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import {
  db,
  hackathonConfig,
  team,
  teamMember,
  lookingForTeam,
  user,
} from "@/lib/db";
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
    ? await db.query.user.findMany({
        where: inArray(user.email, emails),
        columns: { id: true, email: true },
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
    const existing = await db.query.teamMember.findMany({
      where: inArray(
        teamMember.userId,
        users.map((u) => u.id),
      ),
      with: { user: { columns: { email: true } } },
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

  const teamId = createId();
  await db.transaction(async (tx) => {
    await tx.insert(team).values({
      id: teamId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      lookingForMembers: users.length < maxSize,
      updatedAt: new Date(),
    });
    if (users.length > 0) {
      await tx.insert(teamMember).values(
        users.map((u) => ({
          id: createId(),
          teamId,
          userId: u.id,
          isCaptain: u.id === captainUserId,
        })),
      );
    }
  });

  // Clear any "looking for team" posts for placed users.
  if (users.length > 0) {
    await db.delete(lookingForTeam).where(
      inArray(
        lookingForTeam.userId,
        users.map((u) => u.id),
      ),
    );
  }

  revalidatePath("/admin/hackathon");
  revalidatePath("/admin/hackathon/teams");
  revalidatePath("/hackathon");
  redirect(`/admin/hackathon/teams?team=${teamId}#team-${teamId}`);
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
  await db
    .update(team)
    .set({
      name: parsed.data.name,
      description: parsed.data.description || null,
      updatedAt: new Date(),
    })
    .where(eq(team.id, parsed.data.teamId));
  revalidatePath("/admin/hackathon/teams");
  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
  revalidatePath("/hackathon");
}

export async function adminDeleteTeam(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const teamId = String(formData.get("teamId") ?? "");
  if (!teamId) throw new Error("Missing team id");
  // Cascade drops TeamMember + TeamWokwiLink + Submission rows.
  await db.delete(team).where(eq(team.id, teamId));
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
  const teamRow = await db.query.team.findFirst({
    where: eq(team.id, parsed.data.teamId),
  });
  if (!teamRow) throw new Error("Team not found");

  const memberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, teamRow.id),
  );

  const maxSize = await getMaxTeamSize();
  if (memberCount >= maxSize) {
    throw new Error(
      `Team is at the limit (${maxSize}). Bump the max in settings or remove someone first.`,
    );
  }

  // User must not already be on a team.
  const existing = await db.query.teamMember.findFirst({
    where: eq(teamMember.userId, parsed.data.userId),
    columns: { teamId: true },
  });
  if (existing) {
    throw new Error(
      existing.teamId === parsed.data.teamId
        ? "That participant is already on this team."
        : "That participant is already on another team. Remove them from it first.",
    );
  }

  await db.insert(teamMember).values({
    id: createId(),
    teamId: parsed.data.teamId,
    userId: parsed.data.userId,
  });

  // Once added, auto-flip team off "open" if it just filled up.
  if (memberCount + 1 >= maxSize) {
    await db
      .update(team)
      .set({ lookingForMembers: false, updatedAt: new Date() })
      .where(eq(team.id, teamRow.id));
  }

  // Remove any "looking for team" post they had.
  await db
    .delete(lookingForTeam)
    .where(eq(lookingForTeam.userId, parsed.data.userId))
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

  const member = await db.query.teamMember.findFirst({
    where: eq(teamMember.id, parsed.data.memberId),
    with: { team: true },
  });
  if (!member) throw new Error("Member not found");

  const memberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, member.teamId),
  );

  if (memberCount === 1) {
    // Removing the last member deletes the team entirely.
    await db.delete(team).where(eq(team.id, member.teamId));
  } else {
    if (member.isCaptain) {
      // Promote the next-oldest member.
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
    // Team has room again — make it discoverable.
    await db
      .update(team)
      .set({ lookingForMembers: true, updatedAt: new Date() })
      .where(eq(team.id, member.teamId));
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

  const member = await db.query.teamMember.findFirst({
    where: eq(teamMember.id, parsed.data.memberId),
    with: { team: true },
  });
  if (!member) throw new Error("Member not found");
  if (member.teamId === parsed.data.toTeamId) return; // no-op

  const fromMemberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, member.teamId),
  );

  const destination = await db.query.team.findFirst({
    where: eq(team.id, parsed.data.toTeamId),
  });
  if (!destination) throw new Error("Destination team not found");

  const destMemberCount = await db.$count(
    teamMember,
    eq(teamMember.teamId, destination.id),
  );

  const maxSize = await getMaxTeamSize();
  if (destMemberCount >= maxSize) {
    throw new Error(`Destination team is at the limit (${maxSize}).`);
  }

  const fromTeamId = member.teamId;
  const fromWasLast = fromMemberCount === 1;

  await db.transaction(async (tx) => {
    // If captain was leaving and team has others, promote the next oldest.
    if (member.isCaptain && !fromWasLast) {
      const next = await tx.query.teamMember.findFirst({
        where: and(
          eq(teamMember.teamId, fromTeamId),
          ne(teamMember.id, member.id),
        ),
        orderBy: [asc(teamMember.joinedAt)],
        columns: { id: true },
      });
      if (next) {
        await tx
          .update(teamMember)
          .set({ isCaptain: true })
          .where(eq(teamMember.id, next.id));
      }
    }

    // Re-point the membership. We do an update rather than delete+create to
    // preserve the `joinedAt` timestamp and the unique-userId constraint.
    await tx
      .update(teamMember)
      .set({
        teamId: parsed.data.toTeamId,
        isCaptain: false,
      })
      .where(eq(teamMember.id, member.id));

    // If origin team is now empty, delete it.
    if (fromWasLast) {
      await tx.delete(team).where(eq(team.id, fromTeamId));
    } else {
      await tx
        .update(team)
        .set({ lookingForMembers: true, updatedAt: new Date() })
        .where(eq(team.id, fromTeamId));
    }

    // Destination may now be full → auto-close it.
    if (destMemberCount + 1 >= maxSize) {
      await tx
        .update(team)
        .set({ lookingForMembers: false, updatedAt: new Date() })
        .where(eq(team.id, parsed.data.toTeamId));
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

  const member = await db.query.teamMember.findFirst({
    where: eq(teamMember.id, parsed.data.memberId),
    columns: { id: true, teamId: true, isCaptain: true },
  });
  if (!member) throw new Error("Member not found");
  if (member.isCaptain) return; // no-op

  await db.transaction(async (tx) => {
    await tx
      .update(teamMember)
      .set({ isCaptain: false })
      .where(
        and(
          eq(teamMember.teamId, member.teamId),
          eq(teamMember.isCaptain, true),
        ),
      );
    await tx
      .update(teamMember)
      .set({ isCaptain: true })
      .where(eq(teamMember.id, member.id));
  });

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

  await db
    .insert(hackathonConfig)
    .values({
      id: createId(),
      cohortId: parsed.data.cohortId,
      maxTeamSize: parsed.data.maxTeamSize,
      submitBy,
      leaderboardPublic: parsed.data.leaderboardPublic === "on",
      wallRequireApproval: parsed.data.wallRequireApproval === "on",
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: hackathonConfig.cohortId,
      set: {
        maxTeamSize: parsed.data.maxTeamSize,
        submitBy,
        leaderboardPublic: parsed.data.leaderboardPublic === "on",
        wallRequireApproval: parsed.data.wallRequireApproval === "on",
        updatedAt: new Date(),
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
  await db
    .delete(hackathonConfig)
    .where(eq(hackathonConfig.cohortId, cohortId))
    .catch(() => {});
  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath("/hackathon");
}
