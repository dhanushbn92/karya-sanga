/**
 * Karya Sanga v1 component reference catalog.
 *
 * Decision (locked at kickoff): core kit + HC-SR04 + soil moisture.
 * **No PIR motion sensor** in v1 — explicitly de-scoped by the user.
 *
 * Each card answers four questions a kid will ask:
 *   - What is it?
 *   - What does it do?
 *   - How do I wire it to the ESP32?
 *   - Where do I see it working?  (→ Wokwi link)
 *
 * About the Wokwi link: we deliberately link to `wokwi.com/projects/new/<board>`
 * (a stable Wokwi endpoint that opens a fresh editor for the board) rather
 * than specific project IDs. Specific IDs can be deleted/privatised by their
 * authors, which 404s our kids. The instructor can curate real demos via the
 * starter library at /admin/simulator/starters and link there if they want
 * polished "see it running" pages.
 */

export type ComponentTone = "primary" | "secondary" | "tertiary";
export type ComponentBoard = "esp32" | "arduino-uno";

export type ComponentCard = {
  slug: string;
  name: string;
  icon: string; // Material Symbols name
  tagline: string;
  category: "core" | "sensor" | "actuator";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  tone: ComponentTone;
  description: string;
  pins: { label: string; role: string }[];
  wiring: string[]; // bullet list of "Connect X to Y"
  /// Which Wokwi board page the "Try in Wokwi" button opens.
  board: ComponentBoard;
};

/**
 * Stable "open a fresh project" URL. Wokwi maintains this endpoint as the
 * documented entry point — it never 404s.
 */
export function wokwiNewProjectUrl(board: ComponentBoard): string {
  return `https://wokwi.com/projects/new/${board}`;
}

