import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { joinWorkshop } from "@/lib/actions/alumni";

export const metadata = { title: "Workshops · Yukti AI Labs" };

/**
 * Workshops listing.
 *
 * Two-section layout (locked with user 2026-06-26):
 *
 *   1. "Your workshops" — only the workshops the signed-in user is a
 *      member of (past attended + currently in + future ones they're
 *      pre-enrolled in). This is the personalized section, shown first.
 *
 *   2. "All workshops" — every workshop in the system, with filter tabs
 *      (Live now / Upcoming / Past). User's own workshops still show
 *      here too, with a "You're in" pill so they're visually distinct.
 *
 * Bucketing rule:
 *   - `current` flag wins (instructor override)
 *   - else if startedOn > now → upcoming
 *   - else if endedOn != null && endedOn < now → past
 *   - else → live
 */

type WorkshopBucket = "live" | "upcoming" | "past" | "unscheduled";

function classify(c: {
  startedOn: Date | null;
  endedOn: Date | null;
  current: boolean;
}): WorkshopBucket {
  if (c.current) return "live";
  const now = Date.now();
  if (!c.startedOn) return "unscheduled";
  const start = c.startedOn.getTime();
  const end = c.endedOn?.getTime();
  if (start > now) return "upcoming";
  if (end !== undefined && end < now) return "past";
  return "live";
}

const BUCKET_COPY: Record<
  Exclude<WorkshopBucket, "unscheduled">,
  { label: string; chipClass: string; emptyMsg: string }
