import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ScoreForm } from "@/components/hackathon/score-form";

export const metadata = { title: "Score submission · Karya Sanga" };

export default async function ScoreSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const me = await requireRole(["admin", "instructor", "judge"]);
  const { submissionId } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: {
      team: { select: { id: true, name: true } },
      scores: { where: { judgeId: me.id } },
    },
  });
  if (!submission) notFound();

  const myScore = submission.scores[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin/hackathon/judge"
        className="mono-label mb-4 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← All submissions
      </Link>

      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Score
      </span>
      <h1 className="text-headline-lg text-on-surface">{submission.title}</h1>
      <p className="mt-1 text-on-surface-variant">{submission.team.name}</p>

      {/* Submission details */}
      <section className="glass-card mt-8 rounded-3xl p-8">
        <h2 className="mono-label mb-3 text-primary">Description</h2>
        <p className="whitespace-pre-wrap text-on-surface">
          {submission.description}
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
          {submission.demoVideoUrl && (
            <a
              href={submission.demoVideoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-on-surface-variant hover:border-primary/40 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                play_circle
              </span>
              Demo video
              <span className="material-symbols-outlined text-[12px]">
                open_in_new
              </span>
            </a>
          )}
          {submission.wokwiProjectUrl && (
            <a
              href={submission.wokwiProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-on-surface-variant hover:border-primary/40 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                memory
              </span>
              Wokwi
              <span className="material-symbols-outlined text-[12px]">
                open_in_new
              </span>
            </a>
          )}
          {submission.repoUrl && (
            <a
              href={submission.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-on-surface-variant hover:border-primary/40 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                code
              </span>
              Repo
              <span className="material-symbols-outlined text-[12px]">
                open_in_new
              </span>
            </a>
          )}
        </div>
      </section>

      {/* Score form */}
      <section className="glass-card saffron-glow mt-8 rounded-3xl p-8">
        <h2 className="text-headline-md mb-2 text-on-surface">
          {myScore ? "Update your scores" : "Score this submission"}
        </h2>
        <p className="mb-6 text-on-surface-variant">
          1 = needs work, 10 = exceptional. Only the aggregate across all
          judges is shown publicly.
        </p>

        <ScoreForm
          submissionId={submission.id}
          initial={{
            innovation: myScore?.innovation,
            technical: myScore?.technical,
            aiUse: myScore?.aiUse,
            presentation: myScore?.presentation,
            comment: myScore?.comment,
          }}
          lastUpdated={myScore?.updatedAt ?? null}
        />
      </section>
    </main>
  );
}
