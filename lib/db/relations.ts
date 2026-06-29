import { relations } from "drizzle-orm/relations";
import { cohort, badge, user, cohortPost, buildLogEntry, team, blogPost, earnedBadge, blogComment, takeItFurtherSession, sessionRegistration, featuredBuilder, showAndTellEvent, showAndTellPresenter, hackathonConfig, lookingForTeam, wallPost, submission, score, teamMember, teamWokwiLink, savedProject, lesson, progress, comment, module, reaction, projectReaction, projectComment, conversation, directMessage, workshopModule, userCohort, teamMessage, workshopFeedback } from "./schema";

export const workshopFeedbackRelations = relations(workshopFeedback, ({one}) => ({
	user: one(user, {
		fields: [workshopFeedback.userId],
		references: [user.id],
	}),
	cohort: one(cohort, {
		fields: [workshopFeedback.cohortId],
		references: [cohort.id],
	}),
}));

export const badgeRelations = relations(badge, ({one, many}) => ({
	cohort: one(cohort, {
		fields: [badge.cohortId],
		references: [cohort.id]
	}),
	earnedBadges: many(earnedBadge),
}));

export const cohortRelations = relations(cohort, ({many}) => ({
	badges: many(badge),
	cohortPosts: many(cohortPost),
	hackathonConfigs: many(hackathonConfig),
	teams: many(team),
	users: many(user),
	workshopModules: many(workshopModule),
	userCohorts: many(userCohort),
	workshopFeedbacks: many(workshopFeedback),
}));

export const cohortPostRelations = relations(cohortPost, ({one}) => ({
	user: one(user, {
		fields: [cohortPost.authorId],
		references: [user.id]
	}),
	cohort: one(cohort, {
		fields: [cohortPost.cohortId],
		references: [cohort.id]
	}),
}));

export const userRelations = relations(user, ({one, many}) => ({
	cohortPosts: many(cohortPost),
	buildLogEntries: many(buildLogEntry),
	blogPosts: many(blogPost),
	earnedBadges_awardedById: many(earnedBadge, {
		relationName: "earnedBadge_awardedById_user_id"
	}),
	earnedBadges_userId: many(earnedBadge, {
		relationName: "earnedBadge_userId_user_id"
	}),
	blogComments: many(blogComment),
	sessionRegistrations: many(sessionRegistration),
	featuredBuilders: many(featuredBuilder),
	showAndTellPresenters: many(showAndTellPresenter),
	lookingForTeams: many(lookingForTeam),
	wallPosts_approvedById: many(wallPost, {
		relationName: "wallPost_approvedById_user_id"
	}),
	wallPosts_authorId: many(wallPost, {
		relationName: "wallPost_authorId_user_id"
	}),
	scores: many(score),
	teamMembers: many(teamMember),
	savedProjects: many(savedProject),
	progresses: many(progress),
	comments: many(comment),
	reactions: many(reaction),
	cohort: one(cohort, {
		fields: [user.cohortId],
		references: [cohort.id]
	}),
	projectReactions: many(projectReaction),
	projectComments: many(projectComment),
	conversations_userAid: many(conversation, {
		relationName: "conversation_userAid_user_id"
	}),
	conversations_userBid: many(conversation, {
		relationName: "conversation_userBid_user_id"
	}),
	directMessages: many(directMessage),
	userCohorts: many(userCohort),
	teamMessages: many(teamMessage),
}));

export const buildLogEntryRelations = relations(buildLogEntry, ({one}) => ({
	user: one(user, {
		fields: [buildLogEntry.authorId],
		references: [user.id]
	}),
	team: one(team, {
		fields: [buildLogEntry.teamId],
		references: [team.id]
	}),
}));

