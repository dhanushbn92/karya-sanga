/**
 * Rename Lesson.difficulty strings:
 *   Beginner     → Easy
 *   Intermediate → Medium
 *   Advanced     → Hard
 *
 * Idempotent — runs an updateMany per mapping.
 */
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const MAPPINGS = [
  { from: "Beginner", to: "Easy" },
  { from: "Intermediate", to: "Medium" },
  { from: "Advanced", to: "Hard" },
];

async function main() {
  for (const { from, to } of MAPPINGS) {
    const result = await prisma.lesson.updateMany({
      where: { difficulty: from },
      data: { difficulty: to },
    });
    console.log(`  ${from} → ${to}: ${result.count} updated`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
