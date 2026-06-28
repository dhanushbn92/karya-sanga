import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { Role } from "../generated/prisma/client";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  avatarUrl: string | null;
};

/**
 * Why React `cache()` here:
 *
 * The TopNav (rendered in the root layout) and the page itself both want to
 * know "who is logged in" — TopNav for role-aware menu items, the page for
 * `requireUser` / `requireRole` gating. Without memoization, each of those
 * triggers (a) a Supabase Auth API call to validate the JWT and (b) a
 * Prisma query to load the User row. With our Supabase project in Sydney
 * and most users in India, every round trip costs ~120ms — so a single
 * page load was paying ~500-800ms in wasted auth/DB roundtrips before this.
 *
 * `cache()` dedupes by argument key (no args here = single slot) and the
 * cache is scoped to the current request, so adjacent requests still see
 * fresh state.
 */
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    const supabase = await createClient();
    let authUser: Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >["data"]["user"] = null;
    try {
      const { data } = await supabase.auth.getUser();
      authUser = data.user;
    } catch {
      return null;
    }
    if (!authUser) return null;
    const user = authUser;

    const row = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (row) return row;

    // Trigger may have failed or not been applied yet — fall back to a safe
    // upsert so the app stays usable. Defaults to `participant`.
    return prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email ?? "",
        name:
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl:
          (user.user_metadata?.avatar_url as string | undefined) ?? null,
      },
      update: {},
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });
  },
);

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    // Best-effort: include the originally-requested path so /login can
    // redirect the user back after they sign in. `headers()` is only
    // available in server components / actions, so we try/catch.
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      const path =
        h.get("x-pathname") ||
        h.get("next-url") ||
        h.get("x-invoke-path") ||
        "";
      if (path && path !== "/login") {
        redirect(`/login?redirectTo=${encodeURIComponent(path)}`);
      }
    } catch {
      // headers() unavailable — just fall through to plain /login.
    }
    redirect("/login");
  }
  return user;
}

export async function requireRole(roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
