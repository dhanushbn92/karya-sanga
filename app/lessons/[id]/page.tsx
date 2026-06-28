import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LessonBody } from "@/components/lessons/lesson-body";
import { MarkCompleteButton } from "@/components/lessons/mark-complete-button";

export const metadata = { title: "Lesson · Yukti AI Labs" };

const DIFFICULTY_TONE: Record<string, string> = {
  Easy: "bg-primary-fixed text-on-primary-fixed-variant",
  Medium: "bg-secondary-container text-on-secondary-container",
  Hard: "bg-tertiary-fixed text-on-tertiary-fixed",
};

/**
 * Lesson reader. Polished to match the lesson library + workshop revamps:
 *
 *   - Breadcrumb back to the library (`/lessons`)
 *   - Module label with module number + module progress mini-bar
 *   - Action row: primary CTAs first (Continue/Done, Present), secondary
 *     resources (slides, Wokwi) styled as muted pills
 *   - Sidebar: numbered chips that match the listing — green check on done,
 *     filled saffron on current, neutral on upcoming
 *   - Footer prev/next references module context, not just lesson titles
 */
export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const lesson = await prisma.lesson.findFirst({
    where: { id, published: true },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          order: true,
          lessons: {
            where: { published: true },
            orderBy: { order: "asc" },
            select: { id: true, title: true, difficulty: true },
          },
        },
      },
    },
  });

  if (!lesson) notFound();

  const [progressRows, myProgress, allModules] = await Promise.all([
    prisma.progress.findMany({
      where: {
        userId: user.id,
        lessonId: { in: lesson.module.lessons.map((l) => l.id) },
        completed: true,
      },
      select: { lessonId: true },
    }),
    prisma.progress.findUnique({
      where: { userId_lessonId: { userId: user.id, lessonId: lesson.id } },
      select: { completed: true },
    }),
    // Used only to compute the module's display number across the library.
    prisma.module.findMany({
      where: { published: true },
      orderBy: { order: "asc" },
      select: { id: true },
    }),
  ]);
  const completed = new Set(progressRows.map((p) => p.lessonId));
  const isComplete = myProgress?.completed ?? false;

  // Position metadata
  const moduleN = allModules.findIndex((m) => m.id === lesson.module.id) + 1;
  const idx = lesson.module.lessons.findIndex((l) => l.id === lesson.id);
  const prev = idx > 0 ? lesson.module.lessons[idx - 1] : null;
  const next =
    idx >= 0 && idx < lesson.module.lessons.length - 1
      ? lesson.module.lessons[idx + 1]
      : null;
  const moduleDone = lesson.module.lessons.filter((l) =>
    completed.has(l.id),
  ).length;
  const moduleTotal = lesson.module.lessons.length;
  const modulePct =
    moduleTotal === 0 ? 0 : Math.round((moduleDone / moduleTotal) * 100);

  const hasSlides = !!lesson.slideFilePath || !!lesson.slidesUrl;

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-8 px-4 py-8 md:px-8 lg:py-10">
      {/* ──────────────────────────────────────────────────────────
       * SIDEBAR — module lessons + progress
       * ────────────────────────────────────────────────────────── */}
      <aside className="sticky top-24 hidden h-fit w-72 shrink-0 rounded-[24px] border-2 border-outline-variant bg-card p-5 lg:block">
        <Link
          href="/lessons"
          className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">
            arrow_back
          </span>
          Lesson library
        </Link>
        <div className="mb-1 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-container text-xs font-black text-on-primary-container">
            {String(moduleN).padStart(2, "0")}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Chapter
          </span>
        </div>
        <h2 className="text-base font-bold leading-tight text-on-surface">
          {lesson.module.title}
        </h2>
        {/* Mini progress */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            <span>Progress</span>
            <span>
              {moduleDone} / {moduleTotal}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${modulePct}%`,
                background:
                  "linear-gradient(90deg, #57fae9 0%, #842bd2 100%)",
              }}
            />
          </div>
        </div>

        <ul className="mt-5 space-y-1">
          {lesson.module.lessons.map((l, i) => {
            const isCurrent = l.id === lesson.id;
            const done = completed.has(l.id);
            return (
              <li key={l.id}>
                <Link
                  href={`/lessons/${l.id}`}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                    isCurrent
                      ? "bg-primary-fixed text-on-primary-fixed-variant"
                      : "text-on-surface-variant hover:bg-surface-container"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-secondary text-on-secondary"
                        : isCurrent
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {done ? (
                      <span className="material-symbols-outlined text-[14px]">
                        check
                      </span>
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="line-clamp-2 text-sm font-bold">
                    {l.title}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ──────────────────────────────────────────────────────────
       * MAIN — lesson content
       * ────────────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1">
        {/* Mobile back link — sidebar is hidden below lg */}
        <Link
          href="/lessons"
          className="mb-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary lg:hidden"
        >
          <span className="material-symbols-outlined text-[14px]">
            arrow_back
          </span>
          Lesson library
        </Link>

        {/* Module breadcrumb pill row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[14px]">
              menu_book
            </span>
            Chapter {String(moduleN).padStart(2, "0")} ·{" "}
            {lesson.module.title}
          </span>
          {lesson.difficulty && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                DIFFICULTY_TONE[lesson.difficulty] ??
                "bg-surface-container text-on-surface-variant"
              }`}
            >
              {lesson.difficulty}
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-secondary-container">
              <span className="material-symbols-outlined text-[14px]">
                check_circle
              </span>
              Done
            </span>
          )}
        </div>

        {/* Title + summary */}
        <h1 className="text-headline-lg mb-3 leading-tight text-on-surface">
          {lesson.title}
        </h1>
        {lesson.summary && (
          <p className="mb-8 max-w-3xl text-lg text-on-surface-variant">
            {lesson.summary}
          </p>
        )}

        {/* Primary actions */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <MarkCompleteButton
            lessonId={lesson.id}
            isComplete={isComplete}
          />
          <Link
            href={`/lessons/${lesson.id}/present`}
            target="_blank"
            rel="noopener"
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">
              slideshow
            </span>
            Present
            <span className="material-symbols-outlined text-[14px]">
              open_in_new
            </span>
          </Link>
        </div>

        {/* Secondary resources row — only if any */}
        {(hasSlides || lesson.wokwiProjectUrl) && (
          <div className="mb-8">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              Resources
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lesson.slideFilePath && (
                <Link
                  href={`/lessons/${lesson.id}/deck`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-1.5 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {lesson.slideFileType === "application/pdf"
                      ? "picture_as_pdf"
                      : "slideshow"}
                  </span>
                  Slides deck
                  <span className="material-symbols-outlined text-[12px]">
                    open_in_new
                  </span>
                </Link>
              )}
              {lesson.slidesUrl && (
                <a
                  href={lesson.slidesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-1.5 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    slideshow
                  </span>
                  External slides
                  <span className="material-symbols-outlined text-[12px]">
                    open_in_new
                  </span>
                </a>
              )}
              {lesson.wokwiProjectUrl && (
                <a
                  href={lesson.wokwiProjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-1.5 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    memory
                  </span>
                  Open in Wokwi
                  <span className="material-symbols-outlined text-[12px]">
                    open_in_new
                  </span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Lesson body */}
        <article className="rounded-[28px] border-2 border-outline-variant bg-card p-6 md:p-10">
          <LessonBody markdown={lesson.body} />
        </article>

        {/* Prev / Next */}
        <nav className="mt-8 flex flex-col items-stretch gap-3 md:flex-row">
          {prev ? (
            <Link
              href={`/lessons/${prev.id}`}
              className="group flex-1 rounded-2xl border-2 border-outline-variant bg-card p-4 transition-colors hover:border-primary"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                ← Previous lesson
              </span>
              <div className="mt-1 text-base font-bold text-on-surface group-hover:text-primary">
                {prev.title}
              </div>
              <div className="mt-0.5 text-[11px] text-on-surface-variant">
                Chapter {String(moduleN).padStart(2, "0")} ·{" "}
                {lesson.module.title}
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/lessons/${next.id}`}
              className="group flex-1 rounded-2xl border-2 border-outline-variant bg-card p-4 text-right transition-colors hover:border-primary"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Next lesson →
              </span>
              <div className="mt-1 text-base font-bold text-on-surface group-hover:text-primary">
                {next.title}
              </div>
              <div className="mt-0.5 text-[11px] text-on-surface-variant">
                Chapter {String(moduleN).padStart(2, "0")} ·{" "}
                {lesson.module.title}
              </div>
            </Link>
          ) : (
            <div className="flex-1" />
          )}
        </nav>
      </main>
    </div>
  );
}