export const teamRelations = relations(team, ({one, many}) => ({
	buildLogEntries: many(buildLogEntry),
	blogPosts: many(blogPost),
	showAndTellPresenters: many(showAndTellPresenter),
	cohort: one(cohort, {
		fields: [team.cohortId],
		references: [cohort.id]
	}),
	submissions: many(submission),
	teamMembers: many(teamMember),
	teamWokwiLinks: many(teamWokwiLink),
	projectReactions: many(projectReaction),
	projectComments: many(projectComment),
	teamMessages: many(teamMessage),
}));

export const blogPostRelations = relations(blogPost, ({one, many}) => ({
	user: one(user, {
		fields: [blogPost.authorId],
		references: [user.id]
	}),
	team: one(team, {
		fields: [blogPost.taggedTeamId],
		references: [team.id]
	}),
	blogComments: many(blogComment),
}));

export const earnedBadgeRelations = relations(earnedBadge, ({one}) => ({
	user_awardedById: one(user, {
		fields: [earnedBadge.awardedById],
		references: [user.id],
		relationName: "earnedBadge_awardedById_user_id"
	}),
	badge: one(badge, {
		fields: [earnedBadge.badgeId],
		references: [badge.id]
	}),
	user_userId: one(user, {
		fields: [earnedBadge.userId],
		references: [user.id],
		relationName: "earnedBadge_userId_user_id"
	}),
}));

export const blogCommentRelations = relations(blogComment, ({one}) => ({
	user: one(user, {
		fields: [blogComment.authorId],
		references: [user.id]
	}),
	blogPost: one(blogPost, {
		fields: [blogComment.postId],
		references: [blogPost.id]
	}),
}));

export const sessionRegistrationRelations = relations(sessionRegistration, ({one}) => ({
	takeItFurtherSession: one(takeItFurtherSession, {
		fields: [sessionRegistration.sessionId],
		references: [takeItFurtherSession.id]
	}),
	user: one(user, {
		fields: [sessionRegistration.userId],
		references: [user.id]
	}),
}));

export const takeItFurtherSessionRelations = relations(takeItFurtherSession, ({many}) => ({
	sessionRegistrations: many(sessionRegistration),
}));

export const featuredBuilderRelations = relations(featuredBuilder, ({one}) => ({
	user: one(user, {
		fields: [featuredBuilder.userId],
		references: [user.id]
	}),
}));

export const showAndTellPresenterRelations = relations(showAndTellPresenter, ({one}) => ({
	showAndTellEvent: one(showAndTellEvent, {
		fields: [showAndTellPresenter.eventId],
		references: [showAndTellEvent.id]
	}),
	team: one(team, {
		fields: [showAndTellPresenter.teamId],
		references: [team.id]
	}),
	user: one(user, {
		fields: [showAndTellPresenter.userId],
		references: [user.id]
	}),
}));

export const showAndTellEventRelations = relations(showAndTellEvent, ({many}) => ({
	showAndTellPresenters: many(showAndTellPresenter),
}));

export const hackathonConfigRelations = relations(hackathonConfig, ({one}) => ({
	cohort: one(cohort, {
		fields: [hackathonConfig.cohortId],
		references: [cohort.id]
	}),
}));

export const lookingForTeamRelations = relations(lookingForTeam, ({one}) => ({
	user: one(user, {
		fields: [lookingForTeam.userId],
		references: [user.id]
	}),
}));

export const wallPostRelations = relations(wallPost, ({one, many}) => ({
	user_approvedById: one(user, {
		fields: [wallPost.approvedById],
		references: [user.id],
		relationName: "wallPost_approvedById_user_id"
	}),
	user_authorId: one(user, {
		fields: [wallPost.authorId],
		references: [user.id],
		relationName: "wallPost_authorId_user_id"
	}),
	comments: many(comment),
	reactions: many(reaction),
}));

export const submissionRelations = relations(submission, ({one, many}) => ({
	team: one(team, {
		fields: [submission.teamId],
		references: [team.id]
	}),
	scores: many(score),
}));

export const scoreRelations = relations(score, ({one}) => ({
	user: one(user, {
		fields: [score.judgeId],
		references: [user.id]
	}),
	submission: one(submission, {
		fields: [score.submissionId],
		references: [submission.id]
	}),
}));