export const COMPONENT_CATALOG: ComponentCard[] = [
  {
    slug: "esp32",
    name: "ESP32",
    icon: "memory",
    tagline: "The brain of every lab.",
    category: "core",
    difficulty: "Beginner",
    tone: "primary",
    description:
      "A small but mighty microcontroller with Wi-Fi and Bluetooth built in. The ESP32 reads signals from sensors, talks to AI models over the network, and tells lights, buzzers, and motors what to do.",
    pins: [
      { label: "3V3 / 5V", role: "Power for everything else" },
      { label: "GND", role: "Common ground — every circuit needs one" },
      { label: "GPIO", role: "Digital + analog input/output pins" },
    ],
    wiring: [
      "Plug it into a breadboard so its pin labels sit alongside two power rails.",
      "Connect 3V3 to the breadboard's red rail and GND to the blue rail.",
      "Use any GPIO pin to drive an LED or read a sensor.",
    ],
    board: "esp32",
  },
  {
    slug: "breadboard",
    name: "Breadboard",
    icon: "grid_view",
    tagline: "Build circuits without solder.",
    category: "core",
    difficulty: "Beginner",
    tone: "secondary",
    description:
      "A reusable board full of tiny holes. Push wires and components in and they connect electrically along hidden strips. The two side rails carry power; the middle rows carry signal.",
    pins: [
      { label: "Power rails", role: "The long red and blue strips on each side" },
      { label: "Tie points", role: "Sets of 5 holes that share a connection" },
    ],
    wiring: [
      "Power rails first: 3V3 to red, GND to blue.",
      "Stand the ESP32 across the middle gap so its left and right pins are on different rows.",
      "Build outward from there — sensors and LEDs sit in the rows on either side.",
    ],
    board: "esp32",
  },
  {
    slug: "jumper-wires",
    name: "Jumper wires",
    icon: "cable",
    tagline: "Connect anything to anything.",
    category: "core",
    difficulty: "Beginner",
    tone: "tertiary",
    description:
      "Short colored wires with metal pins on each end. Use them to route power, ground, and signals between the ESP32, the breadboard, and any component. The colors don't matter electrically — but using red for power and black for ground keeps your circuit readable.",
    pins: [
      { label: "Male / Male", role: "Connects breadboard to breadboard" },
      { label: "Male / Female", role: "Connects breadboard to a sensor module" },
      { label: "Female / Female", role: "Sensor module to sensor module" },
    ],
    wiring: [
      "Red wires for VCC (positive power).",
      "Black or blue for GND.",
      "Any other color for signal — pick consistent colors per project.",
    ],
    board: "esp32",
  },
  {
    slug: "led",
    name: "LED",
    icon: "lightbulb",
    tagline: "Tiny lights that obey your code.",
    category: "actuator",
    difficulty: "Beginner",
    tone: "primary",
    description:
      "A Light-Emitting Diode glows when current flows the right way through it. The long leg is the anode (+), the short leg is the cathode (-). Always pair it with a resistor or you'll burn it out instantly.",
    pins: [
      { label: "Anode (long leg)", role: "Connect to a GPIO pin (through a resistor)" },
      { label: "Cathode (short leg)", role: "Connect to GND" },
    ],
    wiring: [
      "GPIO 2 → 220Ω resistor → LED anode → LED cathode → GND.",
      "Wrong direction means no light — just flip the LED.",
      "Use digitalWrite(2, HIGH) to turn it on, LOW to turn it off.",
    ],
    board: "esp32",
  },
  {
    slug: "resistor",
    name: "Resistor",
    icon: "tune",
    tagline: "Slow the current down so nothing burns.",
    category: "core",
    difficulty: "Beginner",
    tone: "secondary",
    description:
      "A small striped cylinder that limits how much current flows. For most LED projects, 220Ω or 330Ω is perfect. The colored bands tell you the value — there are tables online, but Wokwi labels every resistor for you.",
    pins: [
      { label: "Either leg", role: "Resistors don't have a direction" },
    ],
    wiring: [
      "Place between a GPIO pin and the LED anode.",
      "Or pull a button pin up to 3V3 (10kΩ) so the input has a clean default.",
    ],
    board: "esp32",
  },
  {
    slug: "push-button",
    name: "Push button",
    icon: "smart_button",
    tagline: "Detect a press.",
    category: "core",
    difficulty: "Beginner",
    tone: "tertiary",
    description:
      "A momentary switch — pressed means connected, released means open. Use it to control your circuit with a finger. With a pull-up resistor (or the ESP32's internal one), you read HIGH when the button is up and LOW when it's pressed.",
    pins: [
      { label: "Two diagonal pins", role: "The pair that's active when pressed" },
    ],
    wiring: [
      "One side of the button to GND.",
      "Other side to a GPIO with pinMode(pin, INPUT_PULLUP).",
      "digitalRead(pin) returns LOW when pressed.",
    ],
    board: "esp32",
  },
  {
    slug: "buzzer",
    name: "Buzzer",
    icon: "campaign",
    tagline: "Make sounds, alarms, and beeps.",
    category: "actuator",
    difficulty: "Beginner",
    tone: "primary",
    description:
      "A small speaker that converts electrical pulses to sound. Active buzzers beep when powered; passive buzzers play notes when you send them a frequency from the ESP32's tone() function.",
    pins: [
      { label: "+ (longer leg)", role: "Connect to a GPIO" },
      { label: "− (shorter leg)", role: "Connect to GND" },
    ],
    wiring: [
      "GPIO 5 → buzzer + → buzzer − → GND.",
      "Active buzzer: digitalWrite(5, HIGH) to beep.",
      "Passive buzzer: tone(5, 440) for an A4 note, noTone(5) to stop.",
    ],
    board: "esp32",
  },
  {
    slug: "hc-sr04",
    name: "HC-SR04 ultrasonic",
    icon: "sensors",
    tagline: "Measure how far away something is.",
    category: "sensor",
    difficulty: "Intermediate",
    tone: "secondary",
    description:
      "An ultrasonic distance sensor with two 'eyes' that send out a sound pulse and listen for its echo. Time how long the echo takes to come back and you know the distance. Great for robots, alarms, and 'is something in front of me?' projects.",
    pins: [
      { label: "VCC", role: "5V" },
      { label: "GND", role: "Ground" },
      { label: "Trig", role: "Sends the pulse (output from ESP32)" },
      { label: "Echo", role: "Reports the pulse return (input to ESP32)" },
    ],
    wiring: [
      "VCC to 5V, GND to GND.",
      "Trig to GPIO 5 (output).",
      "Echo to GPIO 18 (input).",
      "Distance in cm ≈ pulse duration in µs / 58.",
    ],
    board: "esp32",
  },
  {
    slug: "soil-moisture",
    name: "Soil moisture sensor",
    icon: "grass",
    tagline: "Know when your plant is thirsty.",
    category: "sensor",
    difficulty: "Intermediate",
    tone: "tertiary",
    description:
      "Two metal prongs you stick into soil. They measure electrical conductivity between the prongs — wetter soil conducts more, drier soil less. Output is an analog value the ESP32 reads on an ADC pin.",
    pins: [
      { label: "VCC", role: "3V3 (use 3V3, not 5V, to slow corrosion)" },
      { label: "GND", role: "Ground" },
      { label: "AOUT", role: "Analog signal — wetter = lower value" },
    ],
    wiring: [
      "VCC to 3V3, GND to GND.",
      "AOUT to a GPIO that supports analog input (e.g. GPIO 34).",
      "analogRead(34) gives 0 (dry) to ~4095 (wet). Calibrate per plant.",
    ],
    board: "esp32",
  },
];

export function getComponent(slug: string): ComponentCard | undefined {
  return COMPONENT_CATALOG.find((c) => c.slug === slug);
}