> = {
  live: {
    label: "Live now",
    chipClass: "bg-primary text-on-primary",
    emptyMsg: "No workshops are running right now.",
  },
  upcoming: {
    label: "Upcoming",
    chipClass: "bg-secondary-container text-on-secondary-container",
    emptyMsg: "No workshops on the calendar yet.",
  },
  past: {
    label: "Past",
    chipClass: "bg-surface-container text-on-surface-variant",
    emptyMsg: "No past workshops to look back at — yet.",
  },
};

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await requireUser();
  const { tab } = await searchParams;
  const activeTab: WorkshopBucket | "all" =
    tab === "live" ||
    tab === "upcoming" ||
    tab === "past" ||
    tab === "unscheduled"
      ? tab
      : "all";

  // All workshops + which ones the user belongs to. "Yours" reads BOTH the
  // single-FK relation (User.cohortId, kept for back-compat) and the new
  // UserCohort join, so a user attending multiple workshops sees all of them.
  const cohorts = await prisma.cohort.findMany({
    orderBy: [{ current: "desc" }, { startedOn: "desc" }],
    include: {
      _count: { select: { members: true, projects: true } },
      members: { where: { id: me.id }, select: { id: true } },
      memberships: { where: { userId: me.id }, select: { id: true } },
    },
  });

  // "Yours" = primary cohort OR any UserCohort row.
  const yours = cohorts.filter(
    (c) => c.members.length > 0 || c.memberships.length > 0,
  );
  const myCohortIds = new Set(yours.map((c) => c.id));

  // Bucket the full list for the "All workshops" section.
  const bucketed = {
    live: [] as typeof cohorts,
    upcoming: [] as typeof cohorts,
    past: [] as typeof cohorts,
    unscheduled: [] as typeof cohorts,
  };
  for (const c of cohorts) bucketed[classify(c)].push(c);
  const counts = {
    live: bucketed.live.length,
    upcoming: bucketed.upcoming.length,
    past: bucketed.past.length,
    unscheduled: bucketed.unscheduled.length,
    all: cohorts.length,
  };

  // Sub-bucket "yours" by status too, for grouped display.
  const yoursBucketed = {
    live: [] as typeof cohorts,
    upcoming: [] as typeof cohorts,
    past: [] as typeof cohorts,
    unscheduled: [] as typeof cohorts,
  };
  for (const c of yours) yoursBucketed[classify(c)].push(c);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      {/* ──────────────────────────────────────────────────────────
       * Page header
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            home_storage
          </span>
          <span className="text-xs font-bold tracking-wide">Workshops</span>
        </div>
        <h1 className="text-headline-lg text-on-surface">Workshops</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Your workshops first, then everything else Yukti AI Labs is
          running.
        </p>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * 1. YOUR WORKSHOPS — personalized section
       * ────────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-headline-md text-on-surface">Your workshops</h2>
          <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
            {yours.length}{" "}
            {yours.length === 1 ? "workshop" : "workshops"}
          </span>
        </div>

        {yours.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
            <span className="material-symbols-outlined mb-3 text-4xl text-on-surface-variant">
              school
            </span>
            <h3 className="text-base font-bold text-on-surface">
              You haven&apos;t joined a workshop yet.
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
              Ask your teacher to add you to a workshop. Once you&apos;re
              in, you&apos;ll see lessons, your team, and the class chat.
              Browse all workshops below to see what&apos;s available.
            </p>
          </div>
        ) : (
          <>
            {(["live", "upcoming", "past"] as const).map((b) => {
              const list = yoursBucketed[b];
              if (list.length === 0) return null;
              return (
                <div key={b} className="mb-6 last:mb-0">
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BUCKET_COPY[b].chipClass}`}
                    >
                      {b === "live" && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-primary" />
                      )}
                      {BUCKET_COPY[b].label}
                    </span>
                    <span className="text-[10px] font-bold text-on-surface-variant">
                      {list.length}
                    </span>
                  </div>
                  <WorkshopGrid cohorts={list} myCohortIds={myCohortIds} />
                </div>
              );
            })}
            {yoursBucketed.unscheduled.length > 0 && (
              <div className="mb-6 last:mb-0">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-tertiary-fixed px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                    Unscheduled
                  </span>
                  <span className="text-[10px] font-bold text-on-surface-variant">
                    {yoursBucketed.unscheduled.length}
                  </span>
                </div>
                <WorkshopGrid
                  cohorts={yoursBucketed.unscheduled}
                  myCohortIds={myCohortIds}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Divider — visual cue that we're moving from "your" to "all" */}
      <div className="mb-10 flex items-center gap-4">
        <div className="h-px flex-1 bg-outline-variant" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Browse all
        </span>
        <div className="h-px flex-1 bg-outline-variant" />
      </div>

      {/* ──────────────────────────────────────────────────────────
       * 2. ALL WORKSHOPS — discovery view with filter tabs
       * ────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-5 flex items-center gap-3">
          <h2 className="text-headline-md text-on-surface">All workshops</h2>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {counts.all} total
          </span>
        </div>

        {/* Filter tabs */}
        <nav className="mb-6 flex flex-wrap gap-2">
          <TabPill
            href="/workshops"
            label="All"
            count={counts.all}
            active={activeTab === "all"}
          />
          <TabPill
            href="/workshops?tab=live"
            label="Live now"
            count={counts.live}
            active={activeTab === "live"}
            dot
          />
          <TabPill
            href="/workshops?tab=upcoming"
            label="Upcoming"
            count={counts.upcoming}
            active={activeTab === "upcoming"}
          />
          <TabPill
            href="/workshops?tab=past"
            label="Past"
            count={counts.past}
            active={activeTab === "past"}
          />
        </nav>

        {/* Render based on activeTab */}
        {activeTab === "all" ? (
          <>
            {(["live", "upcoming", "past"] as const).map((b) => {
              const list = bucketed[b];
              if (list.length === 0) return null;
              return (
                <div key={b} className="mb-10 last:mb-0">
                  <div className="mb-4 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${BUCKET_COPY[b].chipClass}`}
                    >
                      {b === "live" && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-primary" />
                      )}
                      {BUCKET_COPY[b].label}
                    </span>
                    <span className="text-xs font-bold text-on-surface-variant">
                      {list.length}
                    </span>
                  </div>
                  <WorkshopGrid cohorts={list} myCohortIds={myCohortIds} />
                </div>
              );
            })}
            {bucketed.unscheduled.length > 0 && (
              <div className="mb-10 last:mb-0">
                <div className="mb-4 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-tertiary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-tertiary-fixed">
                    Unscheduled
                  </span>
                  <span className="text-xs font-bold text-on-surface-variant">
                    {bucketed.unscheduled.length}
                  </span>
                </div>
                <WorkshopGrid
                  cohorts={bucketed.unscheduled}
                  myCohortIds={myCohortIds}
                />
              </div>
            )}
            {cohorts.length === 0 && <EmptyHero />}
          </>
        ) : (
          <>
            <WorkshopGrid
              cohorts={
                activeTab === "unscheduled"
                  ? bucketed.unscheduled
                  : bucketed[activeTab]
              }
              myCohortIds={myCohortIds}
            />
            {((activeTab === "live" && counts.live === 0) ||
              (activeTab === "upcoming" && counts.upcoming === 0) ||
              (activeTab === "past" && counts.past === 0)) && (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-8 text-center text-on-surface-variant">
                {activeTab === "live" ||
                activeTab === "upcoming" ||
                activeTab === "past"
                  ? BUCKET_COPY[activeTab].emptyMsg
                  : ""}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function TabPill({
  href,
  label,
  count,
  active,
  dot,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  dot?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
        active
          ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
          : "border-outline-variant bg-card text-on-surface-variant hover:border-primary hover:text-primary"
      }`}
    >
      {dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />}
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] ${
          active
            ? "bg-on-primary-fixed-variant text-primary-fixed"
            : "bg-surface-container text-on-surface-variant"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function WorkshopGrid({
  cohorts,
  myCohortIds,
}: {
  cohorts: {
    id: string;
    name: string;
    description: string | null;
    startedOn: Date | null;
    endedOn: Date | null;
    current: boolean;
    _count: { members: number; projects: number };
  }[];
  myCohortIds: Set<string>;
}) {
  if (cohorts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cohorts.map((c) => {
        const bucket = classify(c);
        const isMember = myCohortIds.has(c.id);
        return (
          <article
            key={c.id}
            className={`group flex flex-col rounded-[24px] border-2 bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary ${
              isMember
                ? "border-primary/40 ring-2 ring-primary/10"
                : "border-outline-variant"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              {bucket === "live" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-primary" />
                  Live now
                </span>
              ) : bucket === "upcoming" ? (
                <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                  Upcoming
                </span>
              ) : bucket === "past" ? (
                <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  Past
                </span>
              ) : (
                <span className="rounded-full bg-tertiary-fixed px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                  Unscheduled
                </span>
              )}
              {isMember && (
                <span className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                  You&apos;re in
                </span>
              )}
            </div>
            <Link
              href={`/cohorts/${c.id}`}
              className="block"
            >
              <h3 className="text-headline-md text-on-surface group-hover:text-primary">
                {c.name}
              </h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                  {c.description}
                </p>
              )}
            </Link>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-bold text-on-surface-variant">
              {c.startedOn && (
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    calendar_today
                  </span>
                  {dateLabel(c.startedOn, c.endedOn)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  groups
                </span>
                {c._count.members} member
                {c._count.members === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  rocket_launch
                </span>
                {c._count.projects} project
                {c._count.projects === 1 ? "" : "s"}
              </span>
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-4">
              <Link
                href={`/cohorts/${c.id}`}
                className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                Open
                <span className="material-symbols-outlined text-[14px]">
                  arrow_forward
                </span>
              </Link>
              {isMember ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                  <span className="material-symbols-outlined text-[12px]">
                    check_circle
                  </span>
                  Joined
                </span>
              ) : (
                <form action={joinWorkshop}>
                  <input type="hidden" name="cohortId" value={c.id} />
                  <button
                    type="submit"
                    className="sticker-shadow inline-flex items-center gap-1 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-on-primary transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      group_add
                    </span>
                    Join
                  </button>
                </form>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EmptyHero() {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-12 text-center">
      <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
        school
      </span>
      <h2 className="text-headline-md text-on-surface">
        No workshops yet.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
        Once a teacher creates a workshop, it shows up here for everyone
        to see.
      </p>
    </div>
  );
}

function dateLabel(startedOn: Date, endedOn: Date | null) {
  const startStr = startedOn.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  if (!endedOn) return startStr;
  const endStr = endedOn.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  return startStr === endStr ? startStr : `${startStr} → ${endStr}`;
}
