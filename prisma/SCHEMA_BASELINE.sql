-- ============================================================
-- Karya Sanga — SCHEMA BASELINE
-- ============================================================
-- Generated: 2026-06-28
-- This file is the full Prisma schema as a single SQL script
-- (every CREATE TABLE / CREATE INDEX / FOREIGN KEY / ENUM).
--
-- USE CASES:
--   1. Bootstrapping a brand-new database from empty
--   2. Sanity-check reference for what the schema looks like
--   3. Onboarding a new dev who wants to see the full DDL
--
-- THIS IS NOT A MIGRATION:
--   The platform uses `prisma db push` (idempotent schema sync)
--   for both dev and production deploys. The prisma/migrations/
--   folder contains historical incremental migrations from the
--   pre-revamp era and is preserved for archival reasons only.
--
-- DEPLOY COMMAND (Vercel):
--   The package.json `vercel-build` script runs:
--     prisma generate && prisma db push --accept-data-loss && next build
--   This is idempotent — schema is already-applied = no-op.
-- ============================================================


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'instructor', 'participant', 'judge');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'archived', 'shipped');

-- CreateEnum
CREATE TYPE "BlogPostType" AS ENUM ('build_update', 'experiment', 'learning', 'shipped', 'question');

-- CreateEnum
CREATE TYPE "ReactionType" AS ENUM ('clap', 'love', 'idea');

