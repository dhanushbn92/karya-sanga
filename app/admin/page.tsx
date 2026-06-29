import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db, module, lesson, user as userTable, wallPost, cohort } from "@/lib/db";

export const metadata = { title: "Admin · Karya Sanga" };

export default async function AdminPage() {
  const user = await requireRole(["admin", "instructor"]);

  const [
    moduleCount,
    lessonCount,
    publishedLessonCount,
    userCount,
    pendingWallCount,
    cohortCount,
  ] = await Promise.all([
    db.$count(module),
    db.$count(lesson),
    db.$count(lesson, eq(lesson.published, true)),
    db.$count(userTable),
    db.$count(
      wallPost,
      and(eq(wallPost.approved, false), eq(wallPost.rejected, false)),
    ),
    db.$count(cohort),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Teacher tools
      </span>
      <h1 className="text-headline-lg text-on-surface">Admin area</h1>
      <p className="mt-2 text-on-surface-variant">
        You have{" "}
        <span className="mono-label inline-block rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {user.role}
        </span>{" "}
        access. Edit lessons, manage workshops, and curate Wokwi project
        links.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Chapters" value={moduleCount} />
        <Stat label="Lessons" value={lessonCount} />
        <Stat label="Published" value={publishedLessonCount} />
        <Stat label="Users" value={userCount} />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/admin/cohorts"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-3xl text-primary">
            home_storage
          </span>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Workshops
          </h2>
          <p className="text-on-surface-variant">
            Set up workshops, add members, mark the current one.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open · {cohortCount} workshop{cohortCount === 1 ? "" : "s"}
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>
        <Link
          href="/admin/badges"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-3xl text-primary">
            workspace_premium
          </span>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Badges
          </h2>
          <p className="text-on-surface-variant">
            Award workshop or platform badges to people. 17 in the catalog.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/admin/modules"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-3xl text-primary">
            menu_book
          </span>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Modules & lessons
          </h2>
          <p className="text-on-surface-variant">
            Create modules, add lessons with markdown bodies, attach a Wokwi
            project URL, and publish.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>

        <Link
          href="/admin/hackathon"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-3xl text-primary">
            rocket_launch
          </span>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Hackathon ops
          </h2>
          <p className="text-on-surface-variant">
            Set the submission deadline, watch teams submit, run judging, open
            the leaderboard.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>

        <Link
          href="/admin/simulator/starters"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-3xl text-primary">
            memory
          </span>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Wokwi starters
          </h2>
          <p className="text-on-surface-variant">
            Curated starter projects kids can fork in one click.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>

        <Link
          href="/admin/wall"
          className="glass-card group block rounded-3xl p-8 transition-colors hover:border-primary/30"
        >
          <div className="flex items-start justify-between">
            <span className="material-symbols-outlined text-3xl text-primary">
              photo_library
            </span>
            {pendingWallCount > 0 && (
              <span className="mono-label rounded-full bg-primary px-2 py-0.5 text-on-primary">
                {pendingWallCount} pending
              </span>
            )}
          </div>
          <h2 className="text-headline-md mt-4 mb-1 text-on-surface group-hover:text-primary">
            Wall moderation
          </h2>
          <p className="text-on-surface-variant">
            Approve, reject, or delete community wall posts. Toggle approval
            requirement.
          </p>
          <div className="mono-label mt-4 inline-flex items-center gap-1 text-primary">
            Open
            <span className="material-symbols-outlined text-[14px]">
              arrow_forward
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="text-headline-md text-on-surface">{value}</div>
      <div className="mono-label mt-1 text-on-surface-variant">{label}</div>
    </div>
  );
}
