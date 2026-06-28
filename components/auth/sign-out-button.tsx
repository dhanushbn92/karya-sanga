"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant px-4 py-1.5 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[16px]">logout</span>
      {isPending ? "Signing out…" : "Sign out"}
    </button>
  );
}
