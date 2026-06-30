-- 0000 — full schema baseline (snapshot of every table/enum/index/FK).
-- Auto-generated from lib/db/schema.ts via: npx drizzle-kit export
-- Run this ALONE to provision a fresh database. Existing DBs are already
-- at this state; the numbered migrations (0001+) are the incremental
-- change-log on top of an earlier version of this baseline.

CREATE TYPE "public"."BlogPostType" AS ENUM('build_update', 'experiment', 'learning', 'shipped', 'question');
CREATE TYPE "public"."ProjectStatus" AS ENUM('active', 'archived', 'shipped');
CREATE TYPE "public"."ReactionType" AS ENUM('clap', 'love', 'idea');
CREATE TYPE "public"."Role" AS ENUM('admin', 'instructor', 'participant', 'judge');
CREATE TYPE "public"."WallPostType" AS ENUM('photo', 'update', 'blog');
CREATE TABLE "Badge" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"criteria" text NOT NULL,
	"icon" text NOT NULL,
	"tone" text DEFAULT 'primary' NOT NULL,
	"category" text DEFAULT 'workshop' NOT NULL,
	"selfAward" boolean DEFAULT false NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"cohortId" text
);

CREATE TABLE "BlogComment" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "BlogPost" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" uuid NOT NULL,
	"type" "BlogPostType" DEFAULT 'build_update' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"taggedTeamId" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"removed" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "BuildLogEntry" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"wokwiUrl" text,
	"imagePath" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "Cohort" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"startedOn" timestamp (3),
	"endedOn" timestamp (3),
	"description" text,
	"current" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"ownerId" uuid
);

CREATE TABLE "CohortPost" (
	"id" text PRIMARY KEY NOT NULL,
	"cohortId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "Comment" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

ALTER TABLE "Comment" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "Conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"userAId" uuid NOT NULL,
	"userBId" uuid NOT NULL,
	"lastMessageAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "DirectMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"conversationId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"readAt" timestamp (3)
);

CREATE TABLE "EarnedBadge" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"badgeId" text NOT NULL,
	"cohortId" text,
	"note" text,
	"awardedById" uuid,
	"earnedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "FeaturedBuilder" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"yearMonth" text NOT NULL,
	"articleUrl" text,
	"reelUrl" text,
	"blurb" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "HackathonConfig" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"maxTeamSize" integer DEFAULT 5 NOT NULL,
	"submitBy" timestamp (3),
	"leaderboardPublic" boolean DEFAULT false NOT NULL,
	"wallRequireApproval" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"cohortId" text
);

