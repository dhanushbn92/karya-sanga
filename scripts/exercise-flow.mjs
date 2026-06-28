// End-to-end exercise: seed enough data to walk every screen at /wall,
// /lessons, /simulator, /hackathon, /admin and see them populated.
//
// Idempotent — running twice doesn't duplicate anything. Each step checks
// for the seed it would create and skips if already present.
//
// Targets the admin account dhanushextra2@gmail.com (already in the DB).

import { config as loadEnv } from "dotenv";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "dhanushextra2@gmail.com";

function log(step, msg) {
  console.log(`  [${step}] ${msg}`);
}

async function main() {
  console.log("EXERCISE FLOW — seeding data for the admin to walk through");

  // -------------------------------------------------------------------
  // 1. Admin user
  // -------------------------------------------------------------------
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (!admin) {
    throw new Error(
      `No User row for ${ADMIN_EMAIL}. Sign up first at /signup.`,
    );
  }
  log("admin", `${admin.email} · role=${admin.role}`);
  if (admin.role !== "admin") {
    log("admin", "Note: not admin role — some seeding will still work.");
  }

  // -------------------------------------------------------------------
  // 2. Lessons — one module with two published lessons
  // -------------------------------------------------------------------
  let mod = await prisma.module.findFirst({
    where: { title: "Module 01 · Components & Circuits" },
  });
  if (!mod) {
    mod = await prisma.module.create({
      data: {
        title: "Module 01 · Components & Circuits",
        description:
          "Start with the ESP32 microcontroller and a small kit of sensors.",
        order: 0,
        published: true,
      },
    });
    log("module", `created "${mod.title}"`);
  } else {
    log("module", `found "${mod.title}"`);
  }

  const lessonSeeds = [
    {
      title: "Blink an LED with ESP32",
      summary:
        "Your first circuit — a single LED, a resistor, and three lines of code.",
      difficulty: "Beginner",
      order: 0,
      body: [
        "## What you'll build",
        "",
        "A circuit that blinks an LED once per second.",
        "",
        "## Steps",
        "1. Wire GPIO 2 → 220Ω resistor → LED → GND.",
        "2. Set `pinMode(2, OUTPUT)` in `setup()`.",
        "3. In `loop()`, alternate `digitalWrite(2, HIGH)` and `LOW` with a 500ms delay.",
        "",
        "```cpp",
        "void setup() {",
        "  pinMode(2, OUTPUT);",
        "}",
        "void loop() {",
        "  digitalWrite(2, HIGH);",
        "  delay(500);",
        "  digitalWrite(2, LOW);",
        "  delay(500);",
        "}",
        "```",
      ].join("\n"),
      wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
    },
    {
      title: "Read a soil moisture sensor",
      summary:
        "Wet the soil — watch the analog reading change. Build your first alarm.",
      difficulty: "Intermediate",
      order: 1,
      body: [
        "## Hardware",
        "- ESP32",
        "- Soil moisture sensor (VCC → 3V3, GND → GND, AOUT → GPIO 34)",
        "",
        "## Code outline",
        "```cpp",
        "void setup() {",
        "  Serial.begin(115200);",
        "  pinMode(34, INPUT);",
        "}",
        "void loop() {",
        "  Serial.println(analogRead(34));",
        "  delay(1000);",
        "}",
        "```",
        "",
        "Tune the threshold by reading your dry and wet values, then trigger a buzzer or HTTP call when the soil drops below.",
      ].join("\n"),
      wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
    },
  ];

  for (const seed of lessonSeeds) {
    const existing = await prisma.lesson.findFirst({
      where: { moduleId: mod.id, title: seed.title },
    });
    if (existing) {
      log("lesson", `found "${seed.title}"`);
    } else {
      await prisma.lesson.create({
        data: { ...seed, moduleId: mod.id, published: true },
      });
      log("lesson", `created "${seed.title}"`);
    }
  }

  // Mark lesson #1 complete for admin
  const firstLesson = await prisma.lesson.findFirst({
    where: { moduleId: mod.id, order: 0 },
  });
  if (firstLesson) {
    await prisma.progress.upsert({
      where: {
        userId_lessonId: { userId: admin.id, lessonId: firstLesson.id },
      },
      create: {
        userId: admin.id,
        lessonId: firstLesson.id,
        completed: true,
        completedAt: new Date(),
      },
      update: {},
    });
    log("progress", `marked "${firstLesson.title}" complete for admin`);
  }

  // -------------------------------------------------------------------
  // 3. SavedProject for the admin
  // -------------------------------------------------------------------
  let saved = await prisma.savedProject.findFirst({
    where: { ownerId: admin.id, name: "Demo LED blink" },
  });
  if (!saved) {
    saved = await prisma.savedProject.create({
      data: {
        ownerId: admin.id,
        name: "Demo LED blink",
        wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
        notes: "First Wokwi project from the lessons. Works on ESP32.",
      },
    });
    log("saved", `created saved project "${saved.name}"`);
  } else {
    log("saved", `found saved project "${saved.name}"`);
  }

  // -------------------------------------------------------------------
  // 4. Hackathon config + team + submission + score
  // -------------------------------------------------------------------
  const futureDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await prisma.hackathonConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      maxTeamSize: 5,
      submitBy: futureDeadline,
      leaderboardPublic: true,
      wallRequireApproval: true,
    },
    update: {
      submitBy: futureDeadline,
      leaderboardPublic: true,
    },
  });
  log(
    "config",
    `hackathon deadline=${futureDeadline.toISOString().slice(0, 16)}, leaderboardPublic=true`,
  );

  // Team (only if admin isn't already on one)
  const existingMembership = await prisma.teamMember.findUnique({
    where: { userId: admin.id },
    include: { team: true },
  });
  let team;
  if (existingMembership) {
    team = existingMembership.team;
    log("team", `admin already on "${team.name}"`);
  } else {
    team = await prisma.team.create({
      data: {
        name: "Sensor Sages",
        description: "Smart plant alarm with the ESP32",
        projectTitle: "Smart Plant Companion",
        projectDescription:
          "Soil moisture sensor + AI alert when the plant needs water.",
        repoUrl: "https://github.com/anaadi-foundation/sample-plant-companion",
        buildLog:
          "Day 1 — wired the sensor.\nDay 2 — calibrated dry/wet thresholds.\nDay 3 — connected to a webhook.",
        lookingForMembers: true,
        members: {
          create: {
            userId: admin.id,
            isCaptain: true,
          },
        },
      },
    });
    log("team", `created "${team.name}" with admin as captain`);
  }

  // Wokwi link on the team
  const existingLink = await prisma.teamWokwiLink.findFirst({
    where: { teamId: team.id, label: "Soil moisture demo" },
  });
  if (!existingLink) {
    await prisma.teamWokwiLink.create({
      data: {
        teamId: team.id,
        label: "Soil moisture demo",
        wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
        addedById: admin.id,
      },
    });
    log("team", "added Wokwi link to team");
  }

  // Submission
  const existingSubmission = await prisma.submission.findUnique({
    where: { teamId: team.id },
  });
  let submission;
  if (existingSubmission) {
    submission = existingSubmission;
    log("submission", `team already has a submission "${submission.title}"`);
  } else {
    submission = await prisma.submission.create({
      data: {
        teamId: team.id,
        title: "Smart Plant Companion",
        description:
          "An ESP32 reads soil moisture every second, calls an AI endpoint to decide if the plant needs water, then beeps a buzzer and posts to a webhook. Built for the workshop hackathon as a demo end-to-end pipeline.",
        demoVideoUrl: "https://youtu.be/dQw4w9WgXcQ",
        wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
        repoUrl: "https://github.com/anaadi-foundation/sample-plant-companion",
        submittedById: admin.id,
        locked: true,
      },
    });
    log("submission", `created submission "${submission.title}"`);
  }

  // Score (admin acts as judge)
  await prisma.score.upsert({
    where: {
      submissionId_judgeId: {
        submissionId: submission.id,
        judgeId: admin.id,
      },
    },
    create: {
      submissionId: submission.id,
      judgeId: admin.id,
      innovation: 7,
      technical: 8,
      aiUse: 6,
      presentation: 7,
      comment: "Solid build. Strong sensor calibration; AI integration is light but works.",
    },
    update: {},
  });
  log("score", "admin scored the submission (28/40 total)");

  // -------------------------------------------------------------------
  // 5. Wall — upload a sample image, create an approved post + reaction + comment
  // -------------------------------------------------------------------
  await seedWallPost(admin);

  await prisma.$disconnect();
  console.log("✔ Seed complete.");
}

