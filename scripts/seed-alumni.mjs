// Seed enough alumni-platform data for the admin to walk every screen:
// - One "Cohort 1 · v1 launch" cohort, marked current
// - dhanushextra2@gmail.com gets a handle, bio, age band, and that cohort
// - The existing Sensor Sages team gets cohort + story + architecture + tags
// - Admin earns 4 representative badges (workshop + platform mix)
// Idempotent.
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ADMIN_EMAIL = "dhanushextra2@gmail.com";

// 1. Cohort
let cohort = await prisma.cohort.findFirst({
  where: { name: "Cohort 1 · v1 launch" },
});
if (!cohort) {
  cohort = await prisma.cohort.create({
    data: {
      name: "Cohort 1 · v1 launch",
      description:
        "First Karya Sanga cohort using the new platform — the alumni community starts here.",
      current: true,
      startedOn: new Date("2026-05-01"),
    },
  });
  console.log("  cohort created");
} else {
  console.log("  cohort found");
}

// 2. Admin user — handle + bio + cohort
const admin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
if (!admin) {
  throw new Error(`No User row for ${ADMIN_EMAIL}`);
}
await prisma.user.update({
  where: { id: admin.id },
  data: {
    handle: admin.handle ?? "dhanush",
    name: admin.name ?? "Dhanush",
    bio:
      admin.bio ??
      "Workshop instructor + admin. Building the platform the cohorts ship on.",
    buildingNow: admin.buildingNow ?? "The Anaadi Builders Platform v1.",
    ageBand: admin.ageBand ?? "20+",
    profilePublic: true,
    cohortId: cohort.id,
  },
});
console.log("  admin updated");

// 3. Sensor Sages team — cohort + story + arch + tags
const team = await prisma.team.findFirst({
  where: { name: "Sensor Sages" },
});
if (team) {
  await prisma.team.update({
    where: { id: team.id },
    data: {
      cohortId: cohort.id,
      status: "active",
      story:
        team.story ??
        [
          "## The problem",
          "",
          "Houseplants die because nobody notices when they're thirsty. The soil looks brown either way until it's too late.",
          "",
          "## What we built",
          "",
          "A small companion device that sits in any pot. It checks the soil every minute, calls an AI endpoint to decide whether the plant actually needs water (so it stops nagging on humid mornings), and beeps a buzzer when it does. Optional webhook posts a notification to a Discord channel.",
          "",
          "## Who it's for",
          "",
          "Kids who keep killing the basil their grandmother gave them.",
        ].join("\n"),
      architecture:
        team.architecture ??
        [
          "## The signal path",
          "",
          "1. **Soil moisture sensor** (analog) → GPIO 34 on ESP32 every 1s",
          "2. **ESP32** computes a rolling mean over 60s — kills sensor noise",
          "3. Sends the mean to a small **AI endpoint** (`/should-water?ambient=...`) every 5 min",
          "4. AI returns a decision + confidence; ESP32 acts only if confidence > 0.7",
          "5. **Buzzer** beeps for 2s every 10 min until the moisture rises (kid waters it)",
          "6. Optional **Discord webhook** if owner isn't home",
          "",
          "## Why each piece",
          "",
          "- Rolling mean: raw analogRead jitters ±200 LSB",
          "- AI gating: lets us handle weather variations without a per-plant calibration UI",
          "- Buzzer interval: kids hate continuous beeping",
        ].join("\n"),
      tags:
        team.tags.length > 0
          ? team.tags
          : ["sensor: soil moisture", "domain: plants", "ai: openai", "esp32"],
    },
  });
  console.log("  team updated with gallery fields");
} else {
  console.log("  team 'Sensor Sages' not found — skipping team update");
}

// 4. Award badges
const TO_AWARD = [
  "hello-led-hero",
  "button-boss",
  "shipper",
  "post-workshop-builder",
  "first-improvement",
];
for (const slug of TO_AWARD) {
  const badge = await prisma.badge.findUnique({ where: { slug } });
  if (!badge) {
    console.log(`  badge ${slug} not in catalog`);
    continue;
  }
  await prisma.earnedBadge.upsert({
    where: { userId_badgeId: { userId: admin.id, badgeId: badge.id } },
    create: {
      userId: admin.id,
      badgeId: badge.id,
      awardedById: admin.id,
      note: "Seeded for v1 demo.",
    },
    update: {},
  });
  console.log(`  badge awarded: ${badge.name}`);
}

// 5. A cohort post or two so the space isn't empty
const existingPost = await prisma.cohortPost.findFirst({
  where: { cohortId: cohort.id, body: { startsWith: "Welcome to the cohort" } },
});
if (!existingPost) {
  await prisma.cohortPost.create({
    data: {
      cohortId: cohort.id,
      authorId: admin.id,
      body: "Welcome to the cohort space. Post build updates, ask for help, share wins. This is where we stay connected after the workshop wraps.",
      pinned: true,
    },
  });
  console.log("  cohort post created (pinned)");
}

await prisma.$disconnect();
console.log("✔ Alumni demo data seeded.");
