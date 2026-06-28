// Seed the badge catalog from the Anaadi Builders Platform spec.
// 10 workshop badges + 7 post-workshop badges = 17 total.
// Idempotent — keyed by slug.
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─── Workshop badges (10) — earned during the 4 workshop sessions ───
const WORKSHOP = [
  {
    slug: "hallucination-hunter",
    name: "Hallucination Hunter",
    description: "Spotted an AI making things up.",
    criteria: "Day 1 · M1.6 (Session 1 online)",
    icon: "search",
    tone: "primary",
  },
  {
    slug: "prompt-doctor",
    name: "Prompt Doctor",
    description: "Mastered the PCTF prompt framework.",
    criteria: "Day 1 · M1.8 (PCTF mastery)",
    icon: "psychology",
    tone: "secondary",
  },
  {
    slug: "ai-whisperer",
    name: "AI Whisperer",
    description: "Made the model do what you wanted, twice.",
    criteria: "Day 1 · M1.10 + Day 2 · M2.7",
    icon: "graphic_eq",
    tone: "tertiary",
  },
  {
    slug: "pitch-crew",
    name: "Pitch Crew",
    description: "Pitched your project as a group.",
    criteria: "Day 1 · M1.14 (group)",
    icon: "campaign",
    tone: "primary",
  },
  {
    slug: "python-caller",
    name: "Python Caller",
    description: "Called an AI from Python and got a real answer back.",
    criteria: "Day 2 · M2.1 (Session 3 online)",
    icon: "terminal",
    tone: "secondary",
  },
  {
    slug: "hello-led-hero",
    name: "Hello LED Hero",
    description: "Blinked your first LED with the ESP32.",
    criteria: "Day 2 · M2.3 (Session 3 online)",
    icon: "lightbulb",
    tone: "tertiary",
  },
  {
    slug: "button-boss",
    name: "Button Boss",
    description: "Read a button press into your circuit.",
    criteria: "Day 2 · M2.4 (Session 3 online)",
    icon: "smart_button",
    tone: "primary",
  },
  {
    slug: "sound-sorcerer",
    name: "Sound Sorcerer",
    description: "Made the buzzer sing.",
    criteria: "Day 2 · M2.5 (in-person only — N/A for online)",
    icon: "music_note",
    tone: "secondary",
  },
  {
    slug: "distance-druid",
    name: "Distance Druid",
    description: "Measured the world with ultrasonic.",
    criteria: "Day 2 · M2.6 (Session 3 online)",
    icon: "sensors",
    tone: "tertiary",
  },
  {
    slug: "shipper",
    name: "Shipper",
    description: "Delivered a final pitch — you shipped.",
    criteria: "Day 2 · M2.9 (final pitch)",
    icon: "rocket_launch",
    tone: "primary",
  },
];

// ─── Post-workshop badges (7) — earned over time on the platform ───
const PLATFORM = [
  {
    slug: "post-workshop-builder",
    name: "Post-Workshop Builder",
    description: "Posted a build update within 30 days of workshop end.",
    criteria: "Posted at least one build update within 30 days of workshop end",
    icon: "construction",
    tone: "primary",
    selfAward: true,
  },
  {
    slug: "first-improvement",
    name: "First Improvement",
    description: "Updated your team's project after the workshop.",
    criteria: "Updated team project at least once after workshop",
    icon: "trending_up",
    tone: "secondary",
    selfAward: true,
  },
  {
    slug: "helped-a-teammate",
    name: "Helped a Teammate",
    description: "Answered a Question post that was marked helpful.",
    criteria: "Replied to a 'Question' post that was marked helpful",
    icon: "volunteer_activism",
    tone: "tertiary",
    selfAward: false,
  },
  {
    slug: "three-month-streak",
    name: "3-Month Streak",
    description: "Posted every month for 3 consecutive months.",
    criteria: "Posted at least once every month for 3 consecutive months",
    icon: "local_fire_department",
    tone: "primary",
    selfAward: true,
  },
  {
    slug: "shipped-independently",
    name: "Shipped Independently",
    description: "Shipped a solo or new-team follow-up project.",
    criteria: "Posted a 'Shipped' post tagged as a solo or new-team follow-up",
    icon: "verified",
    tone: "secondary",
    selfAward: false,
  },
  {
    slug: "show-and-tell-presenter",
    name: "Show & Tell Presenter",
    description: "Presented at a quarterly Show & Tell event.",
    criteria: "Presented at a quarterly Show & Tell live event",
    icon: "co_present",
    tone: "tertiary",
    selfAward: false,
  },
  {
    slug: "mentor",
    name: "Mentor",
    description: "Helped 5+ teammates over time.",
    criteria: "Helped a Teammate × 5 (cumulative)",
    icon: "school",
    tone: "primary",
    selfAward: true,
  },
];

let createdWorkshop = 0;
let createdPlatform = 0;

for (let i = 0; i < WORKSHOP.length; i++) {
  const b = WORKSHOP[i];
  const existing = await prisma.badge.findUnique({ where: { slug: b.slug } });
  if (existing) {
    console.log(`  workshop: found "${b.name}"`);
    continue;
  }
  await prisma.badge.create({
    data: {
      ...b,
      selfAward: false,
      category: "workshop",
      order: i,
    },
  });
  createdWorkshop += 1;
  console.log(`  workshop: created "${b.name}"`);
}

for (let i = 0; i < PLATFORM.length; i++) {
  const b = PLATFORM[i];
  const existing = await prisma.badge.findUnique({ where: { slug: b.slug } });
  if (existing) {
    console.log(`  platform: found "${b.name}"`);
    continue;
  }
  await prisma.badge.create({
    data: {
      ...b,
      category: "platform",
      order: i + 100,
    },
  });
  createdPlatform += 1;
  console.log(`  platform: created "${b.name}"`);
}

await prisma.$disconnect();
console.log(
  `✔ Badge catalog ready. (workshop +${createdWorkshop}, platform +${createdPlatform})`,
);
