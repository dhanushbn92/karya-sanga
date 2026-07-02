"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({
  name: z.string().min(1, "Tell us your name"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
});

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  async function handleSignup(formData: FormData) {
    const parsed = schema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      const fieldErrors: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof typeof errors;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    startTransition(async () => {
      const supabase = createClient();
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
      const { error, data } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          data: { full_name: parsed.data.name },
          emailRedirectTo: `${siteUrl}/callback`,
        },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
      } else {
        toast.success(
          "Check your email to confirm your account, then sign in.",
        );
        router.replace("/login");
      }
    });
  }

  return (
    <div className="sticker-shadow w-full max-w-md rounded-[32px] border-2 border-outline-variant bg-card p-8">
      <div className="rotate-sticker mb-6 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed">
        <span className="material-symbols-outlined text-[16px]">
          rocket_launch
        </span>
        <span className="text-xs font-bold tracking-wide">Begin your lab</span>
      </div>
      <h1 className="text-headline-lg mb-2 text-on-surface">
        Create your account
      </h1>
      <p className="mb-7 text-on-surface-variant">
        Join the workshop. You can change your name later.
      </p>

      <form action={handleSignup} className="space-y-5">
        <Field
          id="name"
          name="name"
          type="text"
          label="Name"
          autoComplete="name"
          error={errors.name}
        />
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
          autoComplete="new-password"
          error={errors.password}
        />

        <button
          type="submit"
          disabled={isPending}
          className="btn-gradient inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
        >
          {isPending ? "Creating account…" : "Create account"}
        </button>

        <p className="pt-2 text-center text-sm text-on-surface-variant">
          Already a member?{" "}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Sign in
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