-- CreateEnum
CREATE TYPE "WallPostType" AS ENUM ('photo', 'update', 'blog');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'participant',
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" TEXT,
    "bio" TEXT,
    "ageBand" TEXT,
    "dob" TIMESTAMP(3),
    "buildingNow" TEXT,
    "profilePublic" BOOLEAN NOT NULL DEFAULT false,
    "mentorAvailable" BOOLEAN NOT NULL DEFAULT false,
    "cohortId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startedOn" TIMESTAMP(3),
    "endedOn" TIMESTAMP(3),
    "description" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCohort" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "cohortId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortPost" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CohortPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildLogEntry" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "wokwiUrl" TEXT,
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuildLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "tone" TEXT NOT NULL DEFAULT 'primary',
    "category" TEXT NOT NULL DEFAULT 'workshop',
    "selfAward" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "cohortId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarnedBadge" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "badgeId" TEXT NOT NULL,
    "note" TEXT,
    "awardedById" UUID,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnedBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "type" "BlogPostType" NOT NULL DEFAULT 'build_update',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "taggedTeamId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakeItFurtherSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "joinUrl" TEXT,
    "recordingUrl" TEXT,
    "deckUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakeItFurtherSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionRegistration" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowAndTellEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "recordingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowAndTellEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShowAndTellPresenter" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "teamId" TEXT,
    "slotOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowAndTellPresenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeaturedBuilder" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "articleUrl" TEXT,
    "reelUrl" TEXT,
    "blurb" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeaturedBuilder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HackathonConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "cohortId" TEXT,
    "maxTeamSize" INTEGER NOT NULL DEFAULT 5,
    "submitBy" TIMESTAMP(3),
    "leaderboardPublic" BOOLEAN NOT NULL DEFAULT false,
    "wallRequireApproval" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HackathonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "projectTitle" TEXT,
    "projectDescription" TEXT,
    "repoUrl" TEXT,
    "buildLog" TEXT,
    "lookingForMembers" BOOLEAN NOT NULL DEFAULT true,
    "cohortId" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "story" TEXT,
    "architecture" TEXT,
    "heroImagePath" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "featuredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReaction" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMessage" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "demoVideoUrl" TEXT,
    "wokwiProjectUrl" TEXT,
    "repoUrl" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" UUID NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "judgeId" UUID NOT NULL,
    "innovation" INTEGER NOT NULL,
    "technical" INTEGER NOT NULL,
    "aiUse" INTEGER NOT NULL,
    "presentation" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamWokwiLink" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "wokwiProjectUrl" TEXT NOT NULL,
    "addedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamWokwiLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LookingForTeam" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "skills" TEXT NOT NULL,
    "interests" TEXT,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookingForTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WallPost" (
    "id" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "kind" "WallPostType" NOT NULL DEFAULT 'photo',
    "imagePath" TEXT,
    "caption" TEXT,
    "body" TEXT,
    "title" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedById" UUID,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WallPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "type" "ReactionType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WokwiStarter" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "board" TEXT NOT NULL DEFAULT 'esp32',
    "category" TEXT,
    "wokwiProjectUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WokwiStarter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProject" (
    "id" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "wokwiProjectUrl" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopModule" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "wokwiProjectUrl" TEXT,
    "slidesUrl" TEXT,
    "slideFilePath" TEXT,
    "slideFileType" TEXT,
    "slideFileName" TEXT,
    "difficulty" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Progress" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "lessonId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE INDEX "User_cohortId_idx" ON "User"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Cohort_name_key" ON "Cohort"("name");

-- CreateIndex
CREATE INDEX "Cohort_current_idx" ON "Cohort"("current");

-- CreateIndex
CREATE INDEX "Cohort_startedOn_idx" ON "Cohort"("startedOn");

-- CreateIndex
CREATE INDEX "UserCohort_userId_idx" ON "UserCohort"("userId");

-- CreateIndex
CREATE INDEX "UserCohort_cohortId_idx" ON "UserCohort"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCohort_userId_cohortId_key" ON "UserCohort"("userId", "cohortId");

-- CreateIndex
CREATE INDEX "CohortPost_cohortId_pinned_createdAt_idx" ON "CohortPost"("cohortId", "pinned", "createdAt");

-- CreateIndex
CREATE INDEX "BuildLogEntry_teamId_createdAt_idx" ON "BuildLogEntry"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge"("slug");

-- CreateIndex
CREATE INDEX "Badge_category_order_idx" ON "Badge"("category", "order");

-- CreateIndex
CREATE INDEX "Badge_cohortId_idx" ON "Badge"("cohortId");

-- CreateIndex
CREATE INDEX "EarnedBadge_userId_idx" ON "EarnedBadge"("userId");

-- CreateIndex
CREATE INDEX "EarnedBadge_badgeId_idx" ON "EarnedBadge"("badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "EarnedBadge_userId_badgeId_key" ON "EarnedBadge"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "BlogPost_authorId_createdAt_idx" ON "BlogPost"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "BlogPost_type_idx" ON "BlogPost"("type");

-- CreateIndex
CREATE INDEX "BlogPost_isPublic_createdAt_idx" ON "BlogPost"("isPublic", "createdAt");

-- CreateIndex
CREATE INDEX "BlogComment_postId_createdAt_idx" ON "BlogComment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "TakeItFurtherSession_startsAt_idx" ON "TakeItFurtherSession"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SessionRegistration_sessionId_userId_key" ON "SessionRegistration"("sessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ShowAndTellPresenter_eventId_userId_key" ON "ShowAndTellPresenter"("eventId", "userId");

-- CreateIndex
CREATE INDEX "FeaturedBuilder_userId_idx" ON "FeaturedBuilder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedBuilder_yearMonth_key" ON "FeaturedBuilder"("yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "HackathonConfig_cohortId_key" ON "HackathonConfig"("cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Team_lookingForMembers_idx" ON "Team"("lookingForMembers");

-- CreateIndex
CREATE INDEX "Team_cohortId_status_idx" ON "Team"("cohortId", "status");

-- CreateIndex
CREATE INDEX "Team_featured_idx" ON "Team"("featured");

-- CreateIndex
CREATE INDEX "ProjectReaction_teamId_idx" ON "ProjectReaction"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectReaction_teamId_userId_type_key" ON "ProjectReaction"("teamId", "userId", "type");

-- CreateIndex
CREATE INDEX "ProjectComment_teamId_createdAt_idx" ON "ProjectComment"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "TeamMessage_teamId_createdAt_idx" ON "TeamMessage"("teamId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_teamId_key" ON "Submission"("teamId");

-- CreateIndex
CREATE INDEX "Submission_submittedAt_idx" ON "Submission"("submittedAt");

-- CreateIndex
CREATE INDEX "Score_submissionId_idx" ON "Score"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Score_submissionId_judgeId_key" ON "Score"("submissionId", "judgeId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember"("teamId");

-- CreateIndex
CREATE INDEX "TeamWokwiLink_teamId_idx" ON "TeamWokwiLink"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "LookingForTeam_userId_key" ON "LookingForTeam"("userId");

-- CreateIndex
CREATE INDEX "WallPost_approved_createdAt_idx" ON "WallPost"("approved", "createdAt");

-- CreateIndex
CREATE INDEX "WallPost_authorId_idx" ON "WallPost"("authorId");

-- CreateIndex
CREATE INDEX "Reaction_postId_idx" ON "Reaction"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_userId_type_key" ON "Reaction"("postId", "userId", "type");

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WokwiStarter_label_key" ON "WokwiStarter"("label");

-- CreateIndex
CREATE INDEX "WokwiStarter_published_order_idx" ON "WokwiStarter"("published", "order");

-- CreateIndex
CREATE INDEX "SavedProject_ownerId_idx" ON "SavedProject"("ownerId");

-- CreateIndex
CREATE INDEX "Module_order_idx" ON "Module"("order");

-- CreateIndex
CREATE INDEX "WorkshopModule_cohortId_order_idx" ON "WorkshopModule"("cohortId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopModule_cohortId_moduleId_key" ON "WorkshopModule"("cohortId", "moduleId");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson"("moduleId", "order");

-- CreateIndex
CREATE INDEX "Progress_userId_idx" ON "Progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Progress_userId_lessonId_key" ON "Progress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "Conversation_userAId_lastMessageAt_idx" ON "Conversation"("userAId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_userBId_lastMessageAt_idx" ON "Conversation"("userBId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_userAId_userBId_key" ON "Conversation"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCohort" ADD CONSTRAINT "UserCohort_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCohort" ADD CONSTRAINT "UserCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortPost" ADD CONSTRAINT "CohortPost_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortPost" ADD CONSTRAINT "CohortPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLogEntry" ADD CONSTRAINT "BuildLogEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildLogEntry" ADD CONSTRAINT "BuildLogEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_taggedTeamId_fkey" FOREIGN KEY ("taggedTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRegistration" ADD CONSTRAINT "SessionRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TakeItFurtherSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionRegistration" ADD CONSTRAINT "SessionRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ShowAndTellEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeaturedBuilder" ADD CONSTRAINT "FeaturedBuilder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonConfig" ADD CONSTRAINT "HackathonConfig_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReaction" ADD CONSTRAINT "ProjectReaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReaction" ADD CONSTRAINT "ProjectReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamWokwiLink" ADD CONSTRAINT "TeamWokwiLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LookingForTeam" ADD CONSTRAINT "LookingForTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WallPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "WallPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopModule" ADD CONSTRAINT "WorkshopModule_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopModule" ADD CONSTRAINT "WorkshopModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

