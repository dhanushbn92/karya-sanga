import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Judging · Karya Sanga" };

export default async function JudgeIndexPage() {
  const me = await requireRole(["admin", "instructor", "judge"]);

  const submissions = await prisma.submission.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      team: { select: { id: true, name: true } },
      scores: {
        where: { judgeId: me.id },
        select: { innovation: true, technical: true, aiUse: true, presentation: true },
      },
      _count: { select: { scores: true } },
    },
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Judging
      </span>
      <h1 className="text-headline-lg text-on-surface">Score submissions</h1>
      <p className="mt-2 text-on-surface-variant">
        Score 1–10 on innovation, technical execution, AI use, and presentation.
        Your scores are private; only the aggregate is shared.
      </p>

      {submissions.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
          No submissions to judge yet.
        </p>
      ) : (
        <ul className="mt-10 space-y-3">
          {submissions.map((s) => {
            const myScore = s.scores[0];
            const myTotal = myScore
              ? myScore.innovation +
                myScore.technical +
                myScore.aiUse +
                myScore.presentation
              : null;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/hackathon/judge/${s.id}`}
                  className="glass-card flex items-center gap-4 rounded-2xl p-5 transition-colors hover:border-primary/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-medium text-on-surface">
                      {s.title}
                    </div>
                    <div className="mono-label mt-1 text-on-surface-variant">
                      {s.team.name} · {s._count.scores} judge
                      {s._count.scores === 1 ? "" : "s"} · submitted{" "}
                      {new Date(s.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {myTotal === null ? (
                      <span className="mono-label rounded-full bg-primary/10 px-3 py-1 text-primary">
                        Score
                      </span>
                    ) : (
                      <>
                        <div className="text-headline-md text-primary">
                          {myTotal}
                        </div>
                        <div className="mono-label text-on-surface-variant">
                          your total / 40
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
