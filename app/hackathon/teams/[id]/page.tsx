import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, team as teamTable } from "@/lib/db";
import {
  addTeamWokwiLink,
  deleteTeamMessage,
  leaveTeam,
  postTeamMessage,
  removeTeamWokwiLink,
  updateTeamWorkspace,
} from "@/lib/actions/hackathon";
import { getHackathonConfig } from "@/lib/hackathon-config";

export const metadata = { title: "Team workspace · Karya Sanga" };

export default async function TeamWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const teamRaw = await db.query.team.findFirst({
    where: eq(teamTable.id, id),
    with: {
      teamMembers: {
        orderBy: (m, { asc }) => [asc(m.joinedAt)],
        with: {
          user: { columns: { id: true, name: true, email: true } },
        },
      },
      teamWokwiLinks: { orderBy: (l, { desc }) => [desc(l.createdAt)] },
      submissions: true,
      teamMessages: {
        orderBy: (msg, { asc }) => [asc(msg.createdAt)],
        limit: 100,
        with: {
          user: {
            columns: { id: true, name: true, email: true, handle: true },
          },
        },
      },
    },
  });
  const config = await getHackathonConfig(teamRaw?.cohortId ?? null);
  if (!teamRaw) notFound();

  // Map Drizzle relation names back to the keys the JSX expects.
  // submissions is a many-relation in Drizzle but one-to-one in practice
  // (unique teamId), so collapse to the single row (or null).
  const team = {
    ...teamRaw,
    members: teamRaw.teamMembers,
    wokwiLinks: teamRaw.teamWokwiLinks,
    submission: teamRaw.submissions[0] ?? null,
    messages: teamRaw.teamMessages.map((msg) => ({
      ...msg,
      author: msg.user,
    })),
  };

  const now = new Date();
  const deadlinePassed = !!(config.submitBy && now > config.submitBy);
  const submission = team.submission;

  const me = team.members.find((m) => m.userId === user.id);
  // Non-members can view but not edit. Captains can manage looking-for-members.
  const canEdit = !!me;
  const isCaptain = !!me?.isCaptain;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/hackathon"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        All teams
      </Link>

      {/* Header */}
      <header className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[16px]">
              workspaces
            </span>
            <span className="text-xs font-bold tracking-wide">
              Team workspace
            </span>
          </div>
          <h1 className="text-headline-lg text-on-surface">{team.name}</h1>
          {team.description && (
            <p className="mt-1 max-w-2xl text-on-surface-variant">
              {team.description}
            </p>
          )}
        </div>
        {canEdit && (
          <form action={leaveTeam}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-destructive hover:text-destructive"
            >
              <span className="material-symbols-outlined text-[16px]">
                logout
              </span>
              Leave team
            </button>
          </form>
        )}
      </header>

      {/* Submission status banner */}
      <SubmissionBanner
        teamId={team.id}
        canEdit={canEdit}
        deadlinePassed={deadlinePassed}
        submitBy={config.submitBy}
        submission={submission}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left column — members */}
        <aside className="rounded-[28px] border-2 border-outline-variant bg-card p-6 lg:col-span-4">
          <h2 className="mb-4 text-base font-bold uppercase tracking-wider text-on-surface-variant">
            Members
          </h2>
          <ul className="space-y-3">
            {team.members.map((m) => {
              const displayName =
                m.user.name ?? m.user.email.split("@")[0];
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <li key={m.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-base font-bold text-on-secondary-container">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-bold text-on-surface">
                        {displayName}
                      </span>
                      {m.isCaptain && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-on-primary-fixed-variant">
                          <span className="material-symbols-outlined text-[10px]">
                            star
                          </span>
                          Captain
                        </span>
                      )}
                      {m.userId === user.id && (
                        <span className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed">
                          You
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-on-surface-variant">
                      {m.user.email}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-outline-variant pt-3 text-xs text-on-surface-variant">
            {team.members.length} member
            {team.members.length === 1 ? "" : "s"} ·{" "}
            <span
              className={
                team.lookingForMembers
                  ? "font-bold text-primary"
                  : "text-on-surface-variant"
              }
            >
              {team.lookingForMembers ? "Open to join" : "Closed to new members"}
            </span>
          </div>
        </aside>

        {/* Right column — workspace */}
        <section className="space-y-6 lg:col-span-8">
          {/* Project workspace */}
          <div className="rounded-[28px] border-2 border-outline-variant bg-card p-6">
            <h2 className="mb-1 text-base font-bold uppercase tracking-wider text-primary">
              Project workspace
            </h2>
            <p className="mb-5 text-sm text-on-surface-variant">
              Use this scratchpad while you build. The submission form (deadline
              week) will start with these values pre-filled.
            </p>

            {canEdit ? (
              <form
                action={updateTeamWorkspace}
                className="grid grid-cols-1 gap-4 md:grid-cols-12"
              >
                <input type="hidden" name="teamId" value={team.id} />
                <label className="md:col-span-7 space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Project title
                  </span>
                  <input
                    type="text"
                    name="projectTitle"
                    defaultValue={team.projectTitle ?? ""}
                    maxLength={120}
                    placeholder="Smart Plant Companion"
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <label className="md:col-span-5 space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Repo URL
                  </span>
                  <input
                    type="url"
                    name="repoUrl"
                    defaultValue={team.repoUrl ?? ""}
                    placeholder="https://github.com/..."
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <label className="md:col-span-12 space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Description
                  </span>
                  <textarea
                    name="projectDescription"
                    rows={3}
                    maxLength={2000}
                    defaultValue={team.projectDescription ?? ""}
                    placeholder="What problem are you solving? How does it use AI + electronics?"
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <label className="md:col-span-12 space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Build log
                  </span>
                  <textarea
                    name="buildLog"
                    rows={8}
                    maxLength={10000}
                    defaultValue={team.buildLog ?? ""}
                    placeholder={"Day 1 — wired the sensor, soil reads 1240 dry, 3200 wet.\nDay 2 — added the AI threshold check via..."}
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                {isCaptain && (
                  <label
                    htmlFor="lookingForMembers"
                    className="md:col-span-12 flex items-center gap-3"
                  >
                    <input
                      id="lookingForMembers"
                      type="checkbox"
                      name="lookingForMembers"
                      defaultChecked={team.lookingForMembers}
                      className="h-5 w-5 rounded border-2 border-outline-variant text-primary focus:ring-primary"
                    />
                    <span className="text-sm font-bold text-on-surface-variant">
                      Looking for more members (show on the hackathon board)
                    </span>
                  </label>
                )}
                <div className="md:col-span-12">
                  <button
                    type="submit"
                    className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      save
                    </span>
                    Save workspace
                  </button>
                </div>
              </form>
            ) : (
              <ReadOnlyWorkspace team={team} />
            )}
          </div>

          {/* Wokwi links */}
          <div className="rounded-[28px] border-2 border-outline-variant bg-card p-6">
            <h2 className="mb-1 text-base font-bold uppercase tracking-wider text-primary">
              Wokwi project links
            </h2>
            <p className="mb-5 text-sm text-on-surface-variant">
              Each link opens in a new tab. Bookmark the circuits your team is
              actively iterating on.
            </p>

            {team.wokwiLinks.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant">
                No links yet.{" "}
                {canEdit ? "Add one below." : "Members can add Wokwi links here."}
              </p>
            ) : (
              <ul className="space-y-2">
                {team.wokwiLinks.map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-outline-variant/50 bg-surface-container-low px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-bold text-on-surface">
                        {l.label}
                      </div>
                      <a
                        href={l.wokwiProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate text-xs text-primary hover:underline"
                      >
                        {l.wokwiProjectUrl}
                      </a>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={l.wokwiProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full border-2 border-outline-variant px-3 py-1 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                      >
                        Open
                        <span className="material-symbols-outlined text-[12px]">
                          open_in_new
                        </span>
                      </a>
                      {canEdit && (
                        <form action={removeTeamWokwiLink}>
                          <input type="hidden" name="id" value={l.id} />
                          <input
                            type="hidden"
                            name="teamId"
                            value={team.id}
                          />
                          <button
                            type="submit"
                            aria-label="Remove link"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-outline-variant text-on-surface-variant transition-colors hover:border-destructive hover:text-destructive"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              close
                            </span>
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {canEdit && (
              <form
                action={addTeamWokwiLink}
                className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-12"
              >
                <input type="hidden" name="teamId" value={team.id} />
                <label className="md:col-span-4 space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Label
                  </span>
                  <input
                    type="text"
                    name="label"
                    required
                    minLength={1}
                    maxLength={60}
                    placeholder="Sensor demo"
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
                    required
                    placeholder="https://wokwi.com/projects/..."
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <div className="flex items-end md:col-span-2">
                  <button
                    type="submit"
                    className="sticker-shadow inline-flex w-full items-center justify-center gap-1 rounded-full bg-primary px-4 py-2 font-bold text-on-primary transition-transform active:scale-95"
                  >
                    Add
                    <span className="material-symbols-outlined text-[14px]">
                      add
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * Team chat (group discussion)
       * ────────────────────────────────────────────────────────── */}
      <section className="mt-10 rounded-[28px] border-2 border-outline-variant bg-card p-6 md:p-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">Team chat</h2>
            <p className="text-sm text-on-surface-variant">
              Coordinate, share links, drop ideas. Only your teammates can
              see this.
            </p>
          </div>
          <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            {team.messages.length} message
            {team.messages.length === 1 ? "" : "s"}
          </span>
        </div>

        {team.messages.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
            No messages yet. {canEdit ? "Start the conversation below." : ""}
          </p>
        ) : (
          <ol className="space-y-3">
            {team.messages.map((msg) => {
              const author =
                msg.author.name ?? msg.author.email.split("@")[0];
              const isAuthor = msg.authorId === user.id;
              const isMod =
                user.role === "admin" || user.role === "instructor";
              const canDelete = isAuthor || isMod;
              return (
                <li
                  key={msg.id}
                  className={`rounded-2xl border-2 p-4 ${
                    isAuthor
                      ? "border-secondary/40 bg-secondary-container/30"
                      : "border-outline-variant bg-surface-container-lowest"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container text-[10px] font-bold text-on-secondary-container">
                        {author.charAt(0).toUpperCase()}
                      </span>
                      {msg.author.handle ? (
                        <Link
                          href={`/builders/${msg.author.handle}`}
                          className="font-bold text-on-surface hover:text-primary"
                        >
                          {author}
                        </Link>
                      ) : (
                        <span className="font-bold text-on-surface">
                          {author}
                        </span>
                      )}
                      {isAuthor && (
                        <span className="rounded-full bg-secondary-container px-1.5 py-0 text-[9px] font-bold uppercase tracking-wider text-on-secondary-container">
                          you
                        </span>
                      )}
                    </div>
                    <span className="text-on-surface-variant">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-on-surface">
                    {msg.body}
                  </p>
                  {canDelete && (
                    <form action={deleteTeamMessage} className="mt-2">
                      <input type="hidden" name="id" value={msg.id} />
                      <button
                        type="submit"
                        className="text-[10px] font-bold text-on-surface-variant hover:text-destructive"
                      >
                        Delete
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {canEdit && (
          <form
            action={postTeamMessage}
            className="mt-5 space-y-2 border-t border-outline-variant pt-4"
          >
            <input type="hidden" name="teamId" value={team.id} />
            <label className="block space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Say something to your team
              </span>
              <textarea
                name="body"
                required
                rows={3}
                maxLength={2000}
                placeholder="Found a sample circuit on Wokwi — link below…"
                className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <button
              type="submit"
              className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">
                send
              </span>
              Send
            </button>
          </form>
        )}
      </section>
    </main>
  );
}

function SubmissionBanner({
  teamId,
  canEdit,
  deadlinePassed,
  submitBy,
  submission,
}: {
  teamId: string;
  canEdit: boolean;
  deadlinePassed: boolean;
  submitBy: Date | null;
  submission:
    | {
        id: string;
        title: string;
        submittedAt: Date;
        locked: boolean;
      }
    | null;
}) {
  if (submission) {
    return (
      <section className="mb-8 rounded-[24px] border-2 border-secondary bg-secondary-container p-5 text-on-secondary-container">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-[28px]">
              {submission.locked ? "verified" : "lock_open"}
            </span>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider opacity-80">
                {submission.locked ? "Submitted" : "Unlocked for edits"}
              </div>
              <div className="text-base font-bold">{submission.title}</div>
              <div className="text-xs opacity-80">
                Submitted{" "}
                {new Date(submission.submittedAt).toLocaleString()}
              </div>
            </div>
          </div>
          {canEdit && !submission.locked && !deadlinePassed && (
            <Link
              href={`/hackathon/teams/${teamId}/submit`}
              className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
            >
              Edit submission
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </Link>
          )}
        </div>
      </section>
    );
  }

  if (deadlinePassed) {
    return (
      <section className="mb-8 rounded-[24px] border-2 border-outline-variant bg-card p-5">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <span className="material-symbols-outlined">schedule</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider">
              Submission window closed
            </div>
            <div className="text-sm">
              Deadline was {submitBy ? submitBy.toLocaleString() : "set"}. No
              new submissions accepted.
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-[24px] border-2 border-primary bg-primary-fixed p-5 text-on-primary-fixed-variant">
      <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-[28px]">
            outbox
          </span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-80">
              Not submitted yet
            </div>
            <div className="text-sm">
              {submitBy
                ? `Deadline: ${submitBy.toLocaleString()}`
                : "No deadline set. Submit whenever you're ready."}
            </div>
          </div>
        </div>
        {canEdit && (
          <Link
            href={`/hackathon/teams/${teamId}/submit`}
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
          >
            Submit project
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
          </Link>
        )}
      </div>
    </section>
  );
}

function ReadOnlyWorkspace({
  team,
}: {
  team: {
    projectTitle: string | null;
    projectDescription: string | null;
    repoUrl: string | null;
    buildLog: string | null;
  };
}) {
  const empty = (s: string | null) => (s && s.trim() ? s : "—");
  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Project title
        </dt>
        <dd className="text-on-surface">{empty(team.projectTitle)}</dd>
      </div>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Description
        </dt>
        <dd className="text-on-surface">{empty(team.projectDescription)}</dd>
      </div>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Repo
        </dt>
        <dd className="text-on-surface">
          {team.repoUrl ? (
            <a
              href={team.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {team.repoUrl}
            </a>
          ) : (
            "—"
          )}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Build log
        </dt>
        <dd className="whitespace-pre-wrap rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 font-mono text-xs text-on-surface">
          {empty(team.buildLog)}
        </dd>
      </div>
    </dl>
  );
}