CREATE TABLE "Lesson" (
	"id" text PRIMARY KEY NOT NULL,
	"moduleId" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text DEFAULT '' NOT NULL,
	"wokwiProjectUrl" text,
	"slidesUrl" text,
	"slideFilePath" text,
	"slideFileType" text,
	"slideFileName" text,
	"difficulty" text,
	"order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "LookingForTeam" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"skills" text NOT NULL,
	"interests" text,
	"contact" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "Module" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "Progress" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"lessonId" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "ProjectComment" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "ProjectReaction" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" uuid NOT NULL,
	"type" "ReactionType" NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "Reaction" (
	"id" text PRIMARY KEY NOT NULL,
	"postId" text NOT NULL,
	"userId" uuid NOT NULL,
	"type" "ReactionType" NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE "Reaction" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "SavedProject" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerId" uuid NOT NULL,
	"name" text NOT NULL,
	"wokwiProjectUrl" text NOT NULL,
	"notes" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "Score" (
	"id" text PRIMARY KEY NOT NULL,
	"submissionId" text NOT NULL,
	"judgeId" uuid NOT NULL,
	"innovation" integer NOT NULL,
	"technical" integer NOT NULL,
	"aiUse" integer NOT NULL,
	"presentation" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "SessionRegistration" (
	"id" text PRIMARY KEY NOT NULL,
	"sessionId" text NOT NULL,
	"userId" uuid NOT NULL,
	"registeredAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ShowAndTellEvent" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"scheduledAt" timestamp (3) NOT NULL,
	"description" text,
	"recordingUrl" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ShowAndTellPresenter" (
	"id" text PRIMARY KEY NOT NULL,
	"eventId" text NOT NULL,
	"userId" uuid NOT NULL,
	"teamId" text,
	"slotOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "Submission" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"demoVideoUrl" text,
	"wokwiProjectUrl" text,
	"repoUrl" text,
	"submittedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"submittedById" uuid NOT NULL,
	"locked" boolean DEFAULT true NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "TakeItFurtherSession" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"startsAt" timestamp (3) NOT NULL,
	"durationMin" integer DEFAULT 60 NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"joinUrl" text,
	"recordingUrl" text,
	"deckUrl" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "Team" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"projectTitle" text,
	"projectDescription" text,
	"repoUrl" text,
	"buildLog" text,
	"lookingForMembers" boolean DEFAULT true NOT NULL,
	"cohortId" text,
	"status" "ProjectStatus" DEFAULT 'active' NOT NULL,
	"story" text,
	"architecture" text,
	"heroImagePath" text,
	"tags" text[] DEFAULT '{"RAY"}',
	"featured" boolean DEFAULT false NOT NULL,
	"featuredAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"mediaUrls" text[] DEFAULT '{"RAY"}'
);

CREATE TABLE "TeamMember" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"userId" uuid NOT NULL,
	"isCaptain" boolean DEFAULT false NOT NULL,
	"joinedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "TeamMessage" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"authorId" uuid NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "TeamWokwiLink" (
	"id" text PRIMARY KEY NOT NULL,
	"teamId" text NOT NULL,
	"label" text NOT NULL,
	"wokwiProjectUrl" text NOT NULL,
	"addedById" uuid NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "User" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "Role" DEFAULT 'participant' NOT NULL,
	"avatarUrl" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"handle" text,
	"bio" text,
	"ageBand" text,
	"buildingNow" text,
	"profilePublic" boolean DEFAULT false NOT NULL,
	"mentorAvailable" boolean DEFAULT false NOT NULL,
	"cohortId" text,
	"dob" timestamp (3)
);

CREATE TABLE "UserCohort" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" uuid NOT NULL,
	"cohortId" text NOT NULL,
	"joinedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "WallPost" (
	"id" text PRIMARY KEY NOT NULL,
	"authorId" uuid NOT NULL,
	"imagePath" text,
	"caption" text,
	"tags" text[] DEFAULT '{"RAY"}',
	"approved" boolean DEFAULT false NOT NULL,
	"approvedAt" timestamp (3),
	"approvedById" uuid,
	"rejected" boolean DEFAULT false NOT NULL,
	"rejectionReason" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	"body" text,
	"kind" "WallPostType" DEFAULT 'photo' NOT NULL,
	"title" text,
	"mediaUrls" text[] DEFAULT '{"RAY"}'
);

ALTER TABLE "WallPost" ENABLE ROW LEVEL SECURITY;
CREATE TABLE "WokwiStarter" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"board" text DEFAULT 'esp32' NOT NULL,
	"category" text,
	"wokwiProjectUrl" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "WorkshopFeedback" (
	"id" text PRIMARY KEY NOT NULL,
	"cohortId" text NOT NULL,
	"userId" uuid NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);

CREATE TABLE "WorkshopModule" (
	"id" text PRIMARY KEY NOT NULL,
	"cohortId" text NOT NULL,
	"moduleId" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE "Badge" ADD CONSTRAINT "Badge_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "BlogComment" ADD CONSTRAINT "BlogComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."BlogPost"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_taggedTeamId_fkey" FOREIGN KEY ("taggedTeamId") REFERENCES "public"."Team"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "BuildLogEntry" ADD CONSTRAINT "BuildLogEntry_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "BuildLogEntry" ADD CONSTRAINT "BuildLogEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "CohortPost" ADD CONSTRAINT "CohortPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "CohortPost" ADD CONSTRAINT "CohortPost_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."WallPost"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."Badge"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "EarnedBadge" ADD CONSTRAINT "EarnedBadge_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "FeaturedBuilder" ADD CONSTRAINT "FeaturedBuilder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "HackathonConfig" ADD CONSTRAINT "HackathonConfig_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."Module"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "LookingForTeam" ADD CONSTRAINT "LookingForTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "public"."Lesson"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Progress" ADD CONSTRAINT "Progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ProjectReaction" ADD CONSTRAINT "ProjectReaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ProjectReaction" ADD CONSTRAINT "ProjectReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."WallPost"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "SavedProject" ADD CONSTRAINT "SavedProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Score" ADD CONSTRAINT "Score_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Score" ADD CONSTRAINT "Score_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "public"."Submission"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "SessionRegistration" ADD CONSTRAINT "SessionRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."TakeItFurtherSession"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "SessionRegistration" ADD CONSTRAINT "SessionRegistration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "public"."ShowAndTellEvent"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "ShowAndTellPresenter" ADD CONSTRAINT "ShowAndTellPresenter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "Team" ADD CONSTRAINT "Team_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "TeamMessage" ADD CONSTRAINT "TeamMessage_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "TeamWokwiLink" ADD CONSTRAINT "TeamWokwiLink_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "User" ADD CONSTRAINT "User_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "UserCohort" ADD CONSTRAINT "UserCohort_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "UserCohort" ADD CONSTRAINT "UserCohort_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE cascade;
ALTER TABLE "WallPost" ADD CONSTRAINT "WallPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "WorkshopFeedback" ADD CONSTRAINT "WorkshopFeedback_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "WorkshopFeedback" ADD CONSTRAINT "WorkshopFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "WorkshopModule" ADD CONSTRAINT "WorkshopModule_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "public"."Cohort"("id") ON DELETE cascade ON UPDATE cascade;
ALTER TABLE "WorkshopModule" ADD CONSTRAINT "WorkshopModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "public"."Module"("id") ON DELETE cascade ON UPDATE cascade;
CREATE INDEX "Badge_category_order_idx" ON "Badge" USING btree ("category" text_ops,"order" int4_ops);
CREATE INDEX "Badge_cohortId_idx" ON "Badge" USING btree ("cohortId" text_ops);
CREATE UNIQUE INDEX "Badge_slug_key" ON "Badge" USING btree ("slug" text_ops);
CREATE INDEX "BlogComment_postId_createdAt_idx" ON "BlogComment" USING btree ("postId" text_ops,"createdAt" text_ops);
CREATE INDEX "BlogPost_authorId_createdAt_idx" ON "BlogPost" USING btree ("authorId" timestamp_ops,"createdAt" uuid_ops);
CREATE INDEX "BlogPost_isPublic_createdAt_idx" ON "BlogPost" USING btree ("isPublic" bool_ops,"createdAt" timestamp_ops);
CREATE INDEX "BlogPost_type_idx" ON "BlogPost" USING btree ("type" enum_ops);
CREATE INDEX "BuildLogEntry_teamId_createdAt_idx" ON "BuildLogEntry" USING btree ("teamId" text_ops,"createdAt" text_ops);
CREATE INDEX "Cohort_current_idx" ON "Cohort" USING btree ("current" bool_ops);
CREATE UNIQUE INDEX "Cohort_name_key" ON "Cohort" USING btree ("name" text_ops);
CREATE INDEX "Cohort_startedOn_idx" ON "Cohort" USING btree ("startedOn" timestamp_ops);
CREATE INDEX "Cohort_ownerId_idx" ON "Cohort" USING btree ("ownerId" uuid_ops);
CREATE INDEX "CohortPost_cohortId_pinned_createdAt_idx" ON "CohortPost" USING btree ("cohortId" text_ops,"pinned" bool_ops,"createdAt" bool_ops);
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment" USING btree ("postId" text_ops,"createdAt" text_ops);
CREATE INDEX "Conversation_userAId_lastMessageAt_idx" ON "Conversation" USING btree ("userAId" timestamp_ops,"lastMessageAt" timestamp_ops);
CREATE UNIQUE INDEX "Conversation_userAId_userBId_key" ON "Conversation" USING btree ("userAId" uuid_ops,"userBId" uuid_ops);
CREATE INDEX "Conversation_userBId_lastMessageAt_idx" ON "Conversation" USING btree ("userBId" uuid_ops,"lastMessageAt" timestamp_ops);
CREATE INDEX "DirectMessage_conversationId_createdAt_idx" ON "DirectMessage" USING btree ("conversationId" text_ops,"createdAt" text_ops);
CREATE INDEX "EarnedBadge_badgeId_idx" ON "EarnedBadge" USING btree ("badgeId" text_ops);
CREATE INDEX "EarnedBadge_userId_idx" ON "EarnedBadge" USING btree ("userId" uuid_ops);
CREATE INDEX "EarnedBadge_cohortId_idx" ON "EarnedBadge" USING btree ("cohortId" text_ops);
CREATE INDEX "FeaturedBuilder_userId_idx" ON "FeaturedBuilder" USING btree ("userId" uuid_ops);
CREATE UNIQUE INDEX "FeaturedBuilder_yearMonth_key" ON "FeaturedBuilder" USING btree ("yearMonth" text_ops);
CREATE UNIQUE INDEX "HackathonConfig_cohortId_key" ON "HackathonConfig" USING btree ("cohortId" text_ops);
CREATE INDEX "Lesson_moduleId_order_idx" ON "Lesson" USING btree ("moduleId" int4_ops,"order" int4_ops);
CREATE UNIQUE INDEX "LookingForTeam_userId_key" ON "LookingForTeam" USING btree ("userId" uuid_ops);
CREATE INDEX "Module_order_idx" ON "Module" USING btree ("order" int4_ops);
CREATE INDEX "Progress_userId_idx" ON "Progress" USING btree ("userId" uuid_ops);
CREATE UNIQUE INDEX "Progress_userId_lessonId_key" ON "Progress" USING btree ("userId" text_ops,"lessonId" text_ops);
CREATE INDEX "ProjectComment_teamId_createdAt_idx" ON "ProjectComment" USING btree ("teamId" text_ops,"createdAt" text_ops);
CREATE INDEX "ProjectReaction_teamId_idx" ON "ProjectReaction" USING btree ("teamId" text_ops);
CREATE UNIQUE INDEX "ProjectReaction_teamId_userId_type_key" ON "ProjectReaction" USING btree ("teamId" text_ops,"userId" text_ops,"type" text_ops);
CREATE INDEX "Reaction_postId_idx" ON "Reaction" USING btree ("postId" text_ops);
CREATE UNIQUE INDEX "Reaction_postId_userId_type_key" ON "Reaction" USING btree ("postId" text_ops,"userId" text_ops,"type" text_ops);
CREATE INDEX "SavedProject_ownerId_idx" ON "SavedProject" USING btree ("ownerId" uuid_ops);
CREATE INDEX "Score_submissionId_idx" ON "Score" USING btree ("submissionId" text_ops);
CREATE UNIQUE INDEX "Score_submissionId_judgeId_key" ON "Score" USING btree ("submissionId" text_ops,"judgeId" text_ops);
CREATE UNIQUE INDEX "SessionRegistration_sessionId_userId_key" ON "SessionRegistration" USING btree ("sessionId" text_ops,"userId" text_ops);
CREATE UNIQUE INDEX "ShowAndTellPresenter_eventId_userId_key" ON "ShowAndTellPresenter" USING btree ("eventId" text_ops,"userId" text_ops);
CREATE INDEX "Submission_submittedAt_idx" ON "Submission" USING btree ("submittedAt" timestamp_ops);
CREATE UNIQUE INDEX "Submission_teamId_key" ON "Submission" USING btree ("teamId" text_ops);
CREATE INDEX "TakeItFurtherSession_startsAt_idx" ON "TakeItFurtherSession" USING btree ("startsAt" timestamp_ops);
CREATE INDEX "Team_cohortId_status_idx" ON "Team" USING btree ("cohortId" enum_ops,"status" enum_ops);
CREATE INDEX "Team_featured_idx" ON "Team" USING btree ("featured" bool_ops);
CREATE INDEX "Team_lookingForMembers_idx" ON "Team" USING btree ("lookingForMembers" bool_ops);
CREATE UNIQUE INDEX "Team_name_key" ON "Team" USING btree ("name" text_ops);
CREATE INDEX "TeamMember_teamId_idx" ON "TeamMember" USING btree ("teamId" text_ops);
CREATE UNIQUE INDEX "TeamMember_userId_key" ON "TeamMember" USING btree ("userId" uuid_ops);
CREATE INDEX "TeamMessage_teamId_createdAt_idx" ON "TeamMessage" USING btree ("teamId" text_ops,"createdAt" text_ops);
CREATE INDEX "TeamWokwiLink_teamId_idx" ON "TeamWokwiLink" USING btree ("teamId" text_ops);
CREATE INDEX "User_cohortId_idx" ON "User" USING btree ("cohortId" text_ops);
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email" text_ops);
CREATE INDEX "User_handle_idx" ON "User" USING btree ("handle" text_ops);
CREATE UNIQUE INDEX "User_handle_key" ON "User" USING btree ("handle" text_ops);
CREATE INDEX "UserCohort_cohortId_idx" ON "UserCohort" USING btree ("cohortId" text_ops);
CREATE UNIQUE INDEX "UserCohort_userId_cohortId_key" ON "UserCohort" USING btree ("userId" text_ops,"cohortId" uuid_ops);
CREATE INDEX "UserCohort_userId_idx" ON "UserCohort" USING btree ("userId" uuid_ops);
CREATE INDEX "WallPost_approved_createdAt_idx" ON "WallPost" USING btree ("approved" timestamp_ops,"createdAt" timestamp_ops);
CREATE INDEX "WallPost_authorId_idx" ON "WallPost" USING btree ("authorId" uuid_ops);
CREATE UNIQUE INDEX "WokwiStarter_label_key" ON "WokwiStarter" USING btree ("label" text_ops);
CREATE INDEX "WokwiStarter_published_order_idx" ON "WokwiStarter" USING btree ("published" int4_ops,"order" int4_ops);
CREATE UNIQUE INDEX "WorkshopFeedback_cohortId_userId_key" ON "WorkshopFeedback" USING btree ("cohortId" text_ops,"userId" uuid_ops);
CREATE INDEX "WorkshopFeedback_cohortId_idx" ON "WorkshopFeedback" USING btree ("cohortId" text_ops);
CREATE UNIQUE INDEX "WorkshopModule_cohortId_moduleId_key" ON "WorkshopModule" USING btree ("cohortId" text_ops,"moduleId" text_ops);
CREATE INDEX "WorkshopModule_cohortId_order_idx" ON "WorkshopModule" USING btree ("cohortId" int4_ops,"order" int4_ops);
CREATE POLICY "comment_select_authenticated" ON "Comment" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "reaction_select_authenticated" ON "Reaction" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);
CREATE POLICY "wallpost_select_authenticated" ON "WallPost" AS PERMISSIVE FOR SELECT TO "authenticated" USING (((approved = true) OR ("authorId" = auth.uid())));
