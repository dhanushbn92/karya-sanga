// One-shot: replace the placeholder Wokwi URL (project 321949368771084884,
// which has since been deleted on Wokwi and now 404s) with the stable
// /projects/new/<board> entry points.
//
// Targets every table that can hold a Wokwi URL:
//   - WokwiStarter        — fall back to /projects/new/<starter.board>
//   - SavedProject        — fall back to /projects/new/esp32
//   - TeamWokwiLink       — fall back to /projects/new/esp32
//   - Submission          — fall back to /projects/new/esp32
//   - Lesson              — fall back to /projects/new/esp32
//
// Safe to rerun.

import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEAD = "https://wokwi.com/projects/321949368771084884";
const ESP32_NEW = "https://wokwi.com/projects/new/esp32";

function log(scope, msg) {
  console.log(`  [${scope}] ${msg}`);
}

// Starters — pick the right /new/<board> URL per row.
const starters = await prisma.wokwiStarter.findMany({
  where: { wokwiProjectUrl: DEAD },
  select: { id: true, label: true, board: true },
});
for (const s of starters) {
  const target = `https://wokwi.com/projects/new/${s.board}`;
  await prisma.wokwiStarter.update({
    where: { id: s.id },
    data: { wokwiProjectUrl: target },
  });
  log("starter", `${s.label} → ${target}`);
}

// SavedProject
const savedCount = await prisma.savedProject.updateMany({
  where: { wokwiProjectUrl: DEAD },
  data: { wokwiProjectUrl: ESP32_NEW },
});
log("saved", `${savedCount.count} row(s) updated`);

// TeamWokwiLink
const linkCount = await prisma.teamWokwiLink.updateMany({
  where: { wokwiProjectUrl: DEAD },
  data: { wokwiProjectUrl: ESP32_NEW },
});
log("teamLink", `${linkCount.count} row(s) updated`);

// Submission
const subCount = await prisma.submission.updateMany({
  where: { wokwiProjectUrl: DEAD },
  data: { wokwiProjectUrl: ESP32_NEW },
});
log("submission", `${subCount.count} row(s) updated`);

// Lesson
const lessonCount = await prisma.lesson.updateMany({
  where: { wokwiProjectUrl: DEAD },
  data: { wokwiProjectUrl: ESP32_NEW },
});
log("lesson", `${lessonCount.count} row(s) updated`);

await prisma.$disconnect();
console.log("✔ Cleanup complete.");