export const teamMemberRelations = relations(teamMember, ({one}) => ({
	team: one(team, {
		fields: [teamMember.teamId],
		references: [team.id]
	}),
	user: one(user, {
		fields: [teamMember.userId],
		references: [user.id]
	}),
}));

export const teamWokwiLinkRelations = relations(teamWokwiLink, ({one}) => ({
	team: one(team, {
		fields: [teamWokwiLink.teamId],
		references: [team.id]
	}),
}));

export const savedProjectRelations = relations(savedProject, ({one}) => ({
	user: one(user, {
		fields: [savedProject.ownerId],
		references: [user.id]
	}),
}));

export const progressRelations = relations(progress, ({one}) => ({
	lesson: one(lesson, {
		fields: [progress.lessonId],
		references: [lesson.id]
	}),
	user: one(user, {
		fields: [progress.userId],
		references: [user.id]
	}),
}));

export const lessonRelations = relations(lesson, ({one, many}) => ({
	progresses: many(progress),
	module: one(module, {
		fields: [lesson.moduleId],
		references: [module.id]
	}),
}));

export const commentRelations = relations(comment, ({one}) => ({
	user: one(user, {
		fields: [comment.authorId],
		references: [user.id]
	}),
	wallPost: one(wallPost, {
		fields: [comment.postId],
		references: [wallPost.id]
	}),
}));

export const moduleRelations = relations(module, ({many}) => ({
	lessons: many(lesson),
	workshopModules: many(workshopModule),
}));

export const reactionRelations = relations(reaction, ({one}) => ({
	wallPost: one(wallPost, {
		fields: [reaction.postId],
		references: [wallPost.id]
	}),
	user: one(user, {
		fields: [reaction.userId],
		references: [user.id]
	}),
}));

export const projectReactionRelations = relations(projectReaction, ({one}) => ({
	team: one(team, {
		fields: [projectReaction.teamId],
		references: [team.id]
	}),
	user: one(user, {
		fields: [projectReaction.userId],
		references: [user.id]
	}),
}));

export const projectCommentRelations = relations(projectComment, ({one}) => ({
	user: one(user, {
		fields: [projectComment.authorId],
		references: [user.id]
	}),
	team: one(team, {
		fields: [projectComment.teamId],
		references: [team.id]
	}),
}));

export const conversationRelations = relations(conversation, ({one, many}) => ({
	user_userAid: one(user, {
		fields: [conversation.userAid],
		references: [user.id],
		relationName: "conversation_userAid_user_id"
	}),
	user_userBid: one(user, {
		fields: [conversation.userBid],
		references: [user.id],
		relationName: "conversation_userBid_user_id"
	}),
	directMessages: many(directMessage),
}));

export const directMessageRelations = relations(directMessage, ({one}) => ({
	user: one(user, {
		fields: [directMessage.authorId],
		references: [user.id]
	}),
	conversation: one(conversation, {
		fields: [directMessage.conversationId],
		references: [conversation.id]
	}),
}));

export const workshopModuleRelations = relations(workshopModule, ({one}) => ({
	cohort: one(cohort, {
		fields: [workshopModule.cohortId],
		references: [cohort.id]
	}),
	module: one(module, {
		fields: [workshopModule.moduleId],
		references: [module.id]
	}),
}));

export const userCohortRelations = relations(userCohort, ({one}) => ({
	cohort: one(cohort, {
		fields: [userCohort.cohortId],
		references: [cohort.id]
	}),
	user: one(user, {
		fields: [userCohort.userId],
		references: [user.id]
	}),
}));

export const teamMessageRelations = relations(teamMessage, ({one}) => ({
	user: one(user, {
		fields: [teamMessage.authorId],
		references: [user.id]
	}),
	team: one(team, {
		fields: [teamMessage.teamId],
		references: [team.id]
	}),
}));