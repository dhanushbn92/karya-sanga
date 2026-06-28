/**
 * Backfill `UserCohort` from existing `User.cohortId`. Idempotent.
 *
 *   - For every user with a non-null cohortId, create a UserCohort row.
 *   - Existing rows are skipped via the @@unique(userId, cohortId).
 */
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const users = await prisma.user.findMany({
    where: { cohortId: { not: null } },
    select: { id: true, cohortId: true, email: true },
  });
  console.log(`Backfilling ${users.length} user → workshop link(s)`);
  if (users.length === 0) return;

  const result = await prisma.userCohort.createMany({
    data: users.map((u) => ({ userId: u.id, cohortId: u.cohortId })),
    skipDuplicates: true,
  });
  console.log(`Created ${result.count} new UserCohort row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
