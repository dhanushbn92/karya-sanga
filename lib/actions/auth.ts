"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

const resetSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

/**
 * Request a password-reset email via Supabase. We use the admin client and
 * the recovery flow — Supabase sends the email; clicking the link drops the
 * user back at /callback (already wired) which exchanges the recovery code
 * for a session. The user is then redirected to /settings/profile where they
 * can set a new password.
 *
 * Always redirects to a "check your inbox" page even on error so we don't
 * leak whether an email is registered.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<void> {
  const parsed = resetSchema.safeParse({
    email: String(formData.get("email") ?? "").toLowerCase(),
  });
  if (!parsed.success) {
    redirect(
      `/reset-password?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Invalid email",
      )}`,
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    "http://localhost:3001";

  const admin = createAdminClient();
  // Fire-and-forget: don't block redirect on the email round-trip, and don't
  // reveal whether the email exists.
  try {
    await admin.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${siteUrl}/callback?next=/settings/profile`,
    });
  } catch {
    // Swallow — the redirect below shows the generic "check your inbox" page.
  }

  redirect("/reset-password?sent=1");
}
