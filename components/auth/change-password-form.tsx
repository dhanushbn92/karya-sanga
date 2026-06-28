"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * Lets the signed-in user change their password. Works for both:
 *   - "I want to set a new password" (normal logged-in user)
 *   - The post-reset-link flow (Supabase exchanged the recovery code for a
 *     session at /callback; we're now signed in with the recovery scope and
 *     `updateUser({ password })` overwrites the password).
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated.");
      setPassword("");
      setConfirm("");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="sticker-shadow mt-8 space-y-4 rounded-[32px] border-2 border-outline-variant bg-card p-6 md:p-8"
    >
      <div>
        <h2 className="text-headline-md text-on-surface">Change password</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Pick at least 8 characters. If you got here from a reset email, this
          is where you set your new one.
        </p>
      </div>
      <label className="block space-y-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          New password
        </span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 font-medium text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Confirm new password
        </span>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={8}
          required
          autoComplete="new-password"
          className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 font-medium text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]">key</span>
        {isPending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
