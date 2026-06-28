/**
 * Rename existing cohort rows: "Cohort N · …" → "Workshop N · …".
 *
 * Idempotent — safe to re-run. Only replaces a leading "Cohort " with
 * "Workshop " so any name not starting with "Cohort " is left alone.
 */
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const rows = await prisma.cohort.findMany({
    select: { id: true, name: true },
  });
  let changed = 0;
  for (const r of rows) {
    if (!r.name.startsWith("Cohort ")) {
      console.log(`  skip: ${r.name}`);
      continue;
    }
    const next = "Workshop " + r.name.slice("Cohort ".length);
    await prisma.cohort.update({
      where: { id: r.id },
      data: { name: next },
    });
    console.log(`  ${r.name} → ${next}`);
    changed++;
  }
  console.log(`\nDone. ${changed} renamed.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
