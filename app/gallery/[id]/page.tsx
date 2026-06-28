import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LessonBody } from "@/components/lessons/lesson-body";
import { MediaEmbed } from "@/components/gallery/media-embed";
import { ShareButton } from "@/components/gallery/share-button";
import {
  addBuildLogEntry,
  removeBuildLogEntry,
} from "@/lib/actions/alumni";
import {
  addProjectMedia,
  deleteProjectComment,
  postProjectComment,
  removeProjectMedia,
  toggleProjectReaction,
} from "@/lib/actions/gallery";

export const metadata = { title: "Project · Yukti AI Labs" };

const STATUS_TONE: Record<string, string> = {
  active: "bg-secondary-container text-on-secondary-container",
  shipped: "bg-primary-fixed text-on-primary-fixed-variant",
  archived: "bg-surface-container text-on-surface-variant",
};

/**
 * Project detail (locked 2026-06-27).
 *
 * Layout:
 *   1. Sticker hero — title, pills (workshop, status, featured), description
 *   2. Stats strip — members, build journey entries, links count
 *   3. Two columns:
 *      Right (col 4) — Team list, Workshop link, Links (repo / demo / Wokwi)
 *      Left  (col 8) — The story · Architecture · Build journey (composer
 *                       for team members + mods)
 *
 * Future schema (not in this revamp): reactions + comments on projects,
 * media embeds (YouTube, audio). Tracking on the Open items list.
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;

  const project = await prisma.team.findUnique({
    where: { id },
    include: {
      cohort: { select: { id: true, name: true } },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              handle: true,
            },
          },
        },
      },
      wokwiLinks: { orderBy: { createdAt: "desc" } },
      buildLogEntries: {
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      submission: true,
      reactions: { select: { type: true, userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: { id: true, name: true, email: true, handle: true },
          },
        },
      },
    },
  });
  if (!project) notFound();

  // Reactions: counts + which ones I have
  const reactionCounts: Record<"clap" | "love" | "idea", number> = {
    clap: 0,
    love: 0,
    idea: 0,
  };
  const reactionMine: Record<"clap" | "love" | "idea", boolean> = {
    clap: false,
    love: false,
    idea: false,
  };
  for (const r of project.reactions) {
    const k = r.type as "clap" | "love" | "idea";
    reactionCounts[k] += 1;
    if (r.userId === me.id) reactionMine[k] = true;
  }
  const REACTION_META = [
    { type: "clap" as const, icon: "👏", label: "Clap" },
    { type: "love" as const, icon: "❤️", label: "Love" },
    { type: "idea" as const, icon: "💡", label: "Idea" },
  ];

  const isMember = project.members.some((m) => m.userId === me.id);
  const isMod = me.role === "admin" || me.role === "instructor";
  const canEdit = isMember || isMod;

  const projectTitle = project.projectTitle ?? project.name;
  const linkCount =
    (project.repoUrl ? 1 : 0) +
    (project.submission?.demoVideoUrl ? 1 : 0) +
    project.wokwiLinks.length;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/gallery"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        All projects
      </Link>

      {/* ──────────────────────────────────────────────────────────
       * Hero
       * ────────────────────────────────────────────────────────── */}
      <header className="sticker-shadow mb-6 rounded-[32px] border-2 border-outline-variant bg-card p-6 md:p-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-tertiary-fixed shadow-sm">
            <span className="material-symbols-outlined text-[14px]">
              rocket_launch
            </span>
            Project
          </div>
          {project.cohort?.name && (
            <Link
              href={`/cohorts/${project.cohort.id}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-secondary-container hover:bg-secondary hover:text-on-secondary"
            >
              <span className="material-symbols-outlined text-[14px]">
                home_storage
              </span>
              {project.cohort.name}
            </Link>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${STATUS_TONE[project.status]}`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {project.status === "shipped"
                ? "check_circle"
                : project.status === "active"
                  ? "build_circle"
                  : "archive"}
            </span>
            {project.status === "active"
              ? "In progress"
              : project.status === "shipped"
                ? "Done"
                : project.status}
          </span>
          {project.featured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-primary-fixed-variant">
              <span className="material-symbols-outlined text-[14px]">
                star
              </span>
              Featured
            </span>
          )}
        </div>
        <h1 className="text-headline-lg leading-tight text-on-surface">
          {projectTitle}
        </h1>
        {project.projectDescription && (
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            {project.projectDescription}
          </p>
        )}
        {project.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <Link
                key={t}
                href={`/gallery?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-tertiary-fixed px-2.5 py-1 text-[11px] font-bold text-on-tertiary-fixed hover:bg-tertiary hover:text-on-tertiary"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
        <div className="mt-4">
          <ShareButton title={projectTitle} />
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────
       * Stats strip
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon="groups"
          n={project.members.length}
          label={`member${project.members.length === 1 ? "" : "s"}`}
        />
        <StatTile
          icon="construction"
          n={project.buildLogEntries.length}
          label={`build log${project.buildLogEntries.length === 1 ? "" : "s"}`}
        />
        <StatTile
          icon="celebration"
          n={project.reactions.length}
          label={`reaction${project.reactions.length === 1 ? "" : "s"}`}
        />
        <StatTile
          icon="forum"
          n={project.comments.length}
          label={`comment${project.comments.length === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ────────────────────────────────────────────────────
         * RIGHT column (Team + Workshop + Links)
         * ──────────────────────────────────────────────────── */}
        <aside className="order-2 space-y-4 lg:order-2 lg:col-span-4">
          {/* Team */}
          <div className="rounded-3xl border-2 border-outline-variant bg-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Team
            </h2>
            <ul className="space-y-2">
              {project.members.map((m) => {
                const name =
                  m.user.name ?? m.user.email.split("@")[0];
                const initial = name.charAt(0).toUpperCase();
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container">
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {m.user.handle ? (
                          <Link
                            href={`/builders/${m.user.handle}`}
                            className="truncate font-bold text-on-surface hover:text-primary"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="truncate font-bold text-on-surface">
                            {name}
                          </span>
                        )}
                        {m.isCaptain && (
                          <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                            Captain
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Workshop card */}
          {project.cohort && (
            <div className="rounded-3xl border-2 border-outline-variant bg-card p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Workshop
              </h2>
              <Link
                href={`/cohorts/${project.cohort.id}`}
                className="group flex items-center gap-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-primary"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">
                    home_storage
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-on-surface group-hover:text-primary">
                    {project.cohort.name}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    Open workshop →
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Links */}
          {linkCount > 0 && (
            <div className="rounded-3xl border-2 border-outline-variant bg-card p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Stuff to open
              </h2>
              <ul className="space-y-2 text-sm">
                {project.repoUrl && (
                  <LinkRow
                    icon="code"
                    label="Source code"
                    href={project.repoUrl}
                  />
                )}
                {project.submission?.demoVideoUrl && (
                  <LinkRow
                    icon="play_circle"
                    label="Demo video"
                    href={project.submission.demoVideoUrl}
                  />
                )}
                {project.wokwiLinks.map((l) => (
                  <LinkRow
                    key={l.id}
                    icon="memory"
                    label={l.label}
                    href={l.wokwiProjectUrl}
                  />
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* ────────────────────────────────────────────────────
         * LEFT column (Media + Story + Architecture + Build journey + Comments)
         * ──────────────────────────────────────────────────── */}
        <section className="order-1 space-y-6 lg:order-1 lg:col-span-8">
          {/* Media — embeds (only show if there's something to embed) */}
          {(project.mediaUrls.length > 0 ||
            project.submission?.demoVideoUrl) && (
            <article className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">
                Watch &amp; listen
              </h2>
              <div className="space-y-4">
                {project.submission?.demoVideoUrl && (
                  <MediaEmbed url={project.submission.demoVideoUrl} />
                )}
                {project.mediaUrls.map((url) => (
                  <div key={url} className="relative">
                    <MediaEmbed url={url} />
                    {canEdit && (
                      <form
                        action={removeProjectMedia}
                        className="mt-2 flex items-center justify-end"
                      >
                        <input
                          type="hidden"
                          name="teamId"
                          value={project.id}
                        />
                        <input type="hidden" name="url" value={url} />
                        <button
                          type="submit"
                          className="text-[10px] font-bold text-on-surface-variant hover:text-destructive"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
              {canEdit && (
                <form
                  action={addProjectMedia}
                  className="mt-5 flex flex-col gap-2 border-t border-outline-variant pt-4 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="teamId" value={project.id} />
                  <input
                    type="url"
                    name="url"
                    required
                    placeholder="Paste a YouTube, Vimeo, SoundCloud, or direct media URL"
                    className="flex-1 rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    className="sticker-shadow inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add media
                  </button>
                </form>
              )}
            </article>
          )}
          {/* Composer-only: if no media yet AND can edit, show the form alone */}
          {project.mediaUrls.length === 0 &&
            !project.submission?.demoVideoUrl &&
            canEdit && (
              <article className="rounded-3xl border-2 border-dashed border-outline-variant bg-card p-6">
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-primary">
                  Watch &amp; listen
                </h2>
                <p className="mb-3 text-sm text-on-surface-variant">
                  Add a YouTube / Vimeo demo, a SoundCloud track, or any direct
                  audio/video URL. Embeds show up here.
                </p>
                <form
                  action={addProjectMedia}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="teamId" value={project.id} />
                  <input
                    type="url"
                    name="url"
                    required
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="flex-1 rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                  <button
                    type="submit"
                    className="sticker-shadow inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>
                    Add media
                  </button>
                </form>
              </article>
            )}

          {project.story && (
            <article className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
                The story
              </h2>
              <LessonBody markdown={project.story} />
            </article>
          )}
          {project.architecture && (
            <article className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
                How it works
              </h2>
              <LessonBody markdown={project.architecture} />
            </article>
          )}

          {/* Build journey */}
          <section className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                Build journey
              </h2>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {project.buildLogEntries.length}{" "}
                entr{project.buildLogEntries.length === 1 ? "y" : "ies"}
              </span>
            </div>

            {project.buildLogEntries.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
                Nothing here yet.{" "}
                {canEdit
                  ? "Add the first update below."
                  : "Check back as the team keeps building."}
              </p>
            ) : (
              <ol className="space-y-4">
                {project.buildLogEntries.map((entry) => {
                  const name =
                    entry.author.name ??
                    entry.author.email.split("@")[0];
                  const canDelete =
                    isMod || entry.authorId === me.id;
                  return (
                    <li
                      key={entry.id}
                      className="rounded-2xl border-2 border-outline-variant/50 bg-surface-container-lowest p-5"
                    >
                      <div className="mb-2 flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface">
                          {name}
                        </span>
                        <span className="text-on-surface-variant">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-on-surface">
                        {entry.body}
                      </p>
                      {entry.wokwiUrl && (
                        <a
                          href={entry.wokwiUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            memory
                          </span>
                          Open in Wokwi
                        </a>
                      )}
                      {canDelete && (
                        <form
                          action={removeBuildLogEntry}
                          className="mt-2"
                        >
                          <input type="hidden" name="id" value={entry.id} />
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
                action={addBuildLogEntry}
                className="mt-6 space-y-3 border-t border-outline-variant pt-5"
              >
                <input type="hidden" name="teamId" value={project.id} />
                <label className="block space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    What changed?
                  </span>
                  <textarea
                    name="body"
                    required
                    rows={3}
                    maxLength={4000}
                    placeholder="Added a buzzer · tuned the threshold from 1240 to 1100 · …"
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Wokwi URL (optional)
                  </span>
                  <input
                    type="url"
                    name="wokwiUrl"
                    placeholder="https://wokwi.com/projects/..."
                    className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
                  />
                </label>
                <button
                  type="submit"
                  className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    add
                  </span>
                  Post update
                </button>
              </form>
            )}
          </section>

          {/* Reactions */}
          <section className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-primary">
              How does this make you feel?
            </h2>
            <div className="flex flex-wrap gap-2">
              {REACTION_META.map((r) => {
                const count = reactionCounts[r.type];
                const active = reactionMine[r.type];
                return (
                  <form
                    key={r.type}
                    action={toggleProjectReaction}
                    className="contents"
                  >
                    <input type="hidden" name="teamId" value={project.id} />
                    <input type="hidden" name="type" value={r.type} />
                    <button
                      type="submit"
                      className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-sm font-bold transition-all ${
                        active
                          ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
                          : "border-outline-variant bg-card text-on-surface-variant hover:border-primary hover:-translate-y-0.5"
                      }`}
                    >
                      <span className="text-base">{r.icon}</span>
                      {r.label}
                      {count > 0 && (
                        <span
                          className={`rounded-full px-1.5 text-[10px] ${
                            active
                              ? "bg-on-primary-fixed-variant text-primary-fixed"
                              : "bg-surface-container text-on-surface-variant"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  </form>
                );
              })}
            </div>
          </section>

          {/* Comments */}
          <section className="rounded-3xl border-2 border-outline-variant bg-card p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                Comments
              </h2>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                {project.comments.length}
              </span>
            </div>

            {project.comments.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant p-5 text-sm text-on-surface-variant">
                No comments yet. Say what you think below.
              </p>
            ) : (
              <ol className="space-y-3">
                {project.comments.map((c) => {
                  const author =
                    c.author.name ?? c.author.email.split("@")[0];
                  const isAuthor = c.authorId === me.id;
                  const canDelete = isMod || isAuthor;
                  return (
                    <li
                      key={c.id}
                      className={`rounded-2xl border-2 p-4 ${
                        isAuthor
                          ? "border-secondary/40 bg-secondary-container/30"
                          : "border-outline-variant bg-surface-container-lowest"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary-container text-[10px] font-bold text-on-secondary-container">
                            {author.charAt(0).toUpperCase()}
                          </span>
                          {c.author.handle ? (
                            <Link
                              href={`/builders/${c.author.handle}`}
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
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-on-surface">
                        {c.body}
                      </p>
                      {canDelete && (
                        <form action={deleteProjectComment} className="mt-2">
                          <input type="hidden" name="id" value={c.id} />
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

            {/* Composer — anyone can post */}
            <form
              action={postProjectComment}
              className="mt-5 space-y-2 border-t border-outline-variant pt-4"
            >
              <input type="hidden" name="teamId" value={project.id} />
              <label className="block space-y-1">
                <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Add a comment
                </span>
                <textarea
                  name="body"
                  required
                  rows={3}
                  maxLength={2000}
                  placeholder="Nice work! How did you handle the buzzer noise?"
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
                Post comment
              </button>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function LinkRow({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-2 rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 transition-colors hover:border-primary"
      >
        <span className="material-symbols-outlined text-[16px] text-primary">
          {icon}
        </span>
        <span className="font-bold text-on-surface group-hover:text-primary">
          {label}
        </span>
        <span className="material-symbols-outlined ml-auto text-[14px] text-on-surface-variant">
          open_in_new
        </span>
      </a>
    </li>
  );
}

function StatTile({
  icon,
  n,
  label,
}: {
  icon: string;
  n: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-outline-variant bg-card p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-lg font-black leading-none text-on-surface">
          {n}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {label}
        </div>
      </div>
    </div>
  );
}
