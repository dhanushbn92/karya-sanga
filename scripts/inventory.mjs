import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
loadEnv({ path: ".env.local" });
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const counts = await Promise.all([
  ["User", prisma.user.count()],
  ["Module", prisma.module.count()],
  ["Lesson", prisma.lesson.count()],
  ["Progress", prisma.progress.count()],
  ["SavedProject", prisma.savedProject.count()],
  ["Team", prisma.team.count()],
  ["TeamMember", prisma.teamMember.count()],
  ["TeamWokwiLink", prisma.teamWokwiLink.count()],
  ["LookingForTeam", prisma.lookingForTeam.count()],
  ["Submission", prisma.submission.count()],
  ["Score", prisma.score.count()],
  ["WallPost", prisma.wallPost.count()],
  ["Reaction", prisma.reaction.count()],
  ["Comment", prisma.comment.count()],
].map(async ([name, p]) => [name, await p]));

for (const [name, n] of counts) {
  console.log(`${name.padEnd(18)} ${n}`);
}
await prisma.$disconnect();
