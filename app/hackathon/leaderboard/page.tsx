import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db, hackathonConfig, submission } from "@/lib/db";

export const metadata = { title: "Leaderboard · Karya Sanga" };

export default async function LeaderboardPage() {
  const user = await requireUser();
  const isPrivileged =
    user.role === "admin" ||
    user.role === "instructor" ||
    user.role === "judge";

  const [config] = await db
    .insert(hackathonConfig)
    .values({ id: "default", updatedAt: new Date() })
    .onConflictDoUpdate({
      target: hackathonConfig.id,
      set: { id: "default" },
    })
    .returning({ leaderboardPublic: hackathonConfig.leaderboardPublic });

  // Gate: privileged users always see it; participants only when public.
  if (!isPrivileged && !config.leaderboardPublic) {
    redirect("/hackathon");
  }

  const submissions = await db.query.submission.findMany({
    with: {
      team: { columns: { id: true, name: true } },
      scores: true,
    },
  });

  // Aggregate: mean of per-judge totals (innovation + technical + AI + presentation = max 40).
  const ranked = submissions
    .map((s) => {
      const totals = s.scores.map(
        (sc) => sc.innovation + sc.technical + sc.aiUse + sc.presentation,
      );
      const avg =
        totals.length === 0
          ? null
          : totals.reduce((a, b) => a + b, 0) / totals.length;
      return {
        id: s.id,
        team: s.team,
        title: s.title,
        judgeCount: s.scores.length,
        avg,
      };
    })
    .sort((a, b) => {
      // Submissions with no scores fall to the bottom.
      if (a.avg === null && b.avg === null) return 0;
      if (a.avg === null) return 1;
      if (b.avg === null) return -1;
      return b.avg - a.avg;
    });

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/hackathon"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        Hackathon
      </Link>

      <div className="rotate-sticker mb-4 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
        <span className="material-symbols-outlined text-[16px]">
          emoji_events
        </span>
        <span className="text-xs font-bold tracking-wide">Leaderboard</span>
      </div>
      <h1 className="text-headline-lg gradient-text">Top builds</h1>
      <p className="mt-2 text-on-surface-variant">
        Average of each judge&apos;s total across the four criteria (max 40 per
        judge).
      </p>

      {!config.leaderboardPublic && (
        <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant">
          <span className="material-symbols-outlined text-[14px]">
            visibility
          </span>
          Not yet public — only operators see this.
        </p>
      )}

      {ranked.length === 0 ? (
        <p className="mt-8 rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6 text-on-surface-variant">
          No submissions yet.
        </p>
      ) : (
        <ol className="mt-8 space-y-3">
          {ranked.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-4 rounded-[24px] border-2 border-outline-variant bg-card p-4 md:p-5"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                  i === 0
                    ? "bg-primary text-on-primary"
                    : i === 1
                      ? "bg-secondary text-on-secondary"
                      : i === 2
                        ? "bg-tertiary text-on-tertiary"
                        : "bg-surface-container text-on-surface"
                }`}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/hackathon/teams/${s.team.id}`}
                  className="text-base font-bold text-on-surface hover:text-primary"
                >
                  {s.title}
                </Link>
                <div className="text-xs text-on-surface-variant">
                  {s.team.name} ·{" "}
                  {s.judgeCount === 0
                    ? "Not yet scored"
                    : `${s.judgeCount} judge${s.judgeCount === 1 ? "" : "s"}`}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-headline-md text-on-surface">
                  {s.avg === null ? "—" : s.avg.toFixed(1)}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  avg / 40
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
