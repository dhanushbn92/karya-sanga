import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, module as moduleTable, progress } from "@/lib/db";

export const metadata = { title: "Lessons · Karya Sanga" };

const DIFFICULTY_TONE: Record<string, string> = {
  Easy: "bg-primary-fixed text-on-primary-fixed-variant",
  Medium: "bg-secondary-container text-on-secondary-container",
  Hard: "bg-tertiary-fixed text-on-tertiary-fixed",
};

/**
 * Lesson library — the reusable pool. Modules + Lessons live here globally.
 * Workshops attach a subset via the WorkshopModule join (locked 2026-06-26).
 *
 * Layout:
 *   1. Hero — "Continue learning" CTA card with the next unfinished lesson,
 *      progress bar with X / Y · % across all published lessons.
 *   2. Difficulty filter chips — All / Easy / Medium / Hard
 *   3. Modules as numbered roadmap steps. Each module shows its lessons in a
 *      grid: title, summary, difficulty pill, done check, slide + Wokwi icons.
 *      A chip on each module says how many workshops have attached it.
 */

type Difficulty = "All" | "Easy" | "Medium" | "Hard";

export default async function LessonsIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { level, q } = await searchParams;
  const query = (q ?? "").trim();
  const activeLevel: Difficulty =
    level === "Easy" ||
    level === "Medium" ||
    level === "Hard"
      ? level
      : "All";

  const [modulesRaw, progressRows] = await Promise.all([
    db.query.module.findMany({
      where: eq(moduleTable.published, true),
      orderBy: (m, { asc }) => [asc(m.order)],
      with: {
        lessons: {
          where: (l, { eq }) => eq(l.published, true),
          orderBy: (l, { asc }) => [asc(l.order)],
          columns: {
            id: true,
            title: true,
            summary: true,
            difficulty: true,
            wokwiProjectUrl: true,
            slidesUrl: true,
            slideFilePath: true,
          },
        },
        // Count of workshops this module is attached to — shown as a chip.
        workshopModules: { columns: { id: true } },
      },
    }),
    db.query.progress.findMany({
      where: and(eq(progress.userId, user.id), eq(progress.completed, true)),
      columns: { lessonId: true },
    }),
  ]);

  // Map the fetched join rows to the `_count.attachedToWorkshops` shape the
  // JSX reads (Prisma's relation `attachedToWorkshops` → Drizzle
  // `workshopModules`).
  const modules = modulesRaw.map((m) => ({
    ...m,
    _count: { attachedToWorkshops: m.workshopModules.length },
  }));

  const completed = new Set(progressRows.map((r) => r.lessonId));
  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const totalDone = modules.reduce(
    (s, m) => s + m.lessons.filter((l) => completed.has(l.id)).length,
    0,
  );
  const percent =
    totalLessons === 0 ? 0 : Math.round((totalDone / totalLessons) * 100);

  // Find the next unfinished lesson in module order.
  let nextLesson: {
    id: string;
    title: string;
    summary: string | null;
    moduleTitle: string;
    moduleN: number;
  } | null = null;
  for (let mi = 0; mi < modules.length; mi++) {
    const m = modules[mi];
    for (const l of m.lessons) {
      if (!completed.has(l.id)) {
        nextLesson = {
          id: l.id,
          title: l.title,
          summary: l.summary,
          moduleTitle: m.title,
          moduleN: mi + 1,
        };
        break;
      }
    }
    if (nextLesson) break;
  }

  // Counts per difficulty (for filter chips).
  const difficultyCounts: Record<Difficulty, number> = {
    All: totalLessons,
    Easy: 0,
    Medium: 0,
    Hard: 0,
  };
  for (const m of modules) {
    for (const l of m.lessons) {
      if (l.difficulty && l.difficulty in difficultyCounts) {
        difficultyCounts[l.difficulty as Difficulty]++;
      }
    }
  }

  // Filter lessons by activeLevel + search query (preserving module grouping).
  const matchesQuery = (text: string | null) =>
    !!text && text.toLowerCase().includes(query.toLowerCase());
  const filteredModules = modules
    .map((m) => ({
      ...m,
      lessons: m.lessons.filter((l) => {
        const okLevel =
          activeLevel === "All" || l.difficulty === activeLevel;
        const okQuery =
          query.length === 0 ||
          matchesQuery(l.title) ||
          matchesQuery(l.summary) ||
          matchesQuery(m.title);
        return okLevel && okQuery;
      }),
    }))
    .filter(
      (m) =>
        m.lessons.length > 0 ||
        // Keep a fully-empty module visible only when no filters are applied.
        (activeLevel === "All" && query.length === 0),
    );

  const isInstructor =
    user.role === "admin" || user.role === "instructor";

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      {/* ──────────────────────────────────────────────────────────
       * Header (small label + h1 + subtitle)
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            local_library
          </span>
          <span className="text-xs font-bold tracking-wide">
            Lesson library
          </span>
        </div>
        <h1 className="text-headline-lg text-on-surface">Lessons</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          All the lessons we&apos;ve made. Workshops pick the chapters they
          want — the same chapter can show up in many workshops.
        </p>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * 1. CONTINUE CARD (only if there's a next lesson)
       * ────────────────────────────────────────────────────────── */}
      {nextLesson ? (
        <section className="sticker-shadow mb-10 rounded-[28px] border-2 border-primary bg-primary-fixed p-6 text-on-primary-fixed md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-primary">
                <span className="material-symbols-outlined text-[14px]">
                  play_arrow
                </span>
                {totalDone === 0 ? "Start here" : "Pick up where you left off"}
              </div>
              <h2 className="text-headline-md mt-2 text-on-primary-fixed">
                {nextLesson.title}
              </h2>
              <p className="mt-1 text-sm text-on-primary-fixed-variant">
                Chapter {String(nextLesson.moduleN).padStart(2, "0")} ·{" "}
                {nextLesson.moduleTitle}
                {nextLesson.summary && <> · {nextLesson.summary}</>}
              </p>
              <div className="mt-4 max-w-md">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                  <span>Your progress</span>
                  <span>
                    {totalDone} / {totalLessons} · {percent}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percent}%`,
                      background:
                        "linear-gradient(90deg, #57fae9 0%, #842bd2 100%)",
                    }}
                  />
                </div>
              </div>
            </div>
            <Link
              href={`/lessons/${nextLesson.id}`}
              className="sticker-shadow inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 font-bold text-on-primary"
            >
              {totalDone === 0 ? "Start lesson" : "Continue learning"}
              <span className="material-symbols-outlined text-[18px]">
                arrow_forward
              </span>
            </Link>
          </div>
        </section>
      ) : totalLessons > 0 ? (
        // All done — celebratory state
        <section className="sticker-shadow mb-10 rounded-[28px] border-2 border-secondary bg-secondary-container p-6 text-on-secondary-container md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-secondary">
                <span className="material-symbols-outlined text-[14px]">
                  emoji_events
                </span>
                All done!
              </div>
              <h2 className="text-headline-md mt-2 text-on-secondary-container">
                You&apos;ve finished every published lesson. Bravo.
              </h2>
              <p className="mt-1 text-sm">
                {totalLessons} / {totalLessons} lessons complete. Wait for
                your instructor to publish more, or jump back into a lesson
                for a refresher.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* ──────────────────────────────────────────────────────────
       * 2. SEARCH + DIFFICULTY FILTER
       * ────────────────────────────────────────────────────────── */}
      {totalLessons > 0 && (
        <form
          method="get"
          className="mb-3 flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2"
        >
          {activeLevel !== "All" && (
            <input type="hidden" name="level" value={activeLevel} />
          )}
          <span className="material-symbols-outlined text-on-surface-variant">
            search
          </span>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search lessons by title or topic…"
            className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
          />
          {query && (
            <a
              href={`/lessons${activeLevel !== "All" ? `?level=${activeLevel}` : ""}`}
              className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-destructive"
            >
              Clear
            </a>
          )}
        </form>
      )}
      {totalLessons > 0 && (
        <nav className="mb-8 flex flex-wrap gap-2">
          <FilterPill
            href="/lessons"
            label="All"
            count={difficultyCounts.All}
            active={activeLevel === "All"}
          />
          <FilterPill
            href="/lessons?level=Easy"
            label="Easy"
            count={difficultyCounts.Easy}
            active={activeLevel === "Easy"}
          />
          <FilterPill
            href="/lessons?level=Medium"
            label="Medium"
            count={difficultyCounts.Medium}
            active={activeLevel === "Medium"}
          />
          <FilterPill
            href="/lessons?level=Hard"
            label="Hard"
            count={difficultyCounts.Hard}
            active={activeLevel === "Hard"}
          />
        </nav>
      )}

      {/* ──────────────────────────────────────────────────────────
       * 3. MODULES AS A ROADMAP
       * ────────────────────────────────────────────────────────── */}
      {modules.length === 0 ? (
        <EmptyState isInstructor={isInstructor} />
      ) : filteredModules.length === 0 ? (
        <p className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center text-on-surface-variant">
          No {activeLevel.toLowerCase()} lessons published yet.
        </p>
      ) : (
        <ol className="space-y-12">
          {filteredModules.map((mod) => {
            const originalIdx = modules.findIndex((m) => m.id === mod.id);
            const moduleDone = mod.lessons.filter((l) =>
              completed.has(l.id),
            ).length;
            return (
              <li key={mod.id}>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-black ${
                        moduleDone === mod.lessons.length &&
                        mod.lessons.length > 0
                          ? "bg-secondary text-on-secondary"
                          : "bg-primary-container text-on-primary-container"
                      }`}
                    >
                      {String(originalIdx + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Chapter {String(originalIdx + 1).padStart(2, "0")}
                      </span>
                      <h2 className="text-headline-md text-on-surface">
                        {mod.title}
                      </h2>
                      {mod.description && (
                        <p className="mt-1 max-w-2xl text-on-surface-variant">
                          {mod.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {mod._count.attachedToWorkshops > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                        <span className="material-symbols-outlined text-[12px]">
                          home_storage
                        </span>
                        Used in {mod._count.attachedToWorkshops} workshop
                        {mod._count.attachedToWorkshops === 1 ? "" : "s"}
                      </span>
                    )}
                    <span className="mono-label rounded-full bg-surface-container px-3 py-1 text-on-surface-variant">
                      {moduleDone} / {mod.lessons.length}
                    </span>
                  </div>
                </div>

                {mod.lessons.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6 text-sm text-on-surface-variant">
                    No lessons here yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {mod.lessons.map((lesson, lessonIdx) => {
                      const done = completed.has(lesson.id);
                      const hasSlides =
                        !!lesson.slideFilePath || !!lesson.slidesUrl;
                      return (
                        <Link
                          key={lesson.id}
                          href={`/lessons/${lesson.id}`}
                          className={`group block rounded-[24px] border-2 bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary ${
                            done
                              ? "border-secondary/40"
                              : "border-outline-variant"
                          }`}
                        >
                          <div className="mb-3 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                  done
                                    ? "bg-secondary text-on-secondary"
                                    : "bg-surface-container text-on-surface-variant"
                                }`}
                              >
                                {done ? (
                                  <span className="material-symbols-outlined text-[14px]">
                                    check
                                  </span>
                                ) : (
                                  String(lessonIdx + 1).padStart(2, "0")
                                )}
                              </span>
                              {lesson.difficulty && (
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    DIFFICULTY_TONE[lesson.difficulty] ??
                                    "bg-surface-container text-on-surface-variant"
                                  }`}
                                >
                                  {lesson.difficulty}
                                </span>
                              )}
                            </div>
                            {done && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                                <span className="material-symbols-outlined text-[12px]">
                                  check_circle
                                </span>
                                Done
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-bold leading-tight text-on-surface group-hover:text-primary">
                            {lesson.title}
                          </h3>
                          {lesson.summary && (
                            <p className="mt-1.5 line-clamp-2 text-sm text-on-surface-variant">
                              {lesson.summary}
                            </p>
                          )}
                          {/* Indicators row */}
                          <div className="mt-3 flex items-center gap-3 text-[11px] font-bold text-on-surface-variant">
                            {hasSlides && (
                              <span className="inline-flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">
                                  slideshow
                                </span>
                                Slides
                              </span>
                            )}
                            {lesson.wokwiProjectUrl && (
                              <span className="inline-flex items-center gap-1 text-primary">
                                <span className="material-symbols-outlined text-[14px]">
                                  memory
                                </span>
                                Simulator
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Instructor helper row */}
      {isInstructor && modules.length > 0 && (
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-outline-variant bg-card p-4 text-sm">
          <span className="text-on-surface-variant">
            Want to add or edit a chapter?
          </span>
          <Link
            href="/admin/modules"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 font-bold text-on-primary"
          >
            Edit lessons
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </Link>
        </div>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function FilterPill({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
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

function EmptyState({ isInstructor }: { isInstructor: boolean }) {
  return (
    <div className="sticker-shadow mx-auto max-w-2xl rounded-[32px] border-2 border-outline-variant bg-card p-10 text-center">
      <div className="rotate-sticker mb-5 inline-flex items-center gap-2 rounded-full border-2 border-white bg-primary-fixed px-3 py-1 text-on-primary-fixed-variant shadow-sm">
        <span className="material-symbols-outlined text-[16px]">
          construction
        </span>
        <span className="text-xs font-bold tracking-wide">
          No lessons yet
        </span>
      </div>
      <h2 className="text-headline-md mb-2 text-on-surface">
        Your instructor hasn&apos;t published anything yet.
      </h2>
      <p className="mb-6 text-on-surface-variant">
        Check back soon — chapters and lessons show up here as they&apos;re
        added.
      </p>
      {isInstructor && (
        <Link
          href="/admin/modules"
          className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-on-primary transition-transform active:scale-95"
        >
          Add a chapter
          <span className="material-symbols-outlined text-[16px]">
            arrow_forward
          </span>
        </Link>
      )}
    </div>
  );
}
