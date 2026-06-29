import Link from "next/link";
import { asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import {
  db,
  hackathonConfig,
  team,
  submission,
  score,
  cohort,
} from "@/lib/db";
import {
  lockSubmission,
  unlockSubmission,
  updateHackathonConfig,
} from "@/lib/actions/submissions";

export const metadata = { title: "Hackathon · Admin" };

export default async function HackathonAdminPage() {
  await requireRole(["admin", "instructor"]);

  const [config, teams, submissionsRaw, scoreCounts, perWorkshopOverridesRaw] =
    await Promise.all([
      // Global default config — per-workshop overrides live on each cohort.
      // upsert on the "default" row, then read it back.
      db
        .insert(hackathonConfig)
        .values({ id: "default", updatedAt: new Date() })
        .onConflictDoNothing({ target: hackathonConfig.id })
        .then(() =>
          db.query.hackathonConfig.findFirst({
            where: eq(hackathonConfig.id, "default"),
          }),
        ),
      db.$count(team),
      db.query.submission.findMany({
        orderBy: [desc(submission.submittedAt)],
        with: {
          team: { columns: { id: true, name: true } },
        },
        extras: {
          scoreCount:
            sql<number>`(select count(*)::int from ${score} where ${score.submissionId} = ${submission.id})`.as(
              "scoreCount",
            ),
        },
      }),
      db.$count(score),
      // Workshops with their own hackathon config — surface them here so
      // admins can see at a glance which workshops differ from default.
      db.query.cohort.findMany({
        where: sql`exists (select 1 from ${hackathonConfig} where ${hackathonConfig.cohortId} = ${cohort.id})`,
        columns: { id: true, name: true },
        with: {
          hackathonConfigs: {
            columns: { maxTeamSize: true, submitBy: true },
          },
        },
        orderBy: [asc(cohort.name)],
      }),
    ]);

  // config is the upserted "default" row (always exists after the insert above).
  if (!config) throw new Error("HackathonConfig default row missing");

  // Map Drizzle relation names back to the keys the JSX expects:
  // _count.scores → scoreCount extra; hackathonConfig (one) → hackathonConfigs[0].
  const submissions = submissionsRaw.map((s) => ({
    ...s,
    _count: { scores: Number(s.scoreCount) },
  }));
  const perWorkshopOverrides = perWorkshopOverridesRaw.map((c) => ({
    ...c,
    hackathonConfig: c.hackathonConfigs[0] ?? null,
  }));

  // Format datetime-local input value (YYYY-MM-DDTHH:mm)
  const submitByValue = config.submitBy
    ? new Date(config.submitBy.getTime() - config.submitBy.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Hackathon ops
      </span>
      <h1 className="text-headline-lg text-on-surface">Hackathon</h1>
      <p className="mt-2 text-on-surface-variant">
        Set the deadline, watch submissions land, and open the leaderboard
        when judging is done.
      </p>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Teams" value={teams} />
        <Stat label="Submissions" value={submissions.length} />
        <Stat label="Scores cast" value={scoreCounts} />
        <Stat
          label="Leaderboard"
          value={config.leaderboardPublic ? "Public" : "Private"}
        />
      </div>

      {/* Config */}
      <section className="glass-card mt-10 rounded-3xl p-8">
        <h2 className="text-headline-md mb-1 text-on-surface">Settings</h2>
        <p className="mb-5 text-on-surface-variant">
          Updates take effect immediately.
        </p>
        <form
          action={updateHackathonConfig}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Max team size
            </span>
            <input
              type="number"
              name="maxTeamSize"
              defaultValue={config.maxTeamSize}
              min={1}
              max={20}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-6 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Submission deadline (your local timezone)
            </span>
            <input
              type="datetime-local"
              name="submitBy"
              defaultValue={submitByValue}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="leaderboardPublic"
            className="md:col-span-3 flex items-end gap-3 pb-2"
          >
            <input
              id="leaderboardPublic"
              type="checkbox"
              name="leaderboardPublic"
              defaultChecked={config.leaderboardPublic}
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">
              Leaderboard public
            </span>
          </label>
          <div className="md:col-span-12">
            <button
              type="submit"
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
              Save settings
            </button>
          </div>
        </form>
      </section>

      {/* Per-workshop overrides — workshops that differ from default */}
      <section className="glass-card mt-10 rounded-3xl p-6">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">
            Per-workshop overrides
          </h2>
          <span className="mono-label text-on-surface-variant">
            {perWorkshopOverrides.length} workshop
            {perWorkshopOverrides.length === 1 ? "" : "s"}
          </span>
        </div>
        {perWorkshopOverrides.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-5 text-sm text-on-surface-variant">
            No workshop overrides set yet. Configure one from a workshop&apos;s
            admin page —{" "}
            <Link
              href="/admin/cohorts"
              className="font-bold text-primary hover:underline"
            >
              /admin/cohorts
            </Link>
            .
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {perWorkshopOverrides.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/cohorts/${c.id}`}
                  className="group block rounded-2xl border border-white/10 bg-surface-container-low p-4 hover:border-primary/30"
                >
                  <div className="font-bold text-on-surface group-hover:text-primary">
                    {c.name}
                  </div>
                  <div className="mt-1 text-[11px] text-on-surface-variant">
                    Max team size:{" "}
                    <span className="font-bold text-on-surface">
                      {c.hackathonConfig?.maxTeamSize}
                    </span>{" "}
                    · Deadline:{" "}
                    <span className="font-bold text-on-surface">
                      {c.hackathonConfig?.submitBy
                        ? new Date(
                            c.hackathonConfig.submitBy,
                          ).toLocaleString()
                        : "open"}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cross-links */}
      <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/admin/hackathon/teams"
          className="glass-card group block rounded-3xl p-6 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-2xl text-primary">
            groups
          </span>
          <h3 className="text-base font-medium mt-2 text-on-surface group-hover:text-primary">
            Manage teams
          </h3>
          <p className="text-sm text-on-surface-variant">
            Place participants, move between teams, set captains.
          </p>
        </Link>
        <Link
          href="/admin/hackathon/judge"
          className="glass-card group block rounded-3xl p-6 transition-colors hover:border-primary/30"
        >
          <span className="material-symbols-outlined text-2xl text-primary">
            gavel
          </span>
          <h3 className="text-base font-medium mt-2 text-on-surface group-hover:text-primary">
            Judging
          </h3>
          <p className="text-sm text-on-surface-variant">
            Score submissions across the four criteria.
          </p>
        </Link>
      </section>

      {/* Submissions table */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">Submissions</h2>
          <Link
            href="/admin/hackathon/judge"
            className="mono-label inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-primary hover:bg-primary/10"
          >
            Open judging
            <span className="material-symbols-outlined text-[12px]">
              arrow_forward
            </span>
          </Link>
        </div>

        {submissions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No submissions yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low text-left mono-label text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Team / Title</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Scores</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-white/5 bg-surface-container/40"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/hackathon/teams/${s.team.id}`}
                        className="font-medium text-on-surface hover:text-primary"
                      >
                        {s.title}
                      </Link>
                      <div className="text-xs text-on-surface-variant">
                        {s.team.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {new Date(s.submittedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`mono-label rounded-full px-2 py-0.5 ${
                          s.locked
                            ? "bg-primary/10 text-primary"
                            : "bg-tertiary/10 text-tertiary"
                        }`}
                      >
                        {s.locked ? "Locked" : "Open for edits"}
                      </span>
                    </td>
                    <td className="px-4 py-3 mono-label text-on-surface-variant">
                      {s._count.scores} judge
                      {s._count.scores === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/hackathon/judge/${s.id}`}
                          className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                        >
                          Score
                        </Link>
                        {s.locked ? (
                          <form action={unlockSubmission}>
                            <input
                              type="hidden"
                              name="submissionId"
                              value={s.id}
                            />
                            <button
                              type="submit"
                              className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                            >
                              Unlock
                            </button>
                          </form>
                        ) : (
                          <form action={lockSubmission}>
                            <input
                              type="hidden"
                              name="submissionId"
                              value={s.id}
                            />
                            <button
                              type="submit"
                              className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                            >
                              Lock
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="text-headline-md text-on-surface">{value}</div>
      <div className="mono-label mt-1 text-on-surface-variant">{label}</div>
    </div>
  );
}
