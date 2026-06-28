// Seed a small starter library so the simulator page has content out of
// the box. Idempotent — keyed by label.
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
loadEnv({ path: ".env.local" });

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const STARTERS = [
  {
    label: "LED blink · ESP32",
    description:
      "The hello-world of microcontrollers. Wire an LED through a resistor and blink it once a second.",
    board: "esp32",
    category: "blink",
    wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
    order: 0,
  },
  {
    label: "Soil moisture reader · ESP32",
    description:
      "Two prongs, one ADC pin. Read the soil and print to serial — base for any plant project.",
    board: "esp32",
    category: "sensor",
    wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
    order: 1,
  },
  {
    label: "Ultrasonic distance · ESP32",
    description:
      "HC-SR04 measures how far away things are. Great for robot, doorbell, or alarm builds.",
    board: "esp32",
    category: "sensor",
    wokwiProjectUrl: "https://wokwi.com/projects/new/esp32",
    order: 2,
  },
  {
    label: "Push-button + buzzer · Arduino UNO",
    description:
      "Press the button → beep the buzzer. Classic input → output circuit on Arduino.",
    board: "arduino-uno",
    category: "actuator",
    wokwiProjectUrl: "https://wokwi.com/projects/new/arduino-uno",
    order: 3,
  },
];

for (const s of STARTERS) {
  const existing = await prisma.wokwiStarter.findFirst({
    where: { label: s.label },
    select: { id: true },
  });
  if (existing) {
    console.log(`  found "${s.label}"`);
    continue;
  }
  await prisma.wokwiStarter.create({
    data: { ...s, published: true },
  });
  console.log(`  created "${s.label}"`);
}

await prisma.$disconnect();
console.log("✔ Starters seeded.");
