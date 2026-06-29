import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, inArray, or, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import {
  db,
  cohort as cohortTable,
  user as userTable,
  userCohort,
  workshopModule,
  module as moduleTable,
  badge,
  hackathonConfig,
  workshopFeedback,
} from "@/lib/db";
import {
  addUserToWorkshop,
  adminAssignUserToCohort,
  adminAwardBadge,
  createWorkshopBadge,
  deleteCohort,
  deleteWorkshopBadge,
  removeUserFromWorkshop,
  updateCohort,
} from "@/lib/actions/alumni";
import { bulkAddPeopleToWorkshop } from "@/lib/actions/bulk-people";
import {
  clearWorkshopHackathonConfig,
  setWorkshopHackathonConfig,
} from "@/lib/actions/admin-hackathon";
import {
  attachModuleToCohort,
  detachModuleFromCohort,
  moveAttachedModule,
} from "@/lib/actions/admin-lessons";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Edit workshop · Admin" };

type BulkResult =
  | { kind: "created"; email: string; name: string; password: string }
  | { kind: "added"; email: string; name: string }
  | { kind: "error"; email: string; name: string; message: string };

function decodeBulkResults(value: string | undefined): BulkResult[] | null {
  if (!value) return null;
  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    return parsed as BulkResult[];
  } catch {
    return null;
  }
}

