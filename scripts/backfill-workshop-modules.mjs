/**
 * Backfill WorkshopModule join: attach every currently-published module
 * to every cohort, preserving Module.order as WorkshopModule.order.
 *
 * Idempotent — uses createMany with skipDuplicates so re-runs are safe.
 * Run once after the schema change:
 *
 *   npx tsx scripts/backfill-workshop-modules.mjs
 *
 * After this, the workshop view stays populated; admins can detach via
 * /admin/cohorts/<id> as that UI lands.
 */
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const cohorts = await prisma.cohort.findMany({
    select: { id: true, name: true },
  });
  const modules = await prisma.module.findMany({
    where: { published: true },
    select: { id: true, title: true, order: true },
  });

  console.log(
    `Backfilling: ${cohorts.length} cohort(s) × ${modules.length} module(s)`,
  );
  if (cohorts.length === 0 || modules.length === 0) {
    console.log("Nothing to attach — skipping.");
    return;
  }

  const rows = [];
  for (const c of cohorts) {
    for (const m of modules) {
      rows.push({ cohortId: c.id, moduleId: m.id, order: m.order });
    }
  }
  const result = await prisma.workshopModule.createMany({
    data: rows,
    skipDuplicates: true,
  });
  console.log(`Attached ${result.count} new module-to-cohort link(s).`);

  for (const c of cohorts) {
    const count = await prisma.workshopModule.count({
      where: { cohortId: c.id },
    });
    console.log(`  ${c.name}: ${count} modules`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
