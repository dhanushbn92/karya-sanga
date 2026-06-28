import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Resolve the hackathon config for a given workshop, with fallback.
 *
 *   1. Look up `HackathonConfig` where `cohortId === cohortId` (workshop
 *      override).
 *   2. If none exists, look up the singleton `id = "default"` row.
 *   3. If even that doesn't exist (fresh install), upsert it on the fly.
 *
 * This keeps the existing UI (which doesn't know about per-workshop config
 * yet) working while letting admins set workshop-specific deadlines + team
 * sizes via the new section on `/admin/cohorts/[id]`.
 */
export async function getHackathonConfig(cohortId: string | null) {
  if (cohortId) {
    const own = await prisma.hackathonConfig.findUnique({
      where: { cohortId },
    });
    if (own) return own;
  }
  return prisma.hackathonConfig.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}
