import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db, cohort, user as userTable, team, cohortPost } from "@/lib/db";
import { createCohort } from "@/lib/actions/alumni";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Workshops · Admin" };

export default async function CohortsAdminPage() {
  await requireRole(["admin", "instructor"]);

  const cohortRows = await db
    .select({
      id: cohort.id,
      name: cohort.name,
      current: cohort.current,
      members: db.$count(userTable, eq(userTable.cohortId, cohort.id)),
      projects: db.$count(team, eq(team.cohortId, cohort.id)),
      posts: db.$count(cohortPost, eq(cohortPost.cohortId, cohort.id)),
    })
    .from(cohort)
    .orderBy(desc(cohort.current), desc(cohort.startedOn));

  // Map flat counts into the _count shape the JSX expects.
  const cohorts = cohortRows.map((c) => ({
    ...c,
    _count: { members: c.members, projects: c.projects, posts: c.posts },
  }));

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Workshops
      </span>
      <h1 className="text-headline-lg text-on-surface">Workshops</h1>
      <p className="mt-2 text-on-surface-variant">
        Each workshop run is its own space. Members are added by editing
        a workshop. Only one can be marked &quot;current&quot; at a time.
      </p>

      {/* Create */}
      <section className="glass-card mt-10 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Create a workshop
        </h2>
        <form
          action={createCohort}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <label className="md:col-span-5 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Name
            </span>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="Workshop 1 · Jan 2026"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Started on
            </span>
            <input
              type="date"
              name="startedOn"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Ended on
            </span>
            <input
              type="date"
              name="endedOn"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="new-current"
            className="md:col-span-1 flex items-end gap-2 pb-2"
          >
            <input
              id="new-current"
              type="checkbox"
              name="current"
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">Current</span>
          </label>
          <label className="md:col-span-12 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Description
            </span>
            <textarea
              name="description"
              rows={2}
              maxLength={1000}
              placeholder="A line about who this workshop is for, what they're working on."
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12">
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                add
              </span>
              Create workshop
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">All workshops</h2>
          <span className="mono-label text-on-surface-variant">
            {cohorts.length} total
          </span>
        </div>
        {cohorts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No workshops yet. Create the first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {cohorts.map((c) => (
              <li key={c.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-medium text-on-surface">
                        {c.name}
                      </h3>
                      {c.current && (
                        <span className="mono-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mono-label mt-1 text-on-surface-variant">
                      {c._count.members} members · {c._count.projects} projects
                      · {c._count.posts} post
                      {c._count.posts === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/cohorts/${c.id}`}
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                    >
                      Preview
                    </Link>
                    <Link
                      href={`/admin/cohorts/${c.id}`}
                      className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-on-primary hover:brightness-110"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
