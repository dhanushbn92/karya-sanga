import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedWallImageUrls } from "@/lib/supabase/admin";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Home · Karya Sanga" };

/**
 * Logged-in Home.
 *
 * Cut list (locked 2026-06-26): progress chip, "your learning" card,
 * "saved Wokwi" card, badges card, and the "Quick wins" tile strip were
 * all removed because they either duplicated other surfaces or belonged
 * on the workshop view (where lessons actually live).
 *
 * What remains here is *cross-cutting*:
 *   1. Hi + cohort + role (compact greeting)
 *   2. "Your workshops" — workshop card(s) with team baked in.
 *      This IS the "what's next" — open a workshop to see lessons,
 *      progress, team workspace, cohort feed (locked 2026-06-26).
 *   3. "From the community" — cohort feed + wall thumbnails
 *   4. "Explore" — every other surface, one click
 *   5. Teacher tools (admin/instructor only)
 */
export default async function HomePage() {
  const user = await requireUser();
  const isMod = user.role === "admin" || user.role === "instructor";

  const [
    userDetail,
    teamMembership,
    cohortPosts,
    recentWallPosts,
    pendingWallCount,
    pendingSubmissionsCount,
    cohortMemberCount,
    lessonsDone,
    badgesEarned,
    nextLesson,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: {
        cohort: { select: { id: true, name: true, description: true } },
      },
    }),
    prisma.teamMember.findUnique({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true, email: true } },
              },
              orderBy: { joinedAt: "asc" },
            },
            submission: { select: { id: true, locked: true } },
            cohort: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.cohortPost.findMany({
      where: { cohort: { members: { some: { id: user.id } } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 4,
      include: {
        author: { select: { name: true, email: true, handle: true } },
        cohort: { select: { id: true, name: true } },
      },
    }),
    prisma.wallPost.findMany({
      where: { approved: true },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { author: { select: { name: true, email: true } } },
    }),
    isMod
      ? prisma.wallPost.count({ where: { approved: false, rejected: false } })
      : Promise.resolve(0),
    isMod
      ? prisma.submission.count({
          where: { scores: { none: { judgeId: user.id } } },
        })
      : Promise.resolve(0),
    prisma.user.count({
      where: { cohort: { members: { some: { id: user.id } } } },
    }),
    prisma.progress.count({
      where: { userId: user.id, completed: true },
    }),
    prisma.earnedBadge.count({
      where: { userId: user.id },
    }),
    // First unfinished lesson — across every chapter this user can see.
    prisma.lesson
      .findFirst({
        where: {
          published: true,
          module: { published: true },
          progress: {
            none: { userId: user.id, completed: true },
          },
        },
        orderBy: [{ module: { order: "asc" } }, { order: "asc" }],
        select: {
          id: true,
          title: true,
          module: { select: { title: true } },
        },
      })
      .catch(() => null),
  ]);

  const wallUrls = await signedWallImageUrls(
    recentWallPosts
      .map((p) => p.imagePath)
      .filter((p): p is string => !!p),
    60 * 30,
  );

  const cohortName = userDetail?.cohort?.name ?? null;
  const cohortId = userDetail?.cohort?.id ?? null;
  const cohortDesc = userDetail?.cohort?.description ?? null;
  const displayName = user.name ?? user.email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  // Workshops list — currently 1 from cohortId, but designed for plural.
  const workshops = cohortId
    ? [
        {
          id: cohortId,
          name: cohortName!,
          description: cohortDesc,
          memberCount: cohortMemberCount,
          team: teamMembership?.team ?? null,
        },
      ]
    : [];

  return (
    <>
      {/* ============================================================
       * 1. CHARACTER-LED HERO — greeting + speech bubble + big quest
       * ============================================================ */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-6 h-80 w-80 rounded-full bg-secondary-container/40 blur-3xl" />
          <div className="absolute -right-24 top-6 h-80 w-80 rounded-full bg-primary-fixed/50 blur-3xl" />
          <div className="absolute left-1/2 bottom-0 h-72 w-72 -translate-x-1/2 rounded-full bg-tertiary-fixed/40 blur-3xl" />
        </div>

        <div className="relative mx-auto w-full max-w-[1280px] px-4 pt-8 pb-6 md:px-12 md:pt-12">
          {/* Top row — workshop pill + admin shortcut */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
              {cohortName && cohortId && (
                <Link
                  href={`/cohorts/${cohortId}`}
                  className="press-soft inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-primary shadow-sm hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    home_storage
                  </span>
                  {cohortName}
                </Link>
              )}
              <span className="rounded-full bg-primary-fixed/80 px-3 py-1 text-on-primary-fixed-variant">
                {user.role}
              </span>
            </div>
            {isMod && (
              <Link
                href="/admin"
                className="press-soft sticker-shadow inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-bold text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">
                  shield_person
                </span>
                Teacher tools
              </Link>
            )}
          </div>

          {/* Mascot + greeting */}
          <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
            <div className="flex items-start gap-4 md:col-span-7">
              <Mascot pose="wave" size={130} className="shrink-0" />
              <div className="pt-4">
                <SpeechBubble
                  direction="left"
                  tone="primary"
                  className="max-w-md"
                >
                  Hey {displayName}!{" "}
                  {nextLesson
                    ? "Ready for today's mission?"
                    : lessonsDone > 0
                      ? "You crushed every lesson — let's keep building."
                      : "Let's make something amazing today."}
                </SpeechBubble>
                <h1 className="text-display-md mt-4 text-on-surface">
                  Welcome back,{" "}
                  <span className="text-primary">{displayName}</span>.
                </h1>
              </div>
            </div>

            {/* Stat tiles — gamified */}
            <div className="md:col-span-5">
              <div className="grid grid-cols-3 gap-3">
                <StatCard
                  icon="local_fire_department"
                  n={lessonsDone}
                  label="Lessons"
                  tone="saffron"
                  caption={lessonsDone === 0 ? "Start one!" : "Done"}
                />
                <StatCard
                  icon="workspace_premium"
                  n={badgesEarned}
                  label="Badges"
                  tone="gold"
                  caption={badgesEarned === 0 ? "Earn one!" : "Earned"}
                />
                <StatCard
                  icon="groups"
                  n={cohortMemberCount}
                  label="Friends"
                  tone="teal"
                  caption="In your workshop"
                />
              </div>
            </div>
          </div>

          {/* GIANT next-quest card */}
          <div className="mt-8 mb-2">
            {nextLesson ? (
              <NextQuestCard
                title={nextLesson.title}
                module={nextLesson.module.title}
                href={`/lessons/${nextLesson.id}`}
              />
            ) : teamMembership ? (
              <NextQuestCard
                title={`Open your team workspace — ${teamMembership.team.name}`}
                module="Hackathon"
                href={`/hackathon/teams/${teamMembership.teamId}`}
                cta="OPEN"
                icon="rocket_launch"
              />
            ) : (
              <NextQuestCard
                title="Pick a workshop and jump in"
                module="Get started"
                href="/workshops"
                cta="EXPLORE"
                icon="explore"
              />
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
       * 2. YOUR WORKSHOPS (with team baked in)
       * ============================================================ */}
      <section className="bg-tertiary-fixed/30 py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <div className="mb-6">
            <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-card px-3 py-1 text-xs font-bold text-on-tertiary-fixed shadow-sm">
              <span className="material-symbols-outlined text-[14px]">
                home_storage
              </span>
              Your workshops
            </span>
            <h2 className="text-headline-lg mt-3 text-on-surface">
              {workshops.length === 0
                ? "You're not in a workshop yet."
                : workshops.length === 1
                  ? "Your workshop"
                  : `${workshops.length} workshops`}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
              Lessons, progress, your team, and the class chat all live
              inside a workshop. Open one to see what&apos;s next.
            </p>
          </div>

          {workshops.length === 0 ? (
            <article className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
              <span className="material-symbols-outlined mb-3 text-4xl text-on-surface-variant">
                school
              </span>
              <h3 className="text-base font-bold text-on-surface">
                Ask your teacher to add you to a workshop.
              </h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-on-surface-variant">
                Once you&apos;re in, you&apos;ll see your lessons, the
                class chat, and any team you&apos;re placed on.
              </p>
            </article>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {workshops.map((w) => (
                <WorkshopCard key={w.id} workshop={w} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ============================================================
       * 3. FROM THE COMMUNITY (cohort feed + wall)
       * ============================================================ */}
      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-12 md:py-16">
        <div className="mb-6">
          <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[14px]">
              forum
            </span>
            From everyone
          </span>
          <h2 className="text-headline-lg mt-3 text-on-surface">
            What&apos;s happening this week.
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <CohortFeedCard
            posts={cohortPosts}
            cohortId={cohortId}
            cohortName={cohortName}
          />
          <WallPreviewCard posts={recentWallPosts} urls={wallUrls} />
        </div>
      </section>

      {/* ============================================================
       * 4. EXPLORE
       * ============================================================ */}
      <section className="bg-surface-container-low py-12 md:py-16">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <div className="mb-6">
            <h2 className="text-headline-lg text-on-surface">
              Explore the rest.
            </h2>
            <p className="mt-1 text-on-surface-variant">
              Every part of Karya Sanga, one click away.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ExploreCard
              href="/lessons"
              icon="menu_book"
              tone="primary"
              title="Lessons"
              body="Modules and lessons your instructor publishes per workshop."
            />
            <ExploreCard
              href="/simulator"
              icon="memory"
              tone="secondary"
              title="Maker Lab"
              body="Wokwi launchers, starter projects, and the component reference."
            />
            <ExploreCard
              href="/hackathon"
              icon="rocket_launch"
              tone="tertiary"
              title="Hackathon"
              body="Form a team, build a project, watch the leaderboard."
            />
            <ExploreCard
              href="/gallery"
              icon="gallery_thumbnail"
              tone="primary"
              title="Projects Gallery"
              body="Every team's project. Stories, build logs, demos."
            />
            <ExploreCard
              href="/builders"
              icon="groups"
              tone="secondary"
              title="People"
              body="Everyone in the workshops. Profiles + badges."
            />
            <ExploreCard
              href="/wall"
              icon="photo_library"
              tone="tertiary"
              title="Show & Tell"
              body="Photos, updates, blogs — share what you're making."
            />
          </div>
        </div>
      </section>

      {/* ============================================================
       * 5. OPERATOR TOOLS (admin/instructor only)
       * ============================================================ */}
      {isMod && (
        <section className="bg-primary-fixed/30 py-12 md:py-16">
          <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-card px-3 py-1 text-xs font-bold text-on-primary-fixed-variant shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    shield_person
                  </span>
                  Teacher tools
                </span>
                <h2 className="text-headline-lg mt-3 text-on-surface">
                  Run the workshop.
                </h2>
              </div>
              <Link
                href="/admin"
                className="text-sm font-bold text-primary hover:underline"
              >
                Open /admin →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <OperatorChip
                href="/admin/modules"
                label="Modules"
                icon="menu_book"
              />
              <OperatorChip
                href="/admin/cohorts"
                label="Workshops"
                icon="home_storage"
              />
              <OperatorChip
                href="/admin/badges"
                label="Badges"
                icon="workspace_premium"
              />
              <OperatorChip
                href="/admin/wall"
                label="Wall mod"
                icon="gavel"
                badge={pendingWallCount > 0 ? `${pendingWallCount}` : undefined}
              />
              <OperatorChip
                href="/admin/hackathon"
                label="Hackathon"
                icon="rocket_launch"
                badge={
                  pendingSubmissionsCount > 0
                    ? `${pendingSubmissionsCount}`
                    : undefined
                }
              />
            </div>
          </div>
        </section>
      )}
    </>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────

function WorkshopCard({
  workshop,
}: {
  workshop: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    team: {
      id: string;
      name: string;
      projectTitle: string | null;
      members: { user: { id: string; name: string | null; email: string } }[];
      submission: { id: string; locked: boolean } | null;
    } | null;
  };
}) {
  return (
    <article className="sticker-shadow group rounded-[24px] border-2 border-outline-variant bg-card p-5 transition-transform hover:-translate-y-1">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <span className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
            Workshop
          </span>
          <h3 className="text-headline-md mt-2 text-on-surface">
            {workshop.name}
          </h3>
        </div>
        <Link
          href={`/cohorts/${workshop.id}`}
          className="text-xs font-bold text-primary hover:underline"
        >
          Open →
        </Link>
      </div>
      {workshop.description && (
        <p className="mb-3 line-clamp-2 text-sm text-on-surface-variant">
          {workshop.description}
        </p>
      )}
      <div className="flex items-center gap-3 text-xs font-bold text-on-surface-variant">
        <span className="inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">groups</span>
          {workshop.memberCount} member
          {workshop.memberCount === 1 ? "" : "s"}
        </span>
      </div>

      {workshop.team ? (
        <div className="mt-4 rounded-2xl border-2 border-outline-variant bg-surface-container-low p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Your team
            </span>
            {workshop.team.submission?.locked && (
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold text-on-secondary-container">
                Submitted
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-on-surface">
                {workshop.team.projectTitle ?? workshop.team.name}
              </div>
              <div className="mt-1 flex -space-x-2">
                {workshop.team.members.slice(0, 5).map((m, i) => {
                  const n = m.user.name ?? m.user.email.split("@")[0];
                  return (
                    <div
                      key={i}
                      className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-secondary-container text-[10px] font-bold text-on-secondary-container"
                      title={n}
                    >
                      {n.charAt(0).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
            <Link
              href={`/hackathon/teams/${workshop.team.id}`}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
            >
              Workspace
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low p-4 text-sm">
          <span className="text-on-surface-variant">No team yet — </span>
          <Link
            href="/hackathon"
            className="font-bold text-primary hover:underline"
          >
            find or create one →
          </Link>
        </div>
      )}
    </article>
  );
}

function CohortFeedCard({
  posts,
  cohortId,
  cohortName,
}: {
  posts: {
    id: string;
    body: string;
    createdAt: Date;
    pinned: boolean;
    author: { name: string | null; email: string; handle: string | null };
    cohort: { id: string; name: string };
  }[];
  cohortId: string | null;
  cohortName: string | null;
}) {
  return (
    <article className="rounded-[24px] border-2 border-outline-variant bg-card p-5 lg:col-span-7">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">forum</span>
          <h3 className="text-base font-bold text-on-surface">
            {cohortName ? `${cohortName} · chat` : "Class chat"}
          </h3>
        </div>
        {cohortId && (
          <Link
            href={`/cohorts/${cohortId}`}
            className="text-xs font-bold text-primary hover:underline"
          >
            Open →
          </Link>
        )}
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {cohortId
            ? "No posts yet in your workshop chat."
            : "You aren't in a workshop yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {posts.map((p) => {
            const name = p.author.name ?? p.author.email.split("@")[0];
            return (
              <li
                key={p.id}
                className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-3"
              >
                <div className="mb-1 flex items-center gap-2 text-[11px]">
                  <span className="font-bold text-on-surface">{name}</span>
                  <span className="text-on-surface-variant">
                    · {timeAgo(p.createdAt)}
                  </span>
                  {p.pinned && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      Pinned
                    </span>
                  )}
                </div>
                <p className="line-clamp-3 text-sm text-on-surface">{p.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </article>
  );
}

function WallPreviewCard({
  posts,
  urls,
}: {
  posts: {
    id: string;
    imagePath: string | null;
    caption: string | null;
    author: { name: string | null; email: string };
  }[];
  urls: Map<string, string>;
}) {
  return (
    <article className="rounded-[24px] border-2 border-outline-variant bg-card p-5 lg:col-span-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">
            photo_library
          </span>
          <h3 className="text-base font-bold text-on-surface">
            Show &amp; Tell
          </h3>
        </div>
        <Link
          href="/wall"
          className="text-xs font-bold text-primary hover:underline"
        >
          Open →
        </Link>
      </div>
      {posts.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          The wall is empty.{" "}
          <Link
            href="/wall/new"
            className="font-bold text-primary hover:underline"
          >
            Post the first picture →
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {posts.map((p) => {
            const url = p.imagePath ? urls.get(p.imagePath) : undefined;
            return (
              <Link
                key={p.id}
                href="/wall"
                className="aspect-square overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-low"
                title={p.caption ?? ""}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={p.caption ?? ""}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-surface-container" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}

function ExploreCard({
  href,
  icon,
  tone,
  title,
  body,
}: {
  href: string;
  icon: string;
  tone: "primary" | "secondary" | "tertiary";
  title: string;
  body: string;
}) {
  const bg = {
    primary: "bg-primary-fixed",
    secondary: "bg-secondary-container",
    tertiary: "bg-tertiary-fixed",
  }[tone];
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-[20px] border-2 border-outline-variant bg-card p-4 transition-all hover:-translate-y-1 hover:border-primary"
    >
      <span
        className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${bg}`}
      >
        <span className="material-symbols-outlined text-2xl text-on-surface/50">
          {icon}
        </span>
      </span>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-on-surface group-hover:text-primary">
          {title}
        </h3>
        <p className="mt-0.5 text-sm text-on-surface-variant">{body}</p>
      </div>
    </Link>
  );
}

function OperatorChip({
  href,
  label,
  icon,
  badge,
}: {
  href: string;
  label: string;
  icon: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-outline-variant bg-card p-4 text-center transition-transform hover:-translate-y-1"
    >
      <span className="material-symbols-outlined text-primary">{icon}</span>
      <span className="text-xs font-bold text-on-surface">{label}</span>
      {badge && (
        <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-on-primary">
          {badge}
        </span>
      )}
    </Link>
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

/**
 * Giant Duolingo-style call-to-action: title + sub-label on the left,
 * massive stamped-shadow button on the right. Bright saffron block on a
 * cream backdrop with a dotted highlight strip across the top.
 */
function NextQuestCard({
  title,
  module,
  href,
  cta = "START",
  icon = "play_arrow",
}: {
  title: string;
  module: string;
  href: string;
  cta?: string;
  icon?: string;
}) {
  return (
    <Link
      href={href}
      className="press-soft group relative block overflow-hidden rounded-[32px] border-2 border-primary/80 bg-primary-fixed p-5 transition-transform md:p-7"
      style={{
        boxShadow:
          "0 8px 0 0 #7a2900, 0 32px 64px -24px rgba(167,58,0,0.4)",
      }}
    >
      {/* Decorative star burst behind */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-primary/20 blur-3xl transition-all group-hover:scale-110"
      />
      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary">
            <span className="material-symbols-outlined text-[14px]">
              flag
            </span>
            Today&apos;s mission
          </div>
          <div className="mt-2 text-[11px] font-bold uppercase tracking-widest text-on-primary-fixed-variant">
            {module}
          </div>
          <h2 className="text-display-md mt-1 text-on-primary-fixed">
            {title}
          </h2>
        </div>
        <div
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-7 py-4 text-base font-black uppercase tracking-wide text-on-primary"
          style={{
            boxShadow: "0 5px 0 0 #531800",
          }}
        >
          <span className="material-symbols-outlined text-[22px]">
            {icon}
          </span>
          {cta}
        </div>
      </div>
    </Link>
  );
}
