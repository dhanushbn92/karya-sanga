import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";

export const metadata = { title: "Reset password · Yukti AI Labs" };

/**
 * Password reset request page. The form submits to `requestPasswordReset`
 * which always redirects to `?sent=1` (regardless of whether the email
 * exists) so we don't reveal account enumeration. The user follows the
 * recovery link from their inbox; the link lands at `/callback` and lets
 * them set a new password from `/settings/profile`.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const wasSent = sent === "1";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="sticker-shadow w-full rounded-[32px] border-2 border-outline-variant bg-card p-8">
        <div className="rotate-sticker mb-6 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container">
          <span className="material-symbols-outlined text-[16px]">
            lock_reset
          </span>
          <span className="text-xs font-bold tracking-wide">
            Forgot password
          </span>
        </div>
        <h1 className="text-headline-lg mb-2 text-on-surface">
          Reset your password
        </h1>

        {wasSent ? (
          <>
            <p className="mb-7 text-on-surface-variant">
              If an account exists for that email, we&apos;ve sent a reset
              link. Open it on this device to set a new password.
            </p>
            <Link
              href="/login"
              className="sticker-shadow inline-flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                arrow_back
              </span>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-7 text-on-surface-variant">
              Enter your email — we&apos;ll send you a link to set a new
              password.
            </p>
            {error && (
              <p className="mb-4 rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-3 text-sm font-bold text-destructive">
                {error}
              </p>
            )}
            <form action={requestPasswordReset} className="space-y-5">
              <label
                htmlFor="email"
                className="block space-y-2 text-sm font-bold text-on-surface-variant"
              >
                Email
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="block w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                />
              </label>
              <button
                type="submit"
                className="sticker-shadow inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 font-bold text-on-primary"
              >
                <span className="material-symbols-outlined text-[18px]">
                  send
                </span>
                Send reset link
              </button>
              <p className="pt-2 text-center text-sm text-on-surface-variant">
                Remember it?{" "}
                <Link
                  href="/login"
                  className="font-bold text-primary hover:underline"
                >
                  Back to sign in
                </Link>
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
