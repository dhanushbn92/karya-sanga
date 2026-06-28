"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") ?? "/dashboard";
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );

  async function handleEmailLogin(formData: FormData) {
    const parsed = schema.safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "password";
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        toast.error(error.message);
        return;
      }
      router.replace(redirectTo);
      router.refresh();
    });
  }

  return (
    <div className="sticker-shadow w-full max-w-md rounded-[32px] border-2 border-outline-variant bg-card p-8">
      <div className="rotate-sticker mb-6 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container">
        <span className="material-symbols-outlined text-[16px]">waving_hand</span>
        <span className="text-xs font-bold tracking-wide">Welcome back</span>
      </div>
      <h1 className="text-headline-lg mb-2 text-on-surface">Sign in</h1>
      <p className="mb-7 text-on-surface-variant">
        Continue your lab adventure.
      </p>

      <form action={handleEmailLogin} className="space-y-5">
        <Field
          id="email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          error={errors.email}
        />
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password}
        />

        <div className="-mt-2 text-right">
          <Link
            href="/reset-password"
            className="text-xs font-bold text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="sticker-shadow inline-flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-60"
        >
          {isPending ? "Signing in…" : "Sign in"}
        </button>

        <p className="pt-2 text-center text-sm text-on-surface-variant">
          New here?{" "}
          <Link href="/signup" className="font-bold text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}

function Field({
  id,
  name,
  type,
  label,
  autoComplete,
  error,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  autoComplete: string;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-sm font-bold text-on-surface-variant"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        aria-invalid={!!error}
        className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 font-medium text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 aria-[invalid=true]:border-destructive"
      />
      {error && (
        <p className="text-xs font-bold text-destructive">{error}</p>
      )}
    </div>
  );
}
