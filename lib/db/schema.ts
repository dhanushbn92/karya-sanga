import { pgTable, index, uniqueIndex, text, timestamp, boolean, foreignKey, integer, uuid, pgPolicy, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const blogPostType = pgEnum("BlogPostType", ['build_update', 'experiment', 'learning', 'shipped', 'question'])
export const projectStatus = pgEnum("ProjectStatus", ['active', 'archived', 'shipped'])
export const reactionType = pgEnum("ReactionType", ['clap', 'love', 'idea'])
export const role = pgEnum("Role", ['admin', 'instructor', 'participant', 'judge'])
export const wallPostType = pgEnum("WallPostType", ['photo', 'update', 'blog'])


export const cohort = pgTable("Cohort", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	startedOn: timestamp({ precision: 3, mode: 'date' }),
	endedOn: timestamp({ precision: 3, mode: 'date' }),
	description: text(),
	current: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Cohort_current_idx").using("btree", table.current.asc().nullsLast().op("bool_ops")),
	uniqueIndex("Cohort_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("Cohort_startedOn_idx").using("btree", table.startedOn.asc().nullsLast().op("timestamp_ops")),
]);

export const badge = pgTable("Badge", {
	id: text().primaryKey().notNull(),
	slug: text().notNull(),
	name: text().notNull(),
	description: text().notNull(),
	criteria: text().notNull(),
	icon: text().notNull(),
	tone: text().default('primary').notNull(),
	category: text().default('workshop').notNull(),
	selfAward: boolean().default(false).notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	cohortId: text(),
}, (table) => [
	index("Badge_category_order_idx").using("btree", table.category.asc().nullsLast().op("text_ops"), table.order.asc().nullsLast().op("int4_ops")),
	index("Badge_cohortId_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Badge_slug_key").using("btree", table.slug.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "Badge_cohortId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const cohortPost = pgTable("CohortPost", {
	id: text().primaryKey().notNull(),
	cohortId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	pinned: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("CohortPost_cohortId_pinned_createdAt_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops"), table.pinned.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("bool_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "CohortPost_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "CohortPost_cohortId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const buildLogEntry = pgTable("BuildLogEntry", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	wokwiUrl: text(),
	imagePath: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("BuildLogEntry_teamId_createdAt_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "BuildLogEntry_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "BuildLogEntry_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const blogPost = pgTable("BlogPost", {
	id: text().primaryKey().notNull(),
	authorId: uuid().notNull(),
	type: blogPostType().default('build_update').notNull(),
	title: text().notNull(),
	body: text().notNull(),
	taggedTeamId: text(),
	isPublic: boolean().default(false).notNull(),
	removed: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("BlogPost_authorId_createdAt_idx").using("btree", table.authorId.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("uuid_ops")),
	index("BlogPost_isPublic_createdAt_idx").using("btree", table.isPublic.asc().nullsLast().op("bool_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("BlogPost_type_idx").using("btree", table.type.asc().nullsLast().op("enum_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "BlogPost_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.taggedTeamId],
			foreignColumns: [team.id],
			name: "BlogPost_taggedTeamId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const earnedBadge = pgTable("EarnedBadge", {
	id: text().primaryKey().notNull(),
	userId: uuid().notNull(),
	badgeId: text().notNull(),
	// Which workshop this award was given in. A badge can be earned multiple
	// times (the old unique(userId,badgeId) constraint is dropped), each award
	// tied to the workshop it was earned in.
	cohortId: text(),
	note: text(),
	awardedById: uuid(),
	earnedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("EarnedBadge_badgeId_idx").using("btree", table.badgeId.asc().nullsLast().op("text_ops")),
	index("EarnedBadge_userId_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	index("EarnedBadge_cohortId_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.awardedById],
			foreignColumns: [user.id],
			name: "EarnedBadge_awardedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.badgeId],
			foreignColumns: [badge.id],
			name: "EarnedBadge_badgeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "EarnedBadge_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "EarnedBadge_cohortId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const workshopFeedback = pgTable("WorkshopFeedback", {
	id: text().primaryKey().notNull(),
	cohortId: text().notNull(),
	userId: uuid().notNull(),
	rating: integer().notNull(),
	comment: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("WorkshopFeedback_cohortId_userId_key").using("btree", table.cohortId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("uuid_ops")),
	index("WorkshopFeedback_cohortId_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "WorkshopFeedback_cohortId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "WorkshopFeedback_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const blogComment = pgTable("BlogComment", {
	id: text().primaryKey().notNull(),
	postId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	removed: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("BlogComment_postId_createdAt_idx").using("btree", table.postId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "BlogComment_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [blogPost.id],
			name: "BlogComment_postId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const takeItFurtherSession = pgTable("TakeItFurtherSession", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	startsAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	durationMin: integer().default(60).notNull(),
	capacity: integer().default(20).notNull(),
	joinUrl: text(),
	recordingUrl: text(),
	deckUrl: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("TakeItFurtherSession_startsAt_idx").using("btree", table.startsAt.asc().nullsLast().op("timestamp_ops")),
]);

export const sessionRegistration = pgTable("SessionRegistration", {
	id: text().primaryKey().notNull(),
	sessionId: text().notNull(),
	userId: uuid().notNull(),
	registeredAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("SessionRegistration_sessionId_userId_key").using("btree", table.sessionId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [takeItFurtherSession.id],
			name: "SessionRegistration_sessionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "SessionRegistration_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const featuredBuilder = pgTable("FeaturedBuilder", {
	id: text().primaryKey().notNull(),
	userId: uuid().notNull(),
	yearMonth: text().notNull(),
	articleUrl: text(),
	reelUrl: text(),
	blurb: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("FeaturedBuilder_userId_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("FeaturedBuilder_yearMonth_key").using("btree", table.yearMonth.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "FeaturedBuilder_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const showAndTellEvent = pgTable("ShowAndTellEvent", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	scheduledAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	description: text(),
	recordingUrl: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const showAndTellPresenter = pgTable("ShowAndTellPresenter", {
	id: text().primaryKey().notNull(),
	eventId: text().notNull(),
	userId: uuid().notNull(),
	teamId: text(),
	slotOrder: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("ShowAndTellPresenter_eventId_userId_key").using("btree", table.eventId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [showAndTellEvent.id],
			name: "ShowAndTellPresenter_eventId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "ShowAndTellPresenter_teamId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ShowAndTellPresenter_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const hackathonConfig = pgTable("HackathonConfig", {
	id: text().default('default').primaryKey().notNull(),
	maxTeamSize: integer().default(5).notNull(),
	submitBy: timestamp({ precision: 3, mode: 'date' }),
	leaderboardPublic: boolean().default(false).notNull(),
	wallRequireApproval: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	cohortId: text(),
}, (table) => [
	uniqueIndex("HackathonConfig_cohortId_key").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "HackathonConfig_cohortId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const lookingForTeam = pgTable("LookingForTeam", {
	id: text().primaryKey().notNull(),
	userId: uuid().notNull(),
	skills: text().notNull(),
	interests: text(),
	contact: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("LookingForTeam_userId_key").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "LookingForTeam_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const wallPost = pgTable("WallPost", {
	id: text().primaryKey().notNull(),
	authorId: uuid().notNull(),
	imagePath: text(),
	caption: text(),
	tags: text().array().default(["RAY"]),
	approved: boolean().default(false).notNull(),
	approvedAt: timestamp({ precision: 3, mode: 'date' }),
	approvedById: uuid(),
	rejected: boolean().default(false).notNull(),
	rejectionReason: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	body: text(),
	kind: wallPostType().default('photo').notNull(),
	title: text(),
	mediaUrls: text().array().default(["RAY"]),
}, (table) => [
	index("WallPost_approved_createdAt_idx").using("btree", table.approved.asc().nullsLast().op("timestamp_ops"), table.createdAt.asc().nullsLast().op("timestamp_ops")),
	index("WallPost_authorId_idx").using("btree", table.authorId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.approvedById],
			foreignColumns: [user.id],
			name: "WallPost_approvedById_fkey"
		}).onUpdate("cascade").onDelete("set null"),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "WallPost_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("wallpost_select_authenticated", { as: "permissive", for: "select", to: ["authenticated"], using: sql`((approved = true) OR ("authorId" = auth.uid()))` }),
]);

export const team = pgTable("Team", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	projectTitle: text(),
	projectDescription: text(),
	repoUrl: text(),
	buildLog: text(),
	lookingForMembers: boolean().default(true).notNull(),
	cohortId: text(),
	status: projectStatus().default('active').notNull(),
	story: text(),
	architecture: text(),
	heroImagePath: text(),
	tags: text().array().default(["RAY"]),
	featured: boolean().default(false).notNull(),
	featuredAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
	mediaUrls: text().array().default(["RAY"]),
}, (table) => [
	index("Team_cohortId_status_idx").using("btree", table.cohortId.asc().nullsLast().op("enum_ops"), table.status.asc().nullsLast().op("enum_ops")),
	index("Team_featured_idx").using("btree", table.featured.asc().nullsLast().op("bool_ops")),
	index("Team_lookingForMembers_idx").using("btree", table.lookingForMembers.asc().nullsLast().op("bool_ops")),
	uniqueIndex("Team_name_key").using("btree", table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "Team_cohortId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const submission = pgTable("Submission", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	title: text().notNull(),
	description: text().notNull(),
	demoVideoUrl: text(),
	wokwiProjectUrl: text(),
	repoUrl: text(),
	submittedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	submittedById: uuid().notNull(),
	locked: boolean().default(true).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Submission_submittedAt_idx").using("btree", table.submittedAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("Submission_teamId_key").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "Submission_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const score = pgTable("Score", {
	id: text().primaryKey().notNull(),
	submissionId: text().notNull(),
	judgeId: uuid().notNull(),
	innovation: integer().notNull(),
	technical: integer().notNull(),
	aiUse: integer().notNull(),
	presentation: integer().notNull(),
	comment: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Score_submissionId_idx").using("btree", table.submissionId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Score_submissionId_judgeId_key").using("btree", table.submissionId.asc().nullsLast().op("text_ops"), table.judgeId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.judgeId],
			foreignColumns: [user.id],
			name: "Score_judgeId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.submissionId],
			foreignColumns: [submission.id],
			name: "Score_submissionId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const teamMember = pgTable("TeamMember", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	userId: uuid().notNull(),
	isCaptain: boolean().default(false).notNull(),
	joinedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("TeamMember_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
	uniqueIndex("TeamMember_userId_key").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "TeamMember_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "TeamMember_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const teamWokwiLink = pgTable("TeamWokwiLink", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	label: text().notNull(),
	wokwiProjectUrl: text().notNull(),
	addedById: uuid().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("TeamWokwiLink_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "TeamWokwiLink_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const savedProject = pgTable("SavedProject", {
	id: text().primaryKey().notNull(),
	ownerId: uuid().notNull(),
	name: text().notNull(),
	wokwiProjectUrl: text().notNull(),
	notes: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("SavedProject_ownerId_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [user.id],
			name: "SavedProject_ownerId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const wokwiStarter = pgTable("WokwiStarter", {
	id: text().primaryKey().notNull(),
	label: text().notNull(),
	description: text(),
	board: text().default('esp32').notNull(),
	category: text(),
	wokwiProjectUrl: text().notNull(),
	order: integer().default(0).notNull(),
	published: boolean().default(true).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	uniqueIndex("WokwiStarter_label_key").using("btree", table.label.asc().nullsLast().op("text_ops")),
	index("WokwiStarter_published_order_idx").using("btree", table.published.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
]);

export const module = pgTable("Module", {
	id: text().primaryKey().notNull(),
	title: text().notNull(),
	description: text(),
	order: integer().default(0).notNull(),
	published: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Module_order_idx").using("btree", table.order.asc().nullsLast().op("int4_ops")),
]);

export const progress = pgTable("Progress", {
	id: text().primaryKey().notNull(),
	userId: uuid().notNull(),
	lessonId: text().notNull(),
	completed: boolean().default(false).notNull(),
	completedAt: timestamp({ precision: 3, mode: 'date' }),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Progress_userId_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("Progress_userId_lessonId_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.lessonId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.lessonId],
			foreignColumns: [lesson.id],
			name: "Progress_lessonId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Progress_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const comment = pgTable("Comment", {
	id: text().primaryKey().notNull(),
	postId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Comment_postId_createdAt_idx").using("btree", table.postId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "Comment_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [wallPost.id],
			name: "Comment_postId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("comment_select_authenticated", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const lesson = pgTable("Lesson", {
	id: text().primaryKey().notNull(),
	moduleId: text().notNull(),
	title: text().notNull(),
	summary: text(),
	body: text().default("").notNull(),
	wokwiProjectUrl: text(),
	slidesUrl: text(),
	slideFilePath: text(),
	slideFileType: text(),
	slideFileName: text(),
	difficulty: text(),
	order: integer().default(0).notNull(),
	published: boolean().default(false).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("Lesson_moduleId_order_idx").using("btree", table.moduleId.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [module.id],
			name: "Lesson_moduleId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const reaction = pgTable("Reaction", {
	id: text().primaryKey().notNull(),
	postId: text().notNull(),
	userId: uuid().notNull(),
	type: reactionType().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Reaction_postId_idx").using("btree", table.postId.asc().nullsLast().op("text_ops")),
	uniqueIndex("Reaction_postId_userId_type_key").using("btree", table.postId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.postId],
			foreignColumns: [wallPost.id],
			name: "Reaction_postId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "Reaction_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	pgPolicy("reaction_select_authenticated", { as: "permissive", for: "select", to: ["authenticated"], using: sql`true` }),
]);

export const user = pgTable("User", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text(),
	role: role().default('participant').notNull(),
	avatarUrl: text(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	handle: text(),
	bio: text(),
	ageBand: text(),
	buildingNow: text(),
	profilePublic: boolean().default(false).notNull(),
	mentorAvailable: boolean().default(false).notNull(),
	cohortId: text(),
	dob: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("User_cohortId_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	uniqueIndex("User_email_key").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("User_handle_idx").using("btree", table.handle.asc().nullsLast().op("text_ops")),
	uniqueIndex("User_handle_key").using("btree", table.handle.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "User_cohortId_fkey"
		}).onUpdate("cascade").onDelete("set null"),
]);

export const projectReaction = pgTable("ProjectReaction", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	userId: uuid().notNull(),
	type: reactionType().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("ProjectReaction_teamId_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops")),
	uniqueIndex("ProjectReaction_teamId_userId_type_key").using("btree", table.teamId.asc().nullsLast().op("text_ops"), table.userId.asc().nullsLast().op("text_ops"), table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "ProjectReaction_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "ProjectReaction_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const projectComment = pgTable("ProjectComment", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	updatedAt: timestamp({ precision: 3, mode: 'date' }).notNull(),
}, (table) => [
	index("ProjectComment_teamId_createdAt_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "ProjectComment_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "ProjectComment_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const conversation = pgTable("Conversation", {
	id: text().primaryKey().notNull(),
	// DB columns are "userAId"/"userBId" (capital I); drizzle-kit introspection
	// mis-cased the property to userAid/userBid. Keep the property name (used by
	// relations + app code) but map to the real column name.
	userAid: uuid("userAId").notNull(),
	userBid: uuid("userBId").notNull(),
	lastMessageAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("Conversation_userAId_lastMessageAt_idx").using("btree", table.userAid.asc().nullsLast().op("timestamp_ops"), table.lastMessageAt.asc().nullsLast().op("timestamp_ops")),
	uniqueIndex("Conversation_userAId_userBId_key").using("btree", table.userAid.asc().nullsLast().op("uuid_ops"), table.userBid.asc().nullsLast().op("uuid_ops")),
	index("Conversation_userBId_lastMessageAt_idx").using("btree", table.userBid.asc().nullsLast().op("uuid_ops"), table.lastMessageAt.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.userAid],
			foreignColumns: [user.id],
			name: "Conversation_userAId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userBid],
			foreignColumns: [user.id],
			name: "Conversation_userBId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const directMessage = pgTable("DirectMessage", {
	id: text().primaryKey().notNull(),
	conversationId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	readAt: timestamp({ precision: 3, mode: 'date' }),
}, (table) => [
	index("DirectMessage_conversationId_createdAt_idx").using("btree", table.conversationId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "DirectMessage_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.conversationId],
			foreignColumns: [conversation.id],
			name: "DirectMessage_conversationId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const workshopModule = pgTable("WorkshopModule", {
	id: text().primaryKey().notNull(),
	cohortId: text().notNull(),
	moduleId: text().notNull(),
	order: integer().default(0).notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	uniqueIndex("WorkshopModule_cohortId_moduleId_key").using("btree", table.cohortId.asc().nullsLast().op("text_ops"), table.moduleId.asc().nullsLast().op("text_ops")),
	index("WorkshopModule_cohortId_order_idx").using("btree", table.cohortId.asc().nullsLast().op("int4_ops"), table.order.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "WorkshopModule_cohortId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.moduleId],
			foreignColumns: [module.id],
			name: "WorkshopModule_moduleId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const userCohort = pgTable("UserCohort", {
	id: text().primaryKey().notNull(),
	userId: uuid().notNull(),
	cohortId: text().notNull(),
	joinedAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("UserCohort_cohortId_idx").using("btree", table.cohortId.asc().nullsLast().op("text_ops")),
	uniqueIndex("UserCohort_userId_cohortId_key").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.cohortId.asc().nullsLast().op("uuid_ops")),
	index("UserCohort_userId_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.cohortId],
			foreignColumns: [cohort.id],
			name: "UserCohort_cohortId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "UserCohort_userId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);

export const teamMessage = pgTable("TeamMessage", {
	id: text().primaryKey().notNull(),
	teamId: text().notNull(),
	authorId: uuid().notNull(),
	body: text().notNull(),
	createdAt: timestamp({ precision: 3, mode: 'date' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
	index("TeamMessage_teamId_createdAt_idx").using("btree", table.teamId.asc().nullsLast().op("text_ops"), table.createdAt.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.authorId],
			foreignColumns: [user.id],
			name: "TeamMessage_authorId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [team.id],
			name: "TeamMessage_teamId_fkey"
		}).onUpdate("cascade").onDelete("cascade"),
]);
