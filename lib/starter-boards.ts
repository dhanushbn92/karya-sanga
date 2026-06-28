/**
 * Boards we support for Wokwi starters + the one-click "new project"
 * launchers. Mirrors the slugs Wokwi exposes at
 *   https://wokwi.com/projects/new/<board>
 */
export const STARTER_BOARDS = [
  "esp32",
  "esp32-s3",
  "esp32-c3",
  "esp32-c6",
  "esp32-h2",
  "arduino-uno",
  "arduino-mega",
  "raspberry-pi-pico",
] as const;

export type StarterBoard = (typeof STARTER_BOARDS)[number];
