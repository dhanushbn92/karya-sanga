// Rewrite the seeded lessons' bodies to include `---` slide separators so
// presenter mode immediately demonstrates multi-slide flow. Idempotent —
// only updates lessons we recognize by title.
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const REWRITES = [
  {
    title: "Blink an LED with ESP32",
    body: [
      "## What you'll build",
      "",
      "A circuit that blinks an LED once per second.",
      "",
      "By the end of this lesson you'll know how to drive a GPIO pin and time things with `delay()`.",
      "",
      "---",
      "",
      "## The circuit",
      "",
      "Three things, in this exact order:",
      "",
      "1. ESP32 **GPIO 2** → 220Ω resistor",
      "2. Resistor → LED **anode** (long leg)",
      "3. LED **cathode** (short leg) → **GND**",
      "",
      "Wrong direction? The LED just stays dark — flip it.",
      "",
      "---",
      "",
      "## The code",
      "",
      "```cpp",
      "void setup() {",
      "  pinMode(2, OUTPUT);",
      "}",
      "",
      "void loop() {",
      "  digitalWrite(2, HIGH);",
      "  delay(500);",
      "  digitalWrite(2, LOW);",
      "  delay(500);",
      "}",
      "```",
      "",
      "Read it like English: \"set pin 2 high, wait half a second, set it low, wait half a second.\"",
      "",
      "---",
      "",
      "## Try it",
      "",
      "Click **Open in Wokwi** on this lesson's page. The simulated LED should pulse twice a second. Change `500` to `100` — what happens?",
      "",
      "> Bonus: blink two LEDs on pins 2 and 4 with opposite timing.",
    ].join("\n"),
  },
  {
    title: "Read a soil moisture sensor",
    body: [
      "## What you'll learn",
      "",
      "How to read an analog sensor and turn its value into a decision (\"plant is thirsty\" / \"plant is fine\").",
      "",
      "---",
      "",
      "## The hardware",
      "",
      "- ESP32",
      "- Soil moisture sensor with VCC, GND, AOUT",
      "- A pot of soil (or your finger pressed between the prongs to test)",
      "",
      "**Wire it:**",
      "- VCC → 3V3",
      "- GND → GND",
      "- AOUT → GPIO 34",
      "",
      "Why 3V3 instead of 5V? Less current through the prongs slows corrosion. Your sensor lasts longer.",
      "",
      "---",
      "",
      "## The code",
      "",
      "```cpp",
      "void setup() {",
      "  Serial.begin(115200);",
      "  pinMode(34, INPUT);",
      "}",
      "",
      "void loop() {",
      "  int value = analogRead(34);",
      "  Serial.println(value);",
      "  delay(1000);",
      "}",
      "```",
      "",
      "`analogRead` gives a number between 0 (totally dry) and ~4095 (soaked).",
      "",
      "---",
      "",
      "## Calibrate, then decide",
      "",
      "1. Note the reading when the soil is bone dry.",
      "2. Note the reading when you've just watered it.",
      "3. Pick a threshold halfway between.",
      "4. Below threshold? Beep a buzzer, or call an AI endpoint, or post to a webhook.",
      "",
      "> The threshold is **per plant** — succulents like dry, ferns like wet.",
    ].join("\n"),
  },
];

let updated = 0;
for (const r of REWRITES) {
  const lesson = await prisma.lesson.findFirst({
    where: { title: r.title },
    select: { id: true },
  });
  if (!lesson) {
    console.log(`  skip — no lesson "${r.title}"`);
    continue;
  }
  await prisma.lesson.update({
    where: { id: lesson.id },
    data: { body: r.body },
  });
  updated += 1;
  console.log(`  updated "${r.title}"`);
}

await prisma.$disconnect();
console.log(`✔ ${updated} lesson(s) now have slide separators.`);
