"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, user, cohort, userCohort } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Bulk-add people to a workshop.
 *
 * Input: a textarea with one line per person, fields separated by commas:
 *
 *   Name, email, DOB(optional)
 *
 *   Dhanush B, dhanush@example.com, 1992-05-27
 *   Asha M, asha@example.com
 *
 * For each row:
 *   - If a User with that email already exists → they're added to the workshop
 *     via the UserCohort join. No password change.
 *   - If not → we create a Supabase auth user with a generated starter
 *     password (see `generatePassword`), write name + dob to public.User,
 *     and add them via UserCohort.
 *
 * Generated passwords are flashed back to the admin once (via the URL search
 * params). Admins should share them with the new users out-of-band.
 *
 * Password pattern:
 *   With DOB:    <firstname>@karya<DDMM>     (e.g. dhanush@karya2705)
 *   Without DOB: <firstname>@karya<YY>       (e.g. dhanush@karya26)
 *
 * Both meet Supabase's default 8+ char rule and include an `@` so the user's
 * password manager won't auto-clear it as a weak pattern.
 */

type RowResult =
  | { kind: "created"; email: string; name: string; password: string }
  | { kind: "added"; email: string; name: string }
  | { kind: "error"; email: string; name: string; message: string };

function sanitizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function firstNameClean(name: string, fallback: string): string {
  const base = name.split(/\s+/)[0] || fallback;
  return base.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function generatePassword(name: string, email: string, dob: Date | null): string {
  const local = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "user";
  const first = firstNameClean(name, local);
  if (dob) {
    const dd = String(dob.getUTCDate()).padStart(2, "0");
    const mm = String(dob.getUTCMonth() + 1).padStart(2, "0");
    return `${first}@karya${dd}${mm}`;
  }
  const yy = String(new Date().getUTCFullYear()).slice(-2);
  return `${first}@karya${yy}`;
}

function parseRow(line: string): {
  name: string;
  email: string;
  dob: Date | null;
} | null {
  const parts = line
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 2) return null;
  const [rawName, rawEmail, rawDob] = parts;
  const name = sanitizeName(rawName);
  const email = rawEmail.toLowerCase();
  if (!/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(email)) return null;
  let dob: Date | null = null;
  if (rawDob) {
    // Accept YYYY-MM-DD; ignore anything else.
    const m = rawDob.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (y > 1900 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        dob = new Date(Date.UTC(y, mo - 1, d));
      }
    }
  }
  return { name, email, dob };
}

export async function bulkAddPeopleToWorkshop(
  formData: FormData,
): Promise<void> {
  await requireRole(["admin", "instructor"]);
  const cohortId = String(formData.get("cohortId") ?? "");
  const raw = String(formData.get("rows") ?? "");
  if (!cohortId) throw new Error("Missing workshop");

  // Confirm cohort exists (avoids leaking IDs).
  const cohortRow = await db.query.cohort.findFirst({
    where: eq(cohort.id, cohortId),
    columns: { id: true },
  });
  if (!cohortRow) throw new Error("Workshop not found");

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) {
    redirect(`/admin/cohorts/${cohortId}`);
  }
  if (lines.length > 200) {
    throw new Error("Too many rows — keep it under 200 per batch.");
  }

  const admin = createAdminClient();
  const results: RowResult[] = [];

  for (const line of lines) {
    const parsed = parseRow(line);
    if (!parsed) {
      results.push({
        kind: "error",
        email: line,
        name: "(unparsed row)",
        message: "Expected: Name, email[, YYYY-MM-DD]",
      });
      continue;
    }
    try {
      // Already on the platform?
      const existing = await db.query.user.findFirst({
        where: eq(user.email, parsed.email),
        columns: { id: true, name: true },
      });
      if (existing) {
        await db
          .insert(userCohort)
          .values({
            id: createId(),
            userId: existing.id,
            cohortId,
          })
          .onConflictDoNothing({
            target: [userCohort.userId, userCohort.cohortId],
          });
        results.push({
          kind: "added",
          email: parsed.email,
          name: existing.name ?? parsed.name,
        });
        continue;
      }

      // New person → create Supabase auth user.
      const password = generatePassword(parsed.name, parsed.email, parsed.dob);
      const { data: created, error } = await admin.auth.admin.createUser({
        email: parsed.email,
        password,
        email_confirm: true,
        user_metadata: { full_name: parsed.name },
      });
      if (error || !created.user) {
        throw new Error(error?.message ?? "Failed to create auth user");
      }

      // Upsert the public.User row in case the auth trigger raced us, then
      // set the fields we care about + primary cohortId.
      await db
        .insert(user)
        .values({
          id: created.user.id,
          email: parsed.email,
          name: parsed.name,
          dob: parsed.dob,
          cohortId,
        })
        .onConflictDoUpdate({
          target: user.id,
          set: {
            name: parsed.name,
            dob: parsed.dob,
            cohortId,
          },
        });
      // Also drop a UserCohort row so they show up via the join as well —
      // future workshops use this join exclusively.
      await db
        .insert(userCohort)
        .values({
          id: createId(),
          userId: created.user.id,
          cohortId,
        })
        .onConflictDoNothing({
          target: [userCohort.userId, userCohort.cohortId],
        });

      results.push({
        kind: "created",
        email: parsed.email,
        name: parsed.name,
        password,
      });
    } catch (err) {
      results.push({
        kind: "error",
        email: parsed.email,
        name: parsed.name,
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  revalidatePath(`/admin/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}`);
  revalidatePath(`/cohorts/${cohortId}/people`);

  // Stash results in URL so the page can show passwords once. Encoded so a
  // copy/paste of the admin URL doesn't accidentally leak via referer.
  const encoded = Buffer.from(JSON.stringify(results), "utf8").toString(
    "base64url",
  );
  redirect(`/admin/cohorts/${cohortId}?bulk=${encoded}`);
}