export default async function CohortEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bulk?: string }>;
}) {
  await requireRole(["admin", "instructor"]);
  const { id } = await params;
  const { bulk } = await searchParams;
  const bulkResults = decodeBulkResults(bulk);

  const [
    cohort,
    allCohorts,
    allUsers,
    everyUser,
    secondaryMembersRaw,
    attachedRowsRaw,
    allModulesRaw,
    workshopBadgesRaw,
    workshopHackathonConfig,
    feedbackRows,
  ] = await Promise.all([
      db.query.cohort
        .findFirst({
          where: eq(cohortTable.id, id),
          with: {
            users: {
              columns: {
                id: true,
                email: true,
                name: true,
                handle: true,
                role: true,
              },
              orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
            },
          },
        })
        .then((c) =>
          c
            ? // Map the `users` relation to the `members` key the JSX reads.
              { ...c, members: c.users }
            : undefined,
        ),
      db.query.cohort.findMany({ orderBy: (c, { asc }) => [asc(c.name)] }),
      db.query.user.findMany({
        where: and(
          or(isNull(userTable.cohortId), eq(userTable.cohortId, id)),
          inArray(userTable.role, ["participant", "judge"]),
        ),
        orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
        columns: {
          id: true,
          email: true,
          name: true,
          cohortId: true,
        },
      }),
      // For the "Also enrolled" picker: every participant/judge in the system
      // so admins can add a user already in a *different* primary workshop.
      db.query.user.findMany({
        where: inArray(userTable.role, ["participant", "judge"]),
        orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
        columns: {
          id: true,
          email: true,
          name: true,
          cohortId: true,
        },
        with: {
          cohort: { columns: { name: true } },
        },
      }),
      // Users joined to this workshop via UserCohort whose primary cohort
      // is different. These are the "secondary" members displayed separately.
      db.query.userCohort.findMany({
        where: eq(userCohort.cohortId, id),
        with: {
          user: {
            columns: {
              id: true,
              email: true,
              name: true,
              handle: true,
              role: true,
              cohortId: true,
            },
            with: {
              cohort: { columns: { id: true, name: true } },
            },
          },
        },
        orderBy: (uc, { asc }) => [asc(uc.joinedAt)],
      }),
      db.query.workshopModule.findMany({
        where: eq(workshopModule.cohortId, id),
        orderBy: (wm, { asc }) => [asc(wm.order)],
        with: {
          module: {
            columns: {
              id: true,
              title: true,
              description: true,
              published: true,
            },
            with: {
              lessons: { columns: { id: true } },
            },
          },
        },
      }),
      db.query.module.findMany({
        orderBy: (m, { asc }) => [asc(m.order)],
        columns: {
          id: true,
          title: true,
          description: true,
          published: true,
        },
        with: {
          lessons: { columns: { id: true } },
        },
      }),
      db.query.badge.findMany({
        where: eq(badge.cohortId, id),
        orderBy: (b, { asc }) => [asc(b.createdAt)],
        with: {
          earnedBadges: { columns: { id: true } },
        },
      }),
      db.query.hackathonConfig.findFirst({
        where: eq(hackathonConfig.cohortId, id),
      }),
      // All feedback left for this workshop, newest first, with the author so
      // the admin view can show name + stars + comment and an average.
      db.query.workshopFeedback.findMany({
        where: eq(workshopFeedback.cohortId, id),
        orderBy: (f, { desc }) => [desc(f.createdAt)],
        with: {
          user: { columns: { id: true, name: true, email: true, handle: true } },
        },
      }),
    ]);
  if (!cohort) notFound();

  // The Prisma query filtered UserCohort rows to users whose *primary* cohort
  // differs from this one (`user: { cohortId: { not: id } }`). Drizzle can't
  // express that relation filter inline, so apply it here.
  const secondaryMembers = secondaryMembersRaw.filter(
    (row) => row.user.cohortId !== id,
  );

  // Translate the nested module._count.lessons via fetched-rows length.
  const attachedRows = attachedRowsRaw.map((row) => ({
    ...row,
    module: {
      ...row.module,
      _count: { lessons: row.module.lessons.length },
    },
  }));
  const allModules = allModulesRaw.map((m) => ({
    ...m,
    _count: { lessons: m.lessons.length },
  }));

  // Translate badge._count.earned (earnedBadges relation) via rows length.
  const workshopBadges = workshopBadgesRaw.map((b) => ({
    ...b,
    _count: { earned: b.earnedBadges.length },
  }));

  const attachedIds = new Set(attachedRows.map((r) => r.moduleId));
  const unattachedModules = allModules.filter((m) => !attachedIds.has(m.id));

  // Workshop feedback summary — average rating across all ratings left.
  const feedbackCount = feedbackRows.length;
  const avgRating =
    feedbackCount === 0
      ? 0
      : feedbackRows.reduce((s, f) => s + f.rating, 0) / feedbackCount;

  // For the secondary-membership picker: people not already in this workshop
  // (primary OR secondary). Primary-cohort name shown as context.
  const primaryMemberIds = new Set(
    cohort?.members.map((m) => m.id) ?? [],
  );
  const secondaryMemberIds = new Set(
    secondaryMembers.map((r) => r.user.id),
  );
  const addableUsers = everyUser.filter(
    (u) => !primaryMemberIds.has(u.id) && !secondaryMemberIds.has(u.id),
  );

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toISOString().slice(0, 10) : "";

  const unassigned = allUsers.filter((u) => u.cohortId === null);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin/cohorts"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← All workshops
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Workshop
      </span>
      <h1 className="text-headline-lg text-on-surface">{cohort.name}</h1>

      {/* Settings */}
      <section className="glass-card mt-8 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">Settings</h2>
        <form
          action={updateCohort}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <input type="hidden" name="id" value={cohort.id} />
          <label className="md:col-span-5 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Name
            </span>
            <input
              type="text"
              name="name"
              required
              defaultValue={cohort.name}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Started on
            </span>
            <input
              type="date"
              name="startedOn"
              defaultValue={formatDate(cohort.startedOn)}
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
              defaultValue={formatDate(cohort.endedOn)}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label htmlFor="current" className="md:col-span-1 flex items-end gap-2 pb-2">
            <input
              id="current"
              type="checkbox"
              name="current"
              defaultChecked={cohort.current}
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
              defaultValue={cohort.description ?? ""}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12">
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
              Save
            </SubmitButton>
          </div>
        </form>

        <form
          action={deleteCohort}
          className="mt-6 border-t border-white/10 pt-4"
        >
          <input type="hidden" name="id" value={cohort.id} />
          <SubmitButton
            className="mono-label inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-destructive hover:bg-destructive/10"
          >
            <span className="material-symbols-outlined text-[12px]">
              delete
            </span>
            Delete workshop (members are removed)
          </SubmitButton>
        </form>
      </section>

      {/* Roster */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">Members</h2>
          <span className="mono-label text-on-surface-variant">
            {cohort.members.length} member
            {cohort.members.length === 1 ? "" : "s"}
          </span>
        </div>

        {cohort.members.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-on-surface-variant">
            No members yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {cohort.members.map((m) => (
              <li
                key={m.id}
                className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-on-surface">
                    {m.name ?? m.email.split("@")[0]}
                  </div>
                  <div className="truncate text-[11px] text-on-surface-variant">
                    {m.email} · {m.role}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Award one of this workshop's badges to this member. */}
                  {workshopBadges.length > 0 ? (
                    <form
                      action={adminAwardBadge}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={m.id} />
                      <label className="sr-only" htmlFor={`badge-${m.id}`}>
                        Badge to award
                      </label>
                      <select
                        id={`badge-${m.id}`}
                        name="badgeSlug"
                        required
                        defaultValue=""
                        className="rounded-full border border-white/10 bg-surface-container-low px-3 py-1 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="" disabled>
                          Award badge…
                        </option>
                        {workshopBadges.map((b) => (
                          <option key={b.id} value={b.slug}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-on-primary hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          workspace_premium
                        </span>
                        Award
                      </SubmitButton>
                    </form>
                  ) : (
                    <span className="mono-label text-on-surface-variant">
                      Create a workshop badge to award
                    </span>
                  )}
                  <form action={adminAssignUserToCohort}>
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="cohortId" value="" />
                    <SubmitButton
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        remove
                      </span>
                      Remove
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        {unassigned.length > 0 && (
          <div className="glass-card mt-6 rounded-3xl p-6">
            <h3 className="text-headline-md mb-3 text-on-surface">
              Add member
            </h3>
            <form
              action={adminAssignUserToCohort}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="cohortId" value={cohort.id} />
              <label className="space-y-2">
                <span className="mono-label block text-on-surface-variant">
                  Unassigned user
                </span>
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="rounded-xl border border-white/10 bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="" disabled>
                    Pick…
                  </option>
                  {unassigned.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name ?? u.email.split("@")[0])} &lt;{u.email}&gt;
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton
                className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-on-primary hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[14px]">
                  add
                </span>
                Assign
              </SubmitButton>
            </form>
          </div>
        )}
      </section>

      {/* Bulk add results — only after the action redirects with ?bulk= */}
      {bulkResults && bulkResults.length > 0 && (
        <section className="mt-10 rounded-3xl border-2 border-primary bg-primary-fixed p-6 text-on-primary-fixed">
          <h2 className="text-headline-md">
            Just added {bulkResults.filter((r) => r.kind !== "error").length}{" "}
            {bulkResults.filter((r) => r.kind !== "error").length === 1
              ? "person"
              : "people"}
          </h2>
          <p className="mt-1 text-sm text-on-primary-fixed-variant">
            Share the starter passwords below with new people — they can change
            theirs from settings. This panel only shows up once; refresh and
            it&apos;s gone.
          </p>
          <ul className="mt-4 space-y-2">
            {bulkResults.map((r, i) => {
              if (r.kind === "created") {
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 text-on-surface"
                  >
                    <span className="mono-label rounded-full bg-secondary px-2 py-0.5 text-on-secondary">
                      New
                    </span>
                    <span className="font-bold">{r.name}</span>
                    <span className="text-on-surface-variant">
                      {r.email}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-2 rounded-full border-2 border-primary bg-primary-fixed px-3 py-1 font-mono text-sm text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[14px]">
                        key
                      </span>
                      {r.password}
                    </span>
                  </li>
                );
              }
              if (r.kind === "added") {
                return (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3 text-on-surface"
                  >
                    <span className="mono-label rounded-full bg-tertiary-fixed px-2 py-0.5 text-on-tertiary-fixed">
                      Added
                    </span>
                    <span className="font-bold">{r.name}</span>
                    <span className="text-on-surface-variant">
                      {r.email}
                    </span>
                    <span className="ml-auto text-[11px] text-on-surface-variant">
                      already on the platform
                    </span>
                  </li>
                );
              }
              return (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-card p-3 text-on-surface"
                >
                  <span className="mono-label rounded-full bg-destructive/20 px-2 py-0.5 text-destructive">
                    Failed
                  </span>
                  <span className="font-bold">{r.name}</span>
                  <span className="text-on-surface-variant">{r.email}</span>
                  <span className="ml-auto text-[11px] text-destructive">
                    {r.message}
                  </span>
                </li>
              );
            })}
          </ul>
          <a
            href={`/admin/cohorts/${id}`}
            className="mono-label mt-4 inline-flex items-center gap-1 rounded-full border-2 border-white/20 px-3 py-1 text-on-primary-fixed-variant hover:bg-card/20"
          >
            Dismiss
          </a>
        </section>
      )}

      {/* Bulk add — paste a list of people */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-headline-md text-on-surface">
            Add many people at once
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            One per line:{" "}
            <code className="rounded bg-surface-container px-1.5 py-0.5">
              Name, email, YYYY-MM-DD
            </code>
            . The date of birth is optional. Existing people are added to
            this workshop; new ones get a Supabase account with a starter
            password — shown to you once after the action runs.
          </p>
        </div>

        <form
          action={bulkAddPeopleToWorkshop}
          className="glass-card space-y-3 rounded-2xl p-5"
        >
          <input type="hidden" name="cohortId" value={cohort.id} />
          <label className="block space-y-1">
            <span className="mono-label block text-on-surface-variant">
              People
            </span>
            <textarea
              name="rows"
              required
              rows={6}
              placeholder={
                "Dhanush B, dhanush@example.com, 1992-05-27\nAsha M, asha@example.com\n# Lines starting with # are ignored"
              }
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <p className="text-[11px] text-on-surface-variant">
            Password pattern:{" "}
            <code className="rounded bg-surface-container px-1.5">
              firstname@karya&lt;DDMM&gt;
            </code>{" "}
            if a date of birth is provided, otherwise{" "}
            <code className="rounded bg-surface-container px-1.5">
              firstname@karya&lt;YY&gt;
            </code>
            . Up to 200 people per batch.
          </p>
          <div>
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                group_add
              </span>
              Add to workshop
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Secondary members — users joined to this workshop via the
       * UserCohort join (in addition to their primary workshop).
       */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-headline-md text-on-surface">
            Also enrolled in this workshop
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            People who are in this workshop on top of their main one — like
            an alum joining a second cohort, or a mentor working with
            multiple groups.
          </p>
        </div>

        {secondaryMembers.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
            No additional members yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {secondaryMembers.map((row) => {
              const u = row.user;
              const name = u.name ?? u.email.split("@")[0];
              return (
                <li
                  key={row.id}
                  className="glass-card flex items-center justify-between rounded-xl p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 truncate text-sm font-medium text-on-surface">
                      {name}
                      {u.cohort?.name && (
                        <span className="mono-label rounded-full bg-surface-container-low px-2 py-0.5 text-on-surface-variant">
                          primary: {u.cohort.name}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-on-surface-variant">
                      {u.email} · {u.role}
                    </div>
                  </div>
                  <form action={removeUserFromWorkshop}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input
                      type="hidden"
                      name="cohortId"
                      value={cohort.id}
                    />
                    <SubmitButton
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        remove
                      </span>
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {/* Add — picker over EVERY user not already in this workshop */}
        {addableUsers.length > 0 && (
          <div className="glass-card mt-6 rounded-3xl p-6">
            <h3 className="text-headline-md mb-1 text-on-surface">
              Add someone to this workshop
            </h3>
            <p className="mb-3 text-sm text-on-surface-variant">
              Picks from anyone not already enrolled. Their primary workshop
              stays the same.
            </p>
            <form
              action={addUserToWorkshop}
              className="flex flex-wrap items-end gap-3"
            >
              <input type="hidden" name="cohortId" value={cohort.id} />
              <label className="space-y-2">
                <span className="mono-label block text-on-surface-variant">
                  Person
                </span>
                <select
                  name="userId"
                  required
                  defaultValue=""
                  className="min-w-[280px] rounded-xl border border-white/10 bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="" disabled>
                    Pick…
                  </option>
                  {addableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {(u.name ?? u.email.split("@")[0])} &lt;{u.email}&gt;
                      {u.cohort?.name ? ` · primary: ${u.cohort.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton
                className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-on-primary hover:brightness-110"
              >
                <span className="material-symbols-outlined text-[14px]">
                  add
                </span>
                Add to workshop
              </SubmitButton>
            </form>
          </div>
        )}
      </section>

      {/* Lessons — attach / detach / reorder modules from the library */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">
              Chapters in this workshop
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Pick chapters from the lesson library. Workshops can share
              chapters — the lesson content lives in one place.
            </p>
          </div>
          <Link
            href="/admin/modules"
            className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
          >
            <span className="material-symbols-outlined text-[12px]">
              edit_note
            </span>
            Edit lessons
          </Link>
        </div>

        {/* Attached (ordered) */}
        <div className="mb-6">
          <div className="mono-label mb-2 text-on-surface-variant">
            Added · {attachedRows.length} chapter
            {attachedRows.length === 1 ? "" : "s"}
          </div>
          {attachedRows.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
              No chapters added yet. Pick one from below to add it to
              this workshop.
            </p>
          ) : (
            <ul className="space-y-2">
              {attachedRows.map((row, idx) => {
                const m = row.module;
                const isFirst = idx === 0;
                const isLast = idx === attachedRows.length - 1;
                return (
                  <li
                    key={row.id}
                    className="glass-card flex items-center gap-3 rounded-xl p-3"
                  >
                    <span className="mono-label flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-on-surface">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-on-surface">
                          {m.title}
                        </span>
                        {!m.published && (
                          <span className="mono-label rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                            draft
                          </span>
                        )}
                      </div>
                      <div className="truncate text-[11px] text-on-surface-variant">
                        {m._count.lessons} lesson
                        {m._count.lessons === 1 ? "" : "s"}
                        {m.description ? ` · ${m.description}` : ""}
                      </div>
                    </div>
                    {/* Up */}
                    <form action={moveAttachedModule}>
                      <input type="hidden" name="cohortId" value={cohort.id} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="direction" value="up" />
                      <SubmitButton
                        disabled={isFirst}
                        className="mono-label inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:hover:border-white/20 disabled:hover:text-on-surface-variant"
                        title="Move up"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_upward
                        </span>
                      </SubmitButton>
                    </form>
                    {/* Down */}
                    <form action={moveAttachedModule}>
                      <input type="hidden" name="cohortId" value={cohort.id} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <input type="hidden" name="direction" value="down" />
                      <SubmitButton
                        disabled={isLast}
                        className="mono-label inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-30 disabled:hover:border-white/20 disabled:hover:text-on-surface-variant"
                        title="Move down"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          arrow_downward
                        </span>
                      </SubmitButton>
                    </form>
                    {/* Remove */}
                    <form action={detachModuleFromCohort}>
                      <input type="hidden" name="cohortId" value={cohort.id} />
                      <input type="hidden" name="moduleId" value={m.id} />
                      <SubmitButton
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          remove
                        </span>
                        Remove
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Unattached — available to add */}
        <div>
          <div className="mono-label mb-2 text-on-surface-variant">
            From the library · {unattachedModules.length} chapter
            {unattachedModules.length === 1 ? "" : "s"} you can add
          </div>
          {unattachedModules.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
              Every chapter in the library is already added.{" "}
              <Link
                href="/admin/modules"
                className="text-primary hover:underline"
              >
                Make a new chapter →
              </Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {unattachedModules.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-container-low p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-on-surface">
                        {m.title}
                      </span>
                      {!m.published && (
                        <span className="mono-label rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                          draft
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-on-surface-variant">
                      {m._count.lessons} lesson
                      {m._count.lessons === 1 ? "" : "s"}
                      {m.description ? ` · ${m.description}` : ""}
                    </div>
                  </div>
                  <form action={attachModuleToCohort}>
                    <input type="hidden" name="cohortId" value={cohort.id} />
                    <input type="hidden" name="moduleId" value={m.id} />
                    <SubmitButton
                      className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-on-primary hover:brightness-110"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        add
                      </span>
                      Add
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Workshop-scoped badges */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-headline-md text-on-surface">
            Workshop badges
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Custom badges that only exist for this workshop. Award them
            from{" "}
            <Link
              href="/admin/badges"
              className="font-bold text-primary hover:underline"
            >
              /admin/badges
            </Link>
            .
          </p>
        </div>

        <div className="mb-6">
          <div className="mono-label mb-2 text-on-surface-variant">
            Current · {workshopBadges.length} badge
            {workshopBadges.length === 1 ? "" : "s"}
          </div>
          {workshopBadges.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
              No workshop-scoped badges yet. Create one below.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {workshopBadges.map((b) => (
                <li
                  key={b.id}
                  className="glass-card flex items-center gap-3 rounded-xl p-3"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                    <span className="material-symbols-outlined text-[20px]">
                      {b.icon}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-on-surface">
                      {b.name}
                    </div>
                    <div className="truncate text-[11px] text-on-surface-variant">
                      @{b.slug} · awarded to {b._count.earned} person
                      {b._count.earned === 1 ? "" : "s"}
                    </div>
                  </div>
                  <form action={deleteWorkshopBadge}>
                    <input type="hidden" name="id" value={b.id} />
                    <input
                      type="hidden"
                      name="cohortId"
                      value={cohort.id}
                    />
                    <SubmitButton
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-2.5 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        delete
                      </span>
                      Delete
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          action={createWorkshopBadge}
          className="glass-card grid grid-cols-1 gap-3 rounded-2xl p-5 md:grid-cols-12"
        >
          <input type="hidden" name="cohortId" value={cohort.id} />
          <label className="md:col-span-3 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Slug
            </span>
            <input
              type="text"
              name="slug"
              required
              minLength={2}
              maxLength={40}
              placeholder="first-buzzer"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-4 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Name
            </span>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="First Buzzer Wired"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-3 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Icon (material symbol)
            </span>
            <input
              type="text"
              name="icon"
              required
              maxLength={40}
              defaultValue="stars"
              placeholder="campaign"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-2 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Tone
            </span>
            <select
              name="tone"
              defaultValue="primary"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="primary">Primary</option>
              <option value="secondary">Secondary</option>
              <option value="tertiary">Tertiary</option>
            </select>
          </label>
          <label className="md:col-span-12 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Description
            </span>
            <input
              type="text"
              name="description"
              required
              minLength={2}
              maxLength={280}
              placeholder="Awarded when a participant wires their first working buzzer."
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12">
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                add
              </span>
              Create badge
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Workshop feedback — read-only review of participant ratings */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">Feedback</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              What participants think of this workshop. Only you and other
              teachers see this.
            </p>
          </div>
          {feedbackCount > 0 && (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-low px-3 py-1.5">
              <Stars rating={Math.round(avgRating)} />
              <span className="mono-label text-on-surface">
                {avgRating.toFixed(1)} / 5
              </span>
              <span className="mono-label text-on-surface-variant">
                · {feedbackCount} rating{feedbackCount === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        {feedbackCount === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
            No feedback yet. Participants can rate the workshop from its
            page.
          </p>
        ) : (
          <ul className="space-y-2">
            {feedbackRows.map((f) => {
              const name = f.user.name ?? f.user.email.split("@")[0];
              return (
                <li key={f.id} className="glass-card rounded-xl p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={f.rating} />
                    <span className="mono-label text-on-surface">
                      {f.rating} / 5
                    </span>
                    <span className="text-sm font-medium text-on-surface">
                      {name}
                    </span>
                    {f.user.handle && (
                      <span className="mono-label text-on-surface-variant">
                        @{f.user.handle}
                      </span>
                    )}
                  </div>
                  {f.comment && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">
                      {f.comment}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Hackathon config — per-workshop override */}
      <section className="mt-10">
        <div className="mb-4">
          <h2 className="text-headline-md text-on-surface">
            Hackathon settings
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Override the global hackathon config for this workshop —
            different deadline, team size, etc. Leave un-set and this
            workshop inherits the defaults from{" "}
            <Link
              href="/admin/hackathon"
              className="font-bold text-primary hover:underline"
            >
              /admin/hackathon
            </Link>
            .
          </p>
        </div>
        <form
          action={setWorkshopHackathonConfig}
          className="glass-card grid grid-cols-1 gap-3 rounded-2xl p-5 md:grid-cols-12"
        >
          <input type="hidden" name="cohortId" value={cohort.id} />
          <label className="md:col-span-3 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Max team size
            </span>
            <input
              type="number"
              name="maxTeamSize"
              required
              min={1}
              max={20}
              defaultValue={workshopHackathonConfig?.maxTeamSize ?? 5}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-5 space-y-1">
            <span className="mono-label block text-on-surface-variant">
              Submission deadline
            </span>
            <input
              type="datetime-local"
              name="submitBy"
              defaultValue={
                workshopHackathonConfig?.submitBy
                  ? new Date(workshopHackathonConfig.submitBy)
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-3 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="leaderboardPublic"
            className="md:col-span-2 flex items-end gap-2 pb-2"
          >
            <input
              id="leaderboardPublic"
              type="checkbox"
              name="leaderboardPublic"
              defaultChecked={
                workshopHackathonConfig?.leaderboardPublic ?? false
              }
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">
              Public leaderboard
            </span>
          </label>
          <label
            htmlFor="wallRequireApproval"
            className="md:col-span-2 flex items-end gap-2 pb-2"
          >
            <input
              id="wallRequireApproval"
              type="checkbox"
              name="wallRequireApproval"
              defaultChecked={
                workshopHackathonConfig?.wallRequireApproval ?? true
              }
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">
              Moderate wall
            </span>
          </label>
          <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-1">
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary"
            >
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
              {workshopHackathonConfig ? "Update" : "Use override"}
            </SubmitButton>
            <span className="text-[11px] text-on-surface-variant">
              {workshopHackathonConfig
                ? "Currently using a workshop-specific config."
                : "Currently inheriting the global default."}
            </span>
          </div>
        </form>
        {workshopHackathonConfig && (
          <form
            action={clearWorkshopHackathonConfig}
            className="mt-3"
          >
            <input type="hidden" name="cohortId" value={cohort.id} />
            <SubmitButton
              className="mono-label inline-flex items-center gap-1 rounded-full border border-destructive/40 px-3 py-1 text-destructive hover:bg-destructive/10"
            >
              <span className="material-symbols-outlined text-[12px]">
                restart_alt
              </span>
              Revert to default
            </SubmitButton>
          </form>
        )}
      </section>

      {/* Move-to-other-cohort helper */}
      {allCohorts.length > 1 && (
        <section className="glass-card mt-10 rounded-3xl p-6">
          <h2 className="text-headline-md mb-3 text-on-surface">
            Move a member to another workshop
          </h2>
          <form
            action={adminAssignUserToCohort}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Member
              </span>
              <select
                name="userId"
                required
                defaultValue=""
                className="rounded-xl border border-white/10 bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>
                  Pick…
                </option>
                {cohort.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {(m.name ?? m.email.split("@")[0])} &lt;{m.email}&gt;
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Move to
              </span>
              <select
                name="cohortId"
                required
                defaultValue=""
                className="rounded-xl border border-white/10 bg-surface-container-low px-4 py-2 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="" disabled>
                  Pick…
                </option>
                {allCohorts
                  .filter((c) => c.id !== cohort.id)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <SubmitButton
              className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-2 text-on-surface-variant hover:border-primary/40 hover:text-primary"
            >
              Move
            </SubmitButton>
          </form>
        </section>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

/** Static 0–5 star display (filled up to `rating`). */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`material-symbols-outlined text-[16px] leading-none ${
            n <= rating ? "text-primary" : "text-on-surface-variant/40"
          }`}
          style={n <= rating ? { fontVariationSettings: "'FILL' 1" } : undefined}
          aria-hidden="true"
        >
          star
        </span>
      ))}
    </span>
  );
}