async function seedWallPost(admin) {
  // Look for an existing seeded post so we don't pile up duplicates.
  const existing = await prisma.wallPost.findFirst({
    where: { authorId: admin.id, caption: "Seeded demo — soldering practice." },
  });
  if (existing) {
    log("wall", `found seeded WallPost id=${existing.id}`);
    return;
  }

  // Create a tiny placeholder image (1x1 colored PNG) and upload to storage.
  // 1x1 saffron pixel — base64 of a valid PNG.
  const pngB64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkePb+PwAFhAJ/wlseKgAAAABJRU5ErkJggg==";
  const buffer = Buffer.from(pngB64, "base64");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    log("wall", "skipping image upload — missing supabase env");
    return;
  }
  const sb = createSupabaseAdmin(url, secret, {
    auth: { persistSession: false },
  });

  const path = `${admin.id}/seed-${Date.now()}.png`;
  const { error: upErr } = await sb.storage
    .from("wall-images")
    .upload(path, buffer, { contentType: "image/png", upsert: false });
  if (upErr) {
    log("wall", `upload failed: ${upErr.message}`);
    return;
  }

  const post = await prisma.wallPost.create({
    data: {
      authorId: admin.id,
      imagePath: path,
      caption: "Seeded demo — soldering practice.",
      tags: ["demo", "esp32"],
      approved: true,
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });
  log("wall", `created WallPost id=${post.id} (auto-approved)`);

  // Drop a reaction and a comment so the card has content.
  await prisma.reaction.create({
    data: { postId: post.id, userId: admin.id, type: "clap" },
  });
  log("wall", "added clap reaction");

  await prisma.comment.create({
    data: {
      postId: post.id,
      authorId: admin.id,
      body: "Nice solder joints — clean lines on every pad.",
    },
  });
  log("wall", "added comment");
}

main().catch(async (err) => {
  console.error("FAIL:", err.message);
  await prisma.$disconnect().catch(() => {});
  process.exitCode = 1;
});
