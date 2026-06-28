import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  adminAwardBadge,
  adminRevokeBadge,
} from "@/lib/actions/alumni";

export const metadata = { title: "Badges · Admin" };

export default async function BadgesAdminPage() {
  await requireRole(["admin", "instructor"]);

  const [badges, users, recent] = await Promise.all([
    prisma.badge.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }] }),
    prisma.user.findMany({
      where: { role: { in: ["participant", "judge"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.earnedBadge.findMany({
      orderBy: { earnedAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, email: true } },
        badge: { select: { name: true, icon: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Badges
      </span>
      <h1 className="text-headline-lg text-on-surface">Award badges</h1>
      <p className="mt-2 text-on-surface-variant">
        Pick a person and a badge. The badge appears on their profile
        immediately.
      </p>

      <section className="glass-card mt-8 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">Award</h2>
        <form
          action={adminAwardBadge}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <label className="md:col-span-5 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Person
            </span>
            <select
              name="userId"
              required
              defaultValue=""
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="" disabled>
                Pick a person…
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {(u.name ?? u.email.split("@")[0])} &lt;{u.email}&gt;
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-4 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Badge
            </span>
            <select
              name="badgeSlug"
              required
              defaultValue=""
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="" disabled>
                Pick a badge…
              </option>
              <optgroup label="Workshop">
                {badges
                  .filter((b) => b.category === "workshop")
                  .map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Platform">
                {badges
                  .filter((b) => b.category === "platform")
                  .map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Note (optional)
            </span>
            <input
              type="text"
              name="note"
              maxLength={280}
              placeholder="Why?"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12">
            <button
              type="submit"
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                workspace_premium
              </span>
              Award badge
            </button>
          </div>
        </form>
      </section>

      <section className="mt-10">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Recently awarded
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No badges awarded yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((eb) => (
              <li
                key={eb.id}
                className="glass-card flex items-center justify-between gap-3 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-primary">
                    {eb.badge.icon}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-on-surface">
                      <span className="text-primary">{eb.badge.name}</span> →{" "}
                      {eb.user.name ?? eb.user.email.split("@")[0]}
                    </div>
                    <div className="mono-label text-on-surface-variant">
                      {new Date(eb.earnedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <form action={adminRevokeBadge}>
                  <input type="hidden" name="id" value={eb.id} />
                  <button
                    type="submit"
                    className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
