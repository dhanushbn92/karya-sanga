import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, team as teamTable } from "@/lib/db";
import { submitProject } from "@/lib/actions/submissions";
import { getHackathonConfig } from "@/lib/hackathon-config";

export const metadata = { title: "Submit · Karya Sanga" };

export default async function SubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const teamRaw = await db.query.team.findFirst({
    where: eq(teamTable.id, id),
    with: {
      teamMembers: { columns: { userId: true } },
      submissions: true,
    },
  });
  if (!teamRaw) notFound();
  // Map Drizzle relation names back to the keys the JSX expects.
  // submissions is a many-relation in Drizzle but one-to-one in practice
  // (unique teamId), so collapse to the single row (or null).
  const team = {
    ...teamRaw,
    members: teamRaw.teamMembers,
    submission: teamRaw.submissions[0] ?? null,
  };
  const config = await getHackathonConfig(team.cohortId);

  // Must be on the team.
  if (!team.members.some((m) => m.userId === user.id)) {
    redirect(`/hackathon/teams/${team.id}`);
  }

  // Deadline check (UI-side; server action also enforces).
  const deadlinePassed = !!(
    config.submitBy && new Date() > config.submitBy
  );
  const submission = team.submission;
  const blocked =
    (submission?.locked === true) || (deadlinePassed && !submission);

  if (blocked) {
    return (
      <main className="mx-auto w-full max-w-[820px] flex-1 px-4 md:px-12 py-12">
        <BackLink id={team.id} />
        <div className="sticker-shadow rounded-[28px] border-2 border-outline-variant bg-card p-8">
          <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-surface-container px-3 py-1 text-on-surface-variant shadow-sm">
            <span className="material-symbols-outlined text-[14px]">
              lock
            </span>
            <span className="text-xs font-bold tracking-wide">
              Submissions closed
            </span>
          </div>
          <h1 className="text-headline-md mb-2 text-on-surface">
            {submission?.locked ? "Locked for judging" : "Deadline passed"}
          </h1>
          <p className="text-on-surface-variant">
            {submission?.locked
              ? "Your team's submission is locked. Ask your teacher to unlock it if you need to change something."
              : "The deadline has passed and your team didn't submit. Talk to your teacher to figure out next steps."}
          </p>
        </div>
      </main>
    );
  }

  // Pre-fill from workspace or existing (unlocked) submission.
  const defaults = submission ?? {
    title: team.projectTitle ?? "",
    description: team.projectDescription ?? "",
    repoUrl: team.repoUrl ?? "",
    demoVideoUrl: "",
    wokwiProjectUrl: "",
  };

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-4 md:px-12 py-12">
      <BackLink id={team.id} />

      <div className="rotate-sticker mb-4 inline-flex items-center gap-2 rounded-full border-2 border-white bg-primary-fixed px-3 py-1 text-on-primary-fixed-variant shadow-sm">
        <span className="material-symbols-outlined text-[16px]">
          rocket_launch
        </span>
        <span className="text-xs font-bold tracking-wide">
          {submission ? "Edit your entry" : "Share your project"}
        </span>
      </div>
      <h1 className="text-headline-lg text-on-surface">{team.name}</h1>
      <p className="mt-2 text-on-surface-variant">
        Once you submit, your entry is locked for judging. Your teacher can
        unlock it if you need to fix something.
      </p>
      {config.submitBy && !deadlinePassed && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-primary-fixed-variant">
          <span className="material-symbols-outlined text-[14px]">
            schedule
          </span>
          Deadline: {new Date(config.submitBy).toLocaleString()}
        </div>
      )}

      <form
        action={submitProject}
        className="mt-8 grid grid-cols-1 gap-5 rounded-[28px] border-2 border-outline-variant bg-card p-6 md:p-8 md:grid-cols-12"
      >
        <input type="hidden" name="teamId" value={team.id} />

        <label className="md:col-span-12 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Title
          </span>
          <input
            type="text"
            name="title"
            required
            minLength={1}
            maxLength={120}
            defaultValue={defaults.title}
            placeholder="Smart Plant Companion"
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-12 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Description
          </span>
          <textarea
            name="description"
            required
            minLength={20}
            maxLength={4000}
            rows={6}
            defaultValue={defaults.description}
            placeholder="What you built, why it matters, and how AI fits in. The judges will read this first."
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
          <span className="block text-xs text-on-surface-variant">
            At least 20 characters. Markdown is fine.
          </span>
        </label>

        <label className="md:col-span-6 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Demo video URL
          </span>
          <input
            type="url"
            name="demoVideoUrl"
            defaultValue={defaults.demoVideoUrl ?? ""}
            placeholder="https://youtu.be/..."
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-6 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Wokwi URL
          </span>
          <input
            type="url"
            name="wokwiProjectUrl"
            defaultValue={defaults.wokwiProjectUrl ?? ""}
            placeholder="https://wokwi.com/projects/..."
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <label className="md:col-span-12 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Repo URL
          </span>
          <input
            type="url"
            name="repoUrl"
            defaultValue={defaults.repoUrl ?? ""}
            placeholder="https://github.com/..."
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary-container px-6 py-3 font-bold text-on-primary-container transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">
              {submission ? "save" : "rocket_launch"}
            </span>
            {submission ? "Save edits" : "Submit project"}
          </button>
          <Link
            href={`/hackathon/teams/${team.id}`}
            className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant px-5 py-3 font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/hackathon/teams/${id}`}
      className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
    >
      <span className="material-symbols-outlined text-[14px]">arrow_back</span>
      Back to team
    </Link>
  );
}
