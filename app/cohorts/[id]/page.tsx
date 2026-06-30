import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import {
  db,
  cohort as cohortTable,
  cohortPost,
  progress,
  team,
  teamMember,
  workshopModule,
  workshopFeedback,
} from "@/lib/db";
import {
  createCohortPost,
  deleteCohortPost,
  joinWorkshop,
  leaveWorkshop,
  pinCohortPost,
  submitWorkshopFeedback,
} from "@/lib/actions/alumni";
import { getHackathonConfig } from "@/lib/hackathon-config";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Workshop · Karya Sanga" };

/**
 * Workshop view (route stays at /cohorts/[id] for backward-compat with all
 * existing links — but the UI reads as "Workshop").
 *
 * Sections (top → bottom):
 *   1. Hero — status pill, name, dates, member + project counts, "you're in"
 *   2. Your progress (only if you're a member of this workshop)
 *   3. Lessons / learning pathway — modules with their lessons + checkmarks
 *   4. Teams in this workshop — hackathon teams scoped to this cohort
 *   5. Members + badges roster
 *   6. Cohort feed — pinned + chronological posts (composer for members)
 *   7. Projects from this cohort
 *
 * Lessons are read through the WorkshopModule join — only modules explicitly
 * attached to this workshop show up. The library (Module + Lesson) is global
 * and reused across workshops; per-workshop ordering lives on the join row.
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

export default async function WorkshopPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;

  const [
    cohortRaw,
    posts,
    modules,
    completedLessonIds,
    projectsRaw,
    hackathonConfig,
    myTeamMemberships,
    myFeedback,
  ] = await Promise.all([
      db.query.cohort.findFirst({
        where: eq(cohortTable.id, id),
        with: {
          // Primary members: User.cohortId === id (relation `users`).
          users: {
            columns: {
              id: true,
              email: true,
              name: true,
              handle: true,
            },
            with: {
              earnedBadges_userId: {
                with: {
                  badge: { columns: { name: true, icon: true, tone: true } },
                },
                orderBy: (eb, { desc }) => [desc(eb.earnedAt)],
                limit: 6,
              },
              teamMembers: {
                with: {
                  team: {
                    columns: {
                      id: true,
                      name: true,
                      projectTitle: true,
                      cohortId: true,
                    },
                  },
                },
              },
            },
            orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
          },
          // Secondary members: people enrolled via UserCohort whose primary
          // workshop is different. Surfaces them in the workshop roster so
          // the view matches the admin "Also enrolled" UI. (relation
          // `userCohorts`; the `user.cohortId !== id` filter is applied in JS
          // since Drizzle can't filter a relation by a nested relation column.)
          userCohorts: {
            with: {
              user: {
                columns: {
                  id: true,
                  email: true,
                  name: true,
                  handle: true,
                  cohortId: true,
                },
                with: {
                  earnedBadges_userId: {
                    with: {
                      badge: {
                        columns: { name: true, icon: true, tone: true },
                      },
                    },
                    orderBy: (eb, { desc }) => [desc(eb.earnedAt)],
                    limit: 6,
                  },
                  teamMembers: {
                    with: {
                      team: {
                        columns: {
                          id: true,
                          name: true,
                          projectTitle: true,
                          cohortId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.query.cohortPost
        .findMany({
          where: eq(cohortPost.cohortId, id),
          with: {
            // relation is `user`; JSX reads `p.author`, remapped below.
            user: {
              columns: { id: true, name: true, email: true, handle: true },
            },
          },
          orderBy: (p, { desc }) => [desc(p.pinned), desc(p.createdAt)],
          limit: 30,
        })
        .then((rows) =>
          rows.map(({ user, ...rest }) => ({ ...rest, author: user })),
        ),
      // Lessons attached to THIS workshop via the WorkshopModule join.
      // The library (Module + Lesson) is global; this query honors the
      // per-workshop selection + ordering. .then() flattens the join rows
      // back to plain Module[] so the existing render code stays untouched.
      // The `module.published` gate is applied in JS (Drizzle can't filter a
      // relation by a nested relation column in `where`).
      db.query.workshopModule
        .findMany({
          where: eq(workshopModule.cohortId, id),
          orderBy: (wm, { asc }) => [asc(wm.order)],
          with: {
            module: {
              with: {
                moduleLessons: {
                  orderBy: (ml, { asc }) => [asc(ml.order)],
                  with: {
                    lesson: {
                      columns: {
                        published: true,
                        id: true,
                        title: true,
                        summary: true,
                        difficulty: true,
                        wokwiProjectUrl: true,
                        slideFilePath: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })
        .then((rows) =>
          rows
            .map((r) => r.module)
            .filter((m) => m.published)
            .map((m) => ({
              ...m,
              lessons: m.moduleLessons
                .map((ml) => ml.lesson)
                .filter((l) => l.published),
            })),
        ),
      db.query.progress.findMany({
        where: and(eq(progress.userId, me.id), eq(progress.completed, true)),
        columns: { lessonId: true },
      }),
      db.query.team.findMany({
        where: and(eq(team.cohortId, id), ne(team.status, "archived")),
        columns: {
          id: true,
          name: true,
          projectTitle: true,
          projectDescription: true,
          tags: true,
          featured: true,
          status: true,
        },
        with: {
          // For the `_count` of members + build logs shown on each card.
          teamMembers: { columns: { id: true } },
          buildLogEntries: { columns: { id: true } },
        },
        orderBy: (t, { desc }) => [desc(t.featured), desc(t.updatedAt)],
      }),
      getHackathonConfig(id),
      // User's hackathon team(s) — filtered to _this specific cohort_ in JS
      // below (Prisma filtered via `team: { cohortId: id }`). A user has at
      // most one team membership (unique userId), so this is 0 or 1 row.
      db.query.teamMember.findMany({
        where: eq(teamMember.userId, me.id),
        columns: {
          teamId: true,
          isCaptain: true,
        },
        with: {
          team: {
            columns: {
              name: true,
              cohortId: true,
            },
            with: {
              submissions: { columns: { id: true } },
            },
          },
        },
      }),
      // The viewer's existing feedback for this workshop (if any), used to
      // pre-fill the "Rate this workshop" form. One row per user per workshop.
      db.query.workshopFeedback.findFirst({
        where: and(
          eq(workshopFeedback.cohortId, id),
          eq(workshopFeedback.userId, me.id),
        ),
        columns: { id: true, rating: true, comment: true },
      }),
    ]);
  if (!cohortRaw) notFound();

  // Remap Drizzle relation names back to the keys the JSX expects:
  //   users               → members         earnedBadges_userId → earnedBadges
  //   userCohorts         → memberships     teamMembers[0]      → teamMembership
  //   submissions[0]      → submission
  const mapMember = (u: {
    id: string;
    email: string;
    name: string | null;
    handle: string | null;
    earnedBadges_userId: {
      id: string;
      badge: { name: string; icon: string; tone: string };
    }[];
    teamMembers: {
      team: {
        id: string;
        name: string;
        projectTitle: string | null;
        cohortId: string | null;
      };
    }[];
  }) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    handle: u.handle,
    earnedBadges: u.earnedBadges_userId,
    teamMembership: u.teamMembers[0] ?? null,
  });

  const cohort = {
    ...cohortRaw,
    members: cohortRaw.users.map(mapMember),
    memberships: cohortRaw.userCohorts
      .filter((row) => row.user.cohortId !== id)
      .map((row) => ({ ...row, user: mapMember(row.user) })),
  };

  // `_count` parity for the team cards.
  const projects = projectsRaw.map((p) => ({
    ...p,
    tags: p.tags ?? [],
    _count: {
      members: p.teamMembers.length,
      buildLogEntries: p.buildLogEntries.length,
    },
  }));

  // Collapse the user's team memberships to the one in THIS cohort (or null),
  // and reshape `submissions[0]` → `submission` for the CTA.
  const myMembershipRow = myTeamMemberships.find(
    (tm) => tm.team.cohortId === id,
  );
  const myHackathonMembership = myMembershipRow
    ? {
        teamId: myMembershipRow.teamId,
        isCaptain: myMembershipRow.isCaptain,
        team: {
          name: myMembershipRow.team.name,
          submission: myMembershipRow.team.submissions[0] ?? null,
        },
      }
    : null;

  const isPrimaryMember = cohort.members.some((m) => m.id === me.id);
  const isSecondaryMember = cohort.memberships.some(
    (r) => r.user.id === me.id,
  );
  const isMember = isPrimaryMember || isSecondaryMember;
  const isMod = me.role === "admin" || me.role === "instructor";
  const canPost = isMember || isMod;
  const bucket = classify(cohort);
  const completed = new Set(completedLessonIds.map((p) => p.lessonId));

  // Combine primary members (User.cohortId === this.id) with secondary
  // members (UserCohort join rows whose primary cohort is different).
  // De-dupe by user id just in case both relations resolve the same person.
  const seenMemberIds = new Set<string>();
  const allMembers: typeof cohort.members = [];
  for (const m of cohort.members) {
    if (!seenMemberIds.has(m.id)) {
      seenMemberIds.add(m.id);
      allMembers.push(m);
    }
  }
  for (const row of cohort.memberships) {
    if (!seenMemberIds.has(row.user.id)) {
      seenMemberIds.add(row.user.id);
      allMembers.push(row.user);
    }
  }

  // Progress numbers (only meaningful to a member)
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const completedCount = modules.reduce(
    (s, m) => s + m.lessons.filter((l) => completed.has(l.id)).length,
    0,
  );
  const progressPct =
    totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
  let nextLesson: { id: string; title: string; moduleTitle: string } | null =
    null;
  for (const m of modules) {
    for (const l of m.lessons) {
      if (!completed.has(l.id)) {
        nextLesson = { id: l.id, title: l.title, moduleTitle: m.title };
        break;
      }
    }
    if (nextLesson) break;
  }

  // Hackathon deadline status — used by the CTA card in the Teams section
  let hackathonDeadline:
    | { label: string; tone: "open" | "soon" | "closed"; copy: string }
    | null = null;
  if (hackathonConfig?.submitBy) {
    const ms = new Date(hackathonConfig.submitBy).getTime() - Date.now();
    if (ms < 0) {
      hackathonDeadline = {
        label: "Closed",
        tone: "closed",
        copy: `Submissions closed ${new Date(hackathonConfig.submitBy).toLocaleDateString()}`,
      };
    } else if (ms < 1000 * 60 * 60 * 48) {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      hackathonDeadline = {
        label: "Closing soon",
        tone: "soon",
        copy: `${hours} hour${hours === 1 ? "" : "s"} until deadline`,
      };
    } else {
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      hackathonDeadline = {
        label: "Open",
        tone: "open",
        copy: `${days} day${days === 1 ? "" : "s"} until deadline`,
      };
    }
  }

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/workshops"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        All workshops
      </Link>

      {/* ──────────────────────────────────────────────────────────
       * 1. HERO
       * ────────────────────────────────────────────────────────── */}
      <header className="mb-10">
        <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            home_storage
          </span>
          <span className="text-xs font-bold tracking-wide">Workshop</span>
        </div>
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {bucket === "live" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
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
                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                  You&apos;re in
                </span>
              )}
            </div>
            <h1 className="text-headline-lg text-on-surface">{cohort.name}</h1>
            {cohort.description && (
              <p className="mt-2 max-w-3xl text-on-surface-variant">
                {cohort.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-on-surface-variant">
              {cohort.startedOn && (
                <span className="inline-flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">
                    calendar_today
                  </span>
                  {dateLabel(cohort.startedOn, cohort.endedOn)}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  groups
                </span>
                {allMembers.length} member
                {allMembers.length === 1 ? "" : "s"}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">
                  rocket_launch
                </span>
                {projects.length} project
                {projects.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Join — non-members only */}
            {!isMember && (
              <form action={joinWorkshop}>
                <input type="hidden" name="cohortId" value={cohort.id} />
                <SubmitButton
                  className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    group_add
                  </span>
                  Join workshop
                </SubmitButton>
              </form>
            )}
            {/* Leave — secondary members only (primary membership is
             * admin-managed so we don't expose self-leave for those) */}
            {isSecondaryMember && !isPrimaryMember && (
              <form action={leaveWorkshop}>
                <input type="hidden" name="cohortId" value={cohort.id} />
                <SubmitButton
                  className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-destructive hover:text-destructive"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    logout
                  </span>
                  Leave workshop
                </SubmitButton>
              </form>
            )}
            {isMod && (
              <Link
                href={`/admin/cohorts/${cohort.id}`}
                className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-primary hover:text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">
                  edit
                </span>
                Edit workshop
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────
       * 2. YOUR PROGRESS (member-only)
       * ────────────────────────────────────────────────────────── */}
      {isMember && totalLessons > 0 && (
        <section className="sticker-shadow mb-10 rounded-[28px] border-2 border-primary bg-primary-fixed p-6 text-on-primary-fixed md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                <span className="material-symbols-outlined text-[14px]">
                  trending_up
                </span>
                Your progress
              </div>
              <h2 className="text-headline-md mt-2 text-on-primary-fixed">
                {completedCount} / {totalLessons} lessons · {progressPct}%
              </h2>
              <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/30 md:max-w-md">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressPct}%`,
                    background:
                      "linear-gradient(90deg, #57fae9 0%, #842bd2 100%)",
                  }}
                />
              </div>
              {nextLesson && (
                <p className="mt-3 text-sm text-on-primary-fixed-variant">
                  Up next: <strong>{nextLesson.title}</strong> from{" "}
                  {nextLesson.moduleTitle}
                </p>
              )}
            </div>
            {nextLesson && (
              <Link
                href={`/lessons/${nextLesson.id}`}
                className="sticker-shadow inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-on-primary"
              >
                Continue learning
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────
       * 2b. RATE THIS WORKSHOP (member-only)
       * ────────────────────────────────────────────────────────── */}
      {isMember && (
        <section className="sticker-shadow mb-10 rounded-[28px] border-2 border-outline-variant bg-card p-6 md:p-8">
          <div className="mb-4">
            <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-xs font-bold text-on-tertiary-fixed shadow-sm">
              <span className="material-symbols-outlined text-[14px]">
                reviews
              </span>
              Feedback
            </span>
            <h2 className="text-headline-md mt-3 text-on-surface">
              {myFeedback ? "Update your feedback" : "Rate this workshop"}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {myFeedback
                ? "You've already shared your thoughts — tweak them any time."
                : "How is this workshop going for you? Your teachers see this."}
            </p>
          </div>
          <form action={submitWorkshopFeedback} className="space-y-4">
            <input type="hidden" name="cohortId" value={cohort.id} />
            <fieldset>
              <legend className="mono-label mb-2 text-on-surface-variant">
                Your rating
              </legend>
              {/* 5 radios styled as stars; the highest checked one wins. CSS
               * sibling selectors fill all stars up to the hovered/checked one
               * (peer-* utilities aren't directional, so a scoped style block
               * drives the fill). */}
              {/* row-reverse so 5 is in the DOM first; the general-sibling
               * combinator then fills the checked star and every star after
               * it (which sit to its left visually = lower numbers). Hover
               * uses :has so the whole run lights up on the way in. */}
              <style>{`
                .star-rating > span > label { color: var(--md-sys-color-on-surface-variant, currentColor); }
                .star-rating > span:has(input:checked) ~ span > label,
                .star-rating > span:has(input:checked) > label { color: var(--md-sys-color-primary, #842bd2); }
                .star-rating:hover > span:has(input:hover) ~ span > label,
                .star-rating:hover > span:has(input:hover) > label { color: var(--md-sys-color-primary, #842bd2); }
              `}</style>
              <div className="star-rating inline-flex flex-row-reverse items-center gap-1">
                {[5, 4, 3, 2, 1].map((n) => (
                  <span key={n} className="contents">
                    <input
                      id={`rating-${n}`}
                      type="radio"
                      name="rating"
                      value={n}
                      required
                      defaultChecked={myFeedback?.rating === n}
                      className="peer sr-only"
                    />
                    <label
                      htmlFor={`rating-${n}`}
                      title={`${n} star${n === 1 ? "" : "s"}`}
                      className="cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-[32px] leading-none">
                        star
                      </span>
                      <span className="sr-only">
                        {n} star{n === 1 ? "" : "s"}
                      </span>
                    </label>
                  </span>
                ))}
              </div>
            </fieldset>
            <label className="block space-y-1">
              <span className="mono-label block text-on-surface-variant">
                Comment (optional)
              </span>
              <textarea
                name="comment"
                rows={3}
                maxLength={2000}
                defaultValue={myFeedback?.comment ?? ""}
                placeholder="What's working? What could be better?"
                className="w-full resize-none rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <div className="flex justify-end">
              <SubmitButton
                pendingText="Saving…"
                className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
              >
                <span className="material-symbols-outlined text-[16px]">
                  send
                </span>
                Submit feedback
              </SubmitButton>
            </div>
          </form>
        </section>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        {/* ────────────────────────────────────────────────────────
         * Left column — Lessons + Teams + Projects (the "what we make")
         * ──────────────────────────────────────────────────────── */}
        <div className="space-y-10 lg:col-span-8">
          {/* 3. LESSONS */}
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    menu_book
                  </span>
                  Lesson path
                </span>
                <h2 className="text-headline-md mt-3 text-on-surface">
                  What you&apos;ll learn
                </h2>
              </div>
              <Link
                href="/lessons"
                className="text-xs font-bold text-primary hover:underline"
              >
                Open lessons →
              </Link>
            </div>
            {modules.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6">
                <p className="text-on-surface-variant">
                  No chapters added to this workshop yet. The full lesson
                  library is at{" "}
                  <Link
                    href="/lessons"
                    className="font-bold text-primary hover:underline"
                  >
                    /lessons
                  </Link>
                  {isMod
                    ? " — add chapters from /admin/modules."
                    : " — your teacher will add chapters soon."}
                </p>
              </div>
            ) : (
              <ul className="space-y-4">
                {modules.map((mod, mi) => (
                  <ModuleAccordion
                    key={mod.id}
                    n={mi + 1}
                    mod={mod}
                    completed={completed}
                  />
                ))}
              </ul>
            )}
          </section>

          {/* 4. TEAMS */}
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    rocket_launch
                  </span>
                  Hackathon teams
                </span>
                <h2 className="text-headline-md mt-3 text-on-surface">
                  Teams in this workshop
                </h2>
              </div>
              <Link
                href="/hackathon"
                className="text-xs font-bold text-primary hover:underline"
              >
                Open hackathon →
              </Link>
            </div>

            {/* Hackathon CTA — the entry point from the workshop view */}
            <div className="sticker-shadow mb-5 rounded-[24px] border-2 border-primary bg-primary-fixed p-5 text-on-primary-fixed">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {hackathonDeadline ? (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          hackathonDeadline.tone === "open"
                            ? "bg-card text-primary"
                            : hackathonDeadline.tone === "soon"
                              ? "bg-secondary text-on-secondary"
                              : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          {hackathonDeadline.tone === "closed"
                            ? "lock"
                            : "schedule"}
                        </span>
                        {hackathonDeadline.label} ·{" "}
                        {hackathonDeadline.copy}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-card/30 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                        <span className="material-symbols-outlined text-[12px]">
                          schedule
                        </span>
                        Deadline TBA
                      </span>
                    )}
                    <span className="rounded-full bg-card/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                      {projects.length} team
                      {projects.length === 1 ? "" : "s"} formed
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-primary-fixed">
                    {myHackathonMembership
                      ? `You're on "${myHackathonMembership.team.name}"`
                      : "Workshop hackathon"}
                  </h3>
                  <p className="mt-0.5 text-sm text-on-primary-fixed-variant">
                    {myHackathonMembership
                      ? myHackathonMembership.team.submission
                        ? "Submission saved — keep iterating until the deadline."
                        : "No submission yet — build your project, then submit before the deadline."
                      : "Form a team of up to " +
                        (hackathonConfig?.maxTeamSize ?? 4) +
                        ", build together, then submit before the deadline."}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {myHackathonMembership ? (
                    <>
                      <Link
                        href={`/hackathon/teams/${myHackathonMembership.teamId}`}
                        className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                      >
                        Team workspace
                        <span className="material-symbols-outlined text-[14px]">
                          arrow_forward
                        </span>
                      </Link>
                      <Link
                        href={`/hackathon/teams/${myHackathonMembership.teamId}/submit`}
                        className="inline-flex items-center gap-2 rounded-full border-2 border-on-primary-fixed-variant/30 px-4 py-2 text-sm font-bold text-on-primary-fixed-variant hover:bg-card/20"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          rocket_launch
                        </span>
                        Submit
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/hackathon"
                      className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        group_add
                      </span>
                      Form / find a team
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {projects.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6 text-on-surface-variant">
                No teams have formed in this workshop yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {projects.map((p) => (
                  <Link
                    key={p.id}
                    href={`/gallery/${p.id}`}
                    className="group rounded-[20px] border-2 border-outline-variant bg-card p-4 transition-all hover:-translate-y-1 hover:border-primary"
                  >
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                      {p.featured && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-fixed px-2 py-0.5 text-on-primary-fixed-variant">
                          <span className="material-symbols-outlined text-[10px]">
                            star
                          </span>
                          Featured
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 ${
                          p.status === "shipped"
                            ? "bg-primary-fixed text-on-primary-fixed-variant"
                            : "bg-secondary-container text-on-secondary-container"
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-on-surface group-hover:text-primary">
                      {p.projectTitle ?? p.name}
                    </h3>
                    {p.projectDescription && (
                      <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                        {p.projectDescription}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.tags.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 text-xs text-on-surface-variant">
                      {p._count.members} member
                      {p._count.members === 1 ? "" : "s"} ·{" "}
                      {p._count.buildLogEntries} log
                      {p._count.buildLogEntries === 1 ? "" : "s"}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ────────────────────────────────────────────────────────
         * Right column — Cohort feed + Members
         * ──────────────────────────────────────────────────────── */}
        <div className="space-y-10 lg:col-span-4">
          {/* 5. COHORT FEED */}
          <section>
            <div className="mb-4">
              <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-xs font-bold text-on-tertiary-fixed shadow-sm">
                <span className="material-symbols-outlined text-[14px]">
                  forum
                </span>
                Class chat
              </span>
              <h2 className="text-headline-md mt-3 text-on-surface">
                What&apos;s happening
              </h2>
            </div>
            {canPost && (
              <form
                action={createCohortPost}
                className="mb-4 rounded-2xl border-2 border-outline-variant bg-card p-4"
              >
                <input type="hidden" name="cohortId" value={cohort.id} />
                <label className="block">
                  <span className="sr-only">Post body</span>
                  <textarea
                    name="body"
                    required
                    rows={2}
                    maxLength={2000}
                    placeholder="Share something with the workshop…"
                    className="w-full resize-none rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <div className="mt-2 flex justify-end">
                  <SubmitButton
                    className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-4 py-1.5 text-sm font-bold text-on-primary"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      send
                    </span>
                    Post
                  </SubmitButton>
                </div>
              </form>
            )}
            {posts.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-5 text-sm text-on-surface-variant">
                Nothing posted yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {posts.slice(0, 8).map((p) => {
                  const name =
                    p.author.name ?? p.author.email.split("@")[0];
                  const canDelete = isMod || p.authorId === me.id;
                  return (
                    <li
                      key={p.id}
                      className={`rounded-2xl border-2 p-4 ${
                        p.pinned
                          ? "border-primary bg-primary-fixed/60"
                          : "border-outline-variant bg-card"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          {p.author.handle ? (
                            <Link
                              href={`/builders/${p.author.handle}`}
                              className="font-bold text-on-surface hover:text-primary"
                            >
                              {name}
                            </Link>
                          ) : (
                            <span className="font-bold text-on-surface">
                              {name}
                            </span>
                          )}
                          <span className="text-on-surface-variant">
                            {timeAgo(p.createdAt)}
                          </span>
                        </div>
                        {p.pinned && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-card px-2 py-0.5 text-[9px] font-bold text-primary">
                            <span className="material-symbols-outlined text-[10px]">
                              push_pin
                            </span>
                            Pinned
                          </span>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-on-surface">
                        {p.body}
                      </p>
                      {(isMod || canDelete) && (
                        <div className="mt-2 flex gap-3 text-[10px]">
                          {isMod && (
                            <form action={pinCohortPost}>
                              <input type="hidden" name="id" value={p.id} />
                              <input
                                type="checkbox"
                                name="pinned"
                                defaultChecked={!p.pinned}
                                className="hidden"
                              />
                              <SubmitButton
                                className="font-bold text-on-surface-variant hover:text-primary"
                              >
                                {p.pinned ? "Unpin" : "Pin"}
                              </SubmitButton>
                            </form>
                          )}
                          {canDelete && (
                            <form action={deleteCohortPost}>
                              <input type="hidden" name="id" value={p.id} />
                              <SubmitButton
                                className="font-bold text-on-surface-variant hover:text-destructive"
                              >
                                Delete
                              </SubmitButton>
                            </form>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 6. MEMBERS + BADGES */}
          <section>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    groups
                  </span>
                  Members
                </span>
                <h2 className="text-headline-md mt-3 text-on-surface">
                  In this workshop
                </h2>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Link
                  href={`/cohorts/${cohort.id}/people`}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  See full roster →
                </Link>
                {isMod && (
                  <Link
                    href="/admin/badges"
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Award badges →
                  </Link>
                )}
              </div>
            </div>
            {allMembers.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-5 text-sm text-on-surface-variant">
                No members yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {allMembers.map((m) => (
                  <MemberRow key={m.id} member={m} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

// ─── Helper components ───────────────────────────────────────────

function ModuleAccordion({
  n,
  mod,
  completed,
}: {
  n: number;
  mod: {
    id: string;
    title: string;
    description: string | null;
    lessons: {
      id: string;
      title: string;
      summary: string | null;
      difficulty: string | null;
      wokwiProjectUrl: string | null;
      slideFilePath: string | null;
    }[];
  };
  completed: Set<string>;
}) {
  const doneCount = mod.lessons.filter((l) => completed.has(l.id)).length;
  const moduleDone = doneCount === mod.lessons.length && mod.lessons.length > 0;
  return (
    <li className="rounded-[20px] border-2 border-outline-variant bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
              moduleDone
                ? "bg-secondary text-on-secondary"
                : "bg-primary-container text-on-primary-container"
            }`}
          >
            {String(n).padStart(2, "0")}
          </span>
          <div>
            <h3 className="text-base font-bold text-on-surface">
              {mod.title}
            </h3>
            {mod.description && (
              <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                {mod.description}
              </p>
            )}
          </div>
        </div>
        <span className="mono-label rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">
          {doneCount}/{mod.lessons.length}
        </span>
      </div>
      {mod.lessons.length === 0 ? (
        <p className="text-xs text-on-surface-variant">No lessons yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {mod.lessons.map((l, i) => {
            const isDone = completed.has(l.id);
            return (
              <li key={l.id}>
                <Link
                  href={`/lessons/${l.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-low p-2.5 hover:border-primary hover:bg-card"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isDone
                          ? "bg-secondary text-on-secondary"
                          : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      {isDone ? (
                        <span className="material-symbols-outlined text-[14px]">
                          check
                        </span>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span className="truncate text-sm font-medium text-on-surface group-hover:text-primary">
                      {l.title}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {l.difficulty && (
                      <span className="rounded-full bg-tertiary-fixed px-1.5 py-0.5 text-[9px] font-bold text-on-tertiary-fixed">
                        {l.difficulty}
                      </span>
                    )}
                    {l.wokwiProjectUrl && (
                      <span
                        className="material-symbols-outlined text-[14px] text-on-surface-variant"
                        title="Has Wokwi link"
                      >
                        memory
                      </span>
                    )}
                    {l.slideFilePath && (
                      <span
                        className="material-symbols-outlined text-[14px] text-on-surface-variant"
                        title="Has slide deck"
                      >
                        slideshow
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function MemberRow({
  member,
}: {
  member: {
    id: string;
    email: string;
    name: string | null;
    handle: string | null;
    earnedBadges: {
      id: string;
      badge: { name: string; icon: string; tone: string };
    }[];
    teamMembership: {
      team: {
        id: string;
        name: string;
        projectTitle: string | null;
      };
    } | null;
  };
}) {
  const name = member.name ?? member.email.split("@")[0];
  const initial = name.charAt(0).toUpperCase();
  const RowEl: React.ElementType = member.handle ? Link : "div";
  return (
    <li>
      <RowEl
        // @ts-expect-error — conditional element
        href={member.handle ? `/builders/${member.handle}` : undefined}
        className={`flex items-start gap-3 rounded-2xl border border-outline-variant/50 bg-card p-3 ${
          member.handle ? "hover:border-primary transition-colors" : ""
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-on-surface">
              {name}
            </span>
            {member.handle && (
              <span className="mono-label text-on-surface-variant">
                @{member.handle}
              </span>
            )}
          </div>
          {member.teamMembership?.team && (
            <div className="text-[11px] text-on-surface-variant">
              {member.teamMembership.team.projectTitle ??
                member.teamMembership.team.name}
            </div>
          )}
          {member.earnedBadges.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {member.earnedBadges.map((eb) => {
                const bg =
                  {
                    primary:
                      "bg-primary-fixed text-on-primary-fixed-variant",
                    secondary:
                      "bg-secondary-container text-on-secondary-container",
                    tertiary:
                      "bg-tertiary-fixed text-on-tertiary-fixed",
                  }[eb.badge.tone] ??
                  "bg-primary-fixed text-on-primary-fixed-variant";
                return (
                  <li
                    key={eb.id}
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${bg}`}
                    title={eb.badge.name}
                  >
                    <span className="material-symbols-outlined text-[12px]">
                      {eb.badge.icon}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </RowEl>
    </li>
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

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
