"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, requireUser } from "@/lib/auth";

/**
 * Submission + scoring + hackathon config actions.
 *
 * Rules baked in:
 *  - Submission window enforced server-side against HackathonConfig.submitBy.
 *  - One submission per team (unique constraint on Submission.teamId).
 *  - Submissions are locked by default; admin/instructor can unlock.
 *  - Judges score on a 1-10 scale across 4 criteria; one row per (submission, judge).
 */

async function getConfig() {
  return prisma.hackathonConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}

const wokwiUrlOptional = z
  .string()
  .url("Must be a URL")
  .refine(
    (u) => /^https?:\/\/wokwi\.com\//i.test(u),
    "Must be a wokwi.com URL",
  )
  .or(z.literal(""))
  .optional();

const httpsUrlOptional = z
  .string()
  .url("Must be a URL")
  .or(z.literal(""))
  .optional();

// =====================================================================
// Submission — team member triggers it; one per team
// =====================================================================

const submissionSchema = z.object({
  teamId: z.string().min(1),
  title: z.string().min(1, "Title is required").max(120, "Too long"),
  description: z
    .string()
    .min(20, "At least 20 characters so judges have context")
    .max(4000, "Too long"),
  demoVideoUrl: httpsUrlOptional,
  wokwiProjectUrl: wokwiUrlOptional,
  repoUrl: httpsUrlOptional,
});

export async function submitProject(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = submissionSchema.safeParse({
    teamId: formData.get("teamId"),
    title: formData.get("title"),
    description: formData.get("description"),
    demoVideoUrl: formData.get("demoVideoUrl") ?? undefined,
    wokwiProjectUrl: formData.get("wokwiProjectUrl") ?? undefined,
    repoUrl: formData.get("repoUrl") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }

  // Caller must be on the team.
  const member = await prisma.teamMember.findFirst({
    where: { teamId: parsed.data.teamId, userId: user.id },
    select: { id: true },
  });
  if (!member) throw new Error("You aren't on this team.");

  // Deadline check.
  const config = await getConfig();
  if (config.submitBy && new Date() > config.submitBy) {
    throw new Error("The submission deadline has passed.");
  }

  const existing = await prisma.submission.findUnique({
    where: { teamId: parsed.data.teamId },
    select: { id: true, locked: true },
  });

  if (existing && existing.locked) {
    throw new Error(
      "This team has already submitted. Ask an instructor to unlock if you need to edit.",
    );
  }

  const data = {
    title: parsed.data.title,
    description: parsed.data.description,
    demoVideoUrl: parsed.data.demoVideoUrl || null,
    wokwiProjectUrl: parsed.data.wokwiProjectUrl || null,
    repoUrl: parsed.data.repoUrl || null,
    submittedById: user.id,
    locked: true,
  };

  if (existing) {
    await prisma.submission.update({
      where: { id: existing.id },
      data: { ...data, submittedAt: new Date() },
    });
  } else {
    await prisma.submission.create({
      data: { teamId: parsed.data.teamId, ...data },
    });
  }

  revalidatePath(`/hackathon/teams/${parsed.data.teamId}`);
  revalidatePath("/hackathon");
  revalidatePath("/hackathon/leaderboard");
  revalidatePath("/admin/hackathon");
  redirect(`/hackathon/teams/${parsed.data.teamId}`);
}

export async function unlockSubmission(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Missing submission id");
  const sub = await prisma.submission.update({
    where: { id: submissionId },
    data: { locked: false },
    select: { teamId: true },
  });
  revalidatePath(`/hackathon/teams/${sub.teamId}`);
  revalidatePath("/admin/hackathon");
}

export async function lockSubmission(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) throw new Error("Missing submission id");
  const sub = await prisma.submission.update({
    where: { id: submissionId },
    data: { locked: true },
    select: { teamId: true },
  });
  revalidatePath(`/hackathon/teams/${sub.teamId}`);
  revalidatePath("/admin/hackathon");
}

// =====================================================================
// Judging — judge/admin/instructor scores 1-10 on 4 criteria
// =====================================================================

const scoreCriterion = z.coerce.number().int().min(1, "1-10").max(10, "1-10");

const scoreSchema = z.object({
  submissionId: z.string().min(1),
  innovation: scoreCriterion,
  technical: scoreCriterion,
  aiUse: scoreCriterion,
  presentation: scoreCriterion,
  comment: z.string().max(2000).optional(),
});

export async function scoreSubmission(formData: FormData): Promise<void> {
  const judge = await requireRole(["admin", "instructor", "judge"]);
  const parsed = scoreSchema.safeParse({
    submissionId: formData.get("submissionId"),
    innovation: formData.get("innovation"),
    technical: formData.get("technical"),
    aiUse: formData.get("aiUse"),
    presentation: formData.get("presentation"),
    comment: formData.get("comment") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid score");
  }

  await prisma.score.upsert({
    where: {
      submissionId_judgeId: {
        submissionId: parsed.data.submissionId,
        judgeId: judge.id,
      },
    },
    create: {
      submissionId: parsed.data.submissionId,
      judgeId: judge.id,
      innovation: parsed.data.innovation,
      technical: parsed.data.technical,
      aiUse: parsed.data.aiUse,
      presentation: parsed.data.presentation,
      comment: parsed.data.comment || null,
    },
    update: {
      innovation: parsed.data.innovation,
      technical: parsed.data.technical,
      aiUse: parsed.data.aiUse,
      presentation: parsed.data.presentation,
      comment: parsed.data.comment || null,
    },
  });

  revalidatePath(`/admin/hackathon/judge/${parsed.data.submissionId}`);
  revalidatePath("/admin/hackathon/judge");
  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon/leaderboard");
}

// =====================================================================
// Config — admin/instructor updates the singleton row
// =====================================================================

const configSchema = z.object({
  maxTeamSize: z.coerce.number().int().min(1).max(20),
  submitBy: z.string().optional(),
  leaderboardPublic: z.coerce.boolean().default(false),
});

export async function updateHackathonConfig(formData: FormData): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const parsed = configSchema.safeParse({
    maxTeamSize: formData.get("maxTeamSize") ?? 5,
    submitBy: formData.get("submitBy") ?? undefined,
    leaderboardPublic: formData.get("leaderboardPublic") === "on",
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid config");
  }

  let submitBy: Date | null = null;
  if (parsed.data.submitBy && parsed.data.submitBy.trim() !== "") {
    const parsedDate = new Date(parsed.data.submitBy);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error("Invalid date");
    }
    submitBy = parsedDate;
  }

  await prisma.hackathonConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      maxTeamSize: parsed.data.maxTeamSize,
      submitBy,
      leaderboardPublic: parsed.data.leaderboardPublic,
    },
    update: {
      maxTeamSize: parsed.data.maxTeamSize,
      submitBy,
      leaderboardPublic: parsed.data.leaderboardPublic,
    },
  });

  revalidatePath("/admin/hackathon");
  revalidatePath("/hackathon");
  revalidatePath("/hackathon/leaderboard");
}
