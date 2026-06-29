import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { db, user, progress, wallPost } from "@/lib/db";
import { MessageButton } from "@/components/ui/message-button";

export const metadata = { title: "Builder · Karya Sanga" };

const TONE_BG: Record<string, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed-variant",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-fixed text-on-tertiary-fixed",
};

/**
 * Builder profile.
 *
 * Layout (locked 2026-06-27):
 *   1. Hero — avatar, name, handle, role pills, workshop, bio, "Building now"
 *   2. Stats strip — badges count, lessons done, wall posts, build log entries
 *   3. Two-column body:
 *      Left  — Badges (grouped: Workshop / Platform)
 *             Recent wall activity (last 5 approved posts)
 *      Right — Project (team membership + build log count)
 *             Workshop (link to /cohorts/<id>)
 *             Visibility info (self + admin only)
 */
export default async function BuilderPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  // Public when profilePublic=true (anyone, even signed-out visitors).
  // Otherwise alumni-only (signed-in users see; signed-out hits notFound).
  const me = await getCurrentUser();
  const { handle } = await params;

  const builderRaw = await db.query.user.findFirst({
    where: eq(user.handle, handle),
    with: {
      cohort: { columns: { id: true, name: true } },
      earnedBadges_userId: {
        with: { badge: true },
        orderBy: (eb, { desc }) => [desc(eb.earnedAt)],
      },
      teamMembers: {
        with: {
          team: {
            columns: {
              id: true,
              name: true,
              projectTitle: true,
              projectDescription: true,
              status: true,
              featured: true,
              tags: true,
            },
            with: {
              buildLogEntries: { columns: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!builderRaw) notFound();

  // Map Drizzle relation names back to the keys the JSX expects.
  // teamMembers is a many-relation in Drizzle but one-to-one in practice
  // (unique userId), so collapse to the single membership (or null), and
  // rebuild team._count.buildLogEntries from the fetched rows.
  const membershipRaw = builderRaw.teamMembers[0] ?? null;
  const builder = {
    ...builderRaw,
    earnedBadges: builderRaw.earnedBadges_userId,
    teamMembership: membershipRaw
      ? {
          ...membershipRaw,
          team: {
            ...membershipRaw.team,
            tags: membershipRaw.team.tags ?? [],
            _count: { buildLogEntries: membershipRaw.team.buildLogEntries.length },
          },
        }
      : null,
  };

  const isSelf = !!me && builder.id === me.id;
  const isMod = !!me && (me.role === "admin" || me.role === "instructor");

  // Visibility gate:
  //   - profilePublic=true: anyone can see (signed in or out)
  //   - profilePublic=false: only signed-in users (alumni-only)
  // Self + mods always see their own / any profile.
  if (!builder.profilePublic && !me) notFound();

  // Extra activity stats — parallel queries
  const [lessonsDone, wallPostsCount, recentWallPostsRaw] = await Promise.all([
    db.$count(
      progress,
      and(eq(progress.userId, builder.id), eq(progress.completed, true)),
    ),
    db.$count(
      wallPost,
      and(eq(wallPost.authorId, builder.id), eq(wallPost.approved, true)),
    ),
    db.query.wallPost.findMany({
      where: and(
        eq(wallPost.authorId, builder.id),
        eq(wallPost.approved, true),
      ),
      orderBy: [desc(wallPost.createdAt)],
      limit: 5,
      columns: {
        id: true,
        kind: true,
        title: true,
        caption: true,
        body: true,
        createdAt: true,
        tags: true,
      },
    }),
  ]);

  // tags is a nullable array column in the schema; the JSX reads .tags.length.
  const recentWallPosts = recentWallPostsRaw.map((p) => ({
    ...p,
    tags: p.tags ?? [],
  }));

  const workshopBadges = builder.earnedBadges.filter(
    (b) => b.badge.category === "workshop",
  );
  const platformBadges = builder.earnedBadges.filter(
    (b) => b.badge.category === "platform",
  );
  const displayName = builder.name ?? builder.email.split("@")[0];
  const buildLogCount = builder.teamMembership?.team._count.buildLogEntries ?? 0;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/builders"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        All people
      </Link>

      {/* ──────────────────────────────────────────────────────────
       * Hero
       * ────────────────────────────────────────────────────────── */}
      <header className="sticker-shadow mb-6 rounded-[32px] border-2 border-outline-variant bg-card p-6 md:p-8">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-secondary-container text-2xl font-bold text-on-secondary-container">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-headline-md text-on-surface">
                {displayName}
              </h1>
              {builder.handle && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-xs font-bold text-on-surface-variant">
                  @{builder.handle}
                </span>
              )}
              {isSelf && (
                <span className="rounded-full bg-secondary-container px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-on-secondary-container">
                  you
                </span>
              )}
              {builder.role === "admin" && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
                  Admin
                </span>
              )}
              {builder.role === "instructor" && (
                <span className="rounded-full bg-primary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-container">
                  Instructor
                </span>
              )}
              {builder.mentorAvailable && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                  <span className="material-symbols-outlined text-[12px]">
                    handshake
                  </span>
                  Mentor
                </span>
              )}
              {builder.profilePublic && (
                <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                  Public
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-on-surface-variant">
              {builder.cohort?.name ?? "Not in a workshop"}
              {builder.ageBand ? ` · ${builder.ageBand}` : ""}
            </div>
            {builder.bio && (
              <p className="mt-3 max-w-xl text-on-surface-variant">
                {builder.bio}
              </p>
            )}
            {builder.buildingNow && (
              <p className="mt-2 text-sm">
                <span className="font-bold text-primary">Building now:</span>{" "}
                <span className="text-on-surface">{builder.buildingNow}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSelf ? (
              <Link
                href="/settings/profile"
                className="press-soft sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
              >
                <span className="material-symbols-outlined text-[16px]">
                  edit
                </span>
                Edit profile
              </Link>
            ) : (
              me && (
                <MessageButton
                  toUserId={builder.id}
                  currentUserId={me.id}
                  size="pill"
                />
              )
            )}
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────
       * Stats strip
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile
          icon="workspace_premium"
          n={builder.earnedBadges.length}
          label={`badge${builder.earnedBadges.length === 1 ? "" : "s"}`}
        />
        <StatTile
          icon="menu_book"
          n={lessonsDone}
          label={`lesson${lessonsDone === 1 ? "" : "s"} done`}
        />
        <StatTile
          icon="photo_library"
          n={wallPostsCount}
          label={`wall post${wallPostsCount === 1 ? "" : "s"}`}
        />
        <StatTile
          icon="construction"
          n={buildLogCount}
          label={`build log${buildLogCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ──────────────────────────────────────────────────────
         * Left column — Badges + Wall activity
         * ────────────────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-7">
          <section className="rounded-3xl border-2 border-outline-variant bg-card p-6">
            <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-primary">
              Badges
            </h2>
            {builder.earnedBadges.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-5 text-sm text-on-surface-variant">
                No badges yet.
              </p>
            ) : (
              <>
                {workshopBadges.length > 0 && (
                  <>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Workshop
                    </h3>
                    <ul className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
                      {workshopBadges.map((eb) => (
                        <BadgeChip key={eb.id} eb={eb} />
                      ))}
                    </ul>
                  </>
                )}
                {platformBadges.length > 0 && (
                  <>
                    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                      Platform
                    </h3>
                    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                      {platformBadges.map((eb) => (
                        <BadgeChip key={eb.id} eb={eb} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </section>

          {/* Recent wall activity */}
          {recentWallPosts.length > 0 && (
            <section className="rounded-3xl border-2 border-outline-variant bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-primary">
                  Recent activity
                </h2>
                <Link
                  href={`/wall?author=${builder.id}`}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  Open wall →
                </Link>
              </div>
              <ul className="space-y-3">
                {recentWallPosts.map((p) => {
                  const KIND_META = {
                    photo: { label: "Photo", icon: "photo_camera" },
                    update: { label: "Update", icon: "chat" },
                    blog: { label: "Blog", icon: "edit_note" },
                  } as const;
                  const meta = KIND_META[p.kind];
                  const preview =
                    p.title ??
                    p.body?.slice(0, 140) ??
                    p.caption?.slice(0, 140) ??
                    "(no caption)";
                  return (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-3"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tertiary-fixed text-on-tertiary-fixed">
                        <span className="material-symbols-outlined text-[16px]">
                          {meta.icon}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                          <span>{meta.label}</span>
                          <span>·</span>
                          <span>{timeAgo(p.createdAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-sm text-on-surface">
                          {preview}
                        </p>
                        {p.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {p.tags.slice(0, 3).map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-tertiary-fixed px-1.5 py-0 text-[10px] font-bold text-on-tertiary-fixed"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {/* ──────────────────────────────────────────────────────
         * Right column — Project + Workshop + Visibility
         * ────────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:col-span-5">
          {/* Project */}
          <div className="rounded-3xl border-2 border-outline-variant bg-card p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Project
            </h2>
            {builder.teamMembership ? (
              <Link
                href={`/gallery/${builder.teamMembership.team.id}`}
                className="group block rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-4 transition-colors hover:border-primary"
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                  <span
                    className={`rounded-full px-1.5 py-0 ${
                      builder.teamMembership.team.status === "shipped"
                        ? "bg-primary-fixed text-on-primary-fixed-variant"
                        : "bg-secondary-container text-on-secondary-container"
                    }`}
                  >
                    {builder.teamMembership.team.status}
                  </span>
                  {builder.teamMembership.team.featured && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-fixed px-1.5 py-0 text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[10px]">
                        star
                      </span>
                      Featured
                    </span>
                  )}
                  {builder.teamMembership.isCaptain && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-fixed px-1.5 py-0 text-on-tertiary-fixed">
                      <span className="material-symbols-outlined text-[10px]">
                        star
                      </span>
                      Captain
                    </span>
                  )}
                </div>
                <div className="text-sm font-bold text-on-surface group-hover:text-primary">
                  {builder.teamMembership.team.projectTitle ??
                    builder.teamMembership.team.name}
                </div>
                {builder.teamMembership.team.projectDescription && (
                  <p className="mt-1 line-clamp-2 text-xs text-on-surface-variant">
                    {builder.teamMembership.team.projectDescription}
                  </p>
                )}
                {builder.teamMembership.team.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {builder.teamMembership.team.tags
                      .slice(0, 4)
                      .map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed"
                        >
                          #{t}
                        </span>
                      ))}
                  </div>
                )}
              </Link>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Not currently on a team.
              </p>
            )}
          </div>

          {/* Workshop */}
          {builder.cohort && (
            <div className="rounded-3xl border-2 border-outline-variant bg-card p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Workshop
              </h2>
              <Link
                href={`/cohorts/${builder.cohort.id}`}
                className="group flex items-center gap-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-primary"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">
                    home_storage
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-on-surface group-hover:text-primary">
                    {builder.cohort.name}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    Open workshop →
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Visibility — self or mods */}
          {(isMod || isSelf) && (
            <div className="rounded-3xl border-2 border-dashed border-outline-variant bg-card p-5 text-sm text-on-surface-variant">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider">
                Who can see this
              </h3>
              <p>
                This profile is{" "}
                <span className="font-bold text-on-surface">
                  {builder.profilePublic
                    ? "open to anyone"
                    : "only for other people in the workshop"}
                </span>
                .
              </p>
              {isSelf && (
                <Link
                  href="/settings/profile"
                  className="mt-2 inline-flex items-center gap-1 font-bold text-primary hover:underline"
                >
                  Edit in settings →
                </Link>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function BadgeChip({
  eb,
}: {
  eb: {
    id: string;
    earnedAt: Date;
    note: string | null;
    badge: {
      slug: string;
      name: string;
      icon: string;
      tone: string;
      description: string;
    };
  };
}) {
  return (
    <li
      className={`rounded-2xl border-2 border-white p-3 ${TONE_BG[eb.badge.tone] ?? TONE_BG.primary}`}
      title={`${eb.badge.description}\nEarned ${new Date(eb.earnedAt).toLocaleDateString()}`}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px]">
          {eb.badge.icon}
        </span>
        <span className="text-xs font-bold">{eb.badge.name}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] opacity-80">
        {eb.badge.description}
      </p>
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

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
