import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MessageButton } from "@/components/ui/message-button";

export const metadata = { title: "People · Karya Sanga" };

const TONE_BG: Record<string, string> = {
  primary: "bg-primary-fixed text-on-primary-fixed-variant",
  secondary: "bg-secondary-container text-on-secondary-container",
  tertiary: "bg-tertiary-fixed text-on-tertiary-fixed",
};

/**
 * Workshop roster — compact, scannable LIST format.
 *
 * One row per person, mobile-friendly: avatar + name + role pills on the
 * left, badges icons + count on the right. Click a row to open the full
 * `/builders/[handle]` profile.
 *
 * Unions primary members (User.cohortId === id) with secondary members
 * (UserCohort join), deduped by user id, sorted by name.
 *
 * Add `?view=card` for the previous detailed card layout (kept for printing
 * a "yearbook" style page). Default is list.
 */
type ViewMode = "list" | "card";

export default async function WorkshopPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const { view } = await searchParams;
  const mode: ViewMode = view === "card" ? "card" : "list";

  const cohort = await prisma.cohort.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          id: true,
          email: true,
          name: true,
          handle: true,
          role: true,
          mentorAvailable: true,
          buildingNow: true,
          earnedBadges: {
            include: { badge: true },
            orderBy: { earnedAt: "desc" },
          },
        },
        orderBy: [{ name: "asc" }, { email: "asc" }],
      },
      memberships: {
        where: { user: { cohortId: { not: id } } },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              handle: true,
              role: true,
              mentorAvailable: true,
              buildingNow: true,
              cohort: { select: { name: true } },
              earnedBadges: {
                include: { badge: true },
                orderBy: { earnedAt: "desc" },
              },
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });
  if (!cohort) notFound();

  type Person = (typeof cohort.members)[number] & {
    primaryCohortName?: string;
  };
  const seen = new Set<string>();
  const people: Person[] = [];
  for (const m of cohort.members) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      people.push(m);
    }
  }
  for (const row of cohort.memberships) {
    if (!seen.has(row.user.id)) {
      seen.add(row.user.id);
      const { cohort: pc, ...rest } = row.user;
      people.push({ ...rest, primaryCohortName: pc?.name });
    }
  }

  const totalBadges = people.reduce(
    (s, p) => s + p.earnedBadges.length,
    0,
  );
  const mentorCount = people.filter((p) => p.mentorAvailable).length;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-12 py-12">
      <Link
        href={`/cohorts/${cohort.id}`}
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        {cohort.name}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[16px]">
              groups
            </span>
            <span className="text-xs font-bold tracking-wide">
              Workshop roster
            </span>
          </div>
          <h1 className="text-headline-lg text-on-surface">
            People in {cohort.name}
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Everyone in this workshop, with the badges they&apos;ve earned.
          </p>
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-1 rounded-full border-2 border-outline-variant bg-card p-1">
          <ViewToggle
            href={`/cohorts/${cohort.id}/people`}
            label="List"
            icon="list"
            active={mode === "list"}
          />
          <ViewToggle
            href={`/cohorts/${cohort.id}/people?view=card`}
            label="Cards"
            icon="grid_view"
            active={mode === "card"}
          />
        </div>
      </div>

      {/* Stats strip */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Stat icon="groups" label={`${people.length} people`} />
        <Stat
          icon="workspace_premium"
          label={`${totalBadges} badge${totalBadges === 1 ? "" : "s"}`}
          tone="primary"
        />
        {mentorCount > 0 && (
          <Stat
            icon="handshake"
            label={`${mentorCount} mentor${mentorCount === 1 ? "" : "s"}`}
            tone="secondary"
          />
        )}
      </div>

      {people.length === 0 ? (
        <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-12 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
            groups
          </span>
          <h2 className="text-headline-md text-on-surface">
            No one here yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
            Your teacher will add people to this workshop soon.
          </p>
        </div>
      ) : mode === "list" ? (
        <RosterList people={people} meId={me.id} />
      ) : (
        <RosterCards people={people} />
      )}
    </main>
  );
}

// ─── List view (compact) ─────────────────────────────────────────

function RosterList({
  people,
  meId,
}: {
  meId: string;
  people: Array<{
    id: string;
    email: string;
    name: string | null;
    handle: string | null;
    role: string;
    mentorAvailable: boolean;
    buildingNow: string | null;
    primaryCohortName?: string;
    earnedBadges: Array<{
      id: string;
      earnedAt: Date;
      badge: { name: string; icon: string; tone: string };
    }>;
  }>;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border-2 border-outline-variant bg-card">
      {/* Header row (desktop only) */}
      <div className="hidden grid-cols-12 gap-3 border-b-2 border-outline-variant bg-surface-container-lowest px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant md:grid">
        <div className="col-span-5">Person</div>
        <div className="col-span-4">Building / details</div>
        <div className="col-span-3 text-right">Badges</div>
      </div>

      <ul className="divide-y-2 divide-outline-variant">
        {people.map((p, idx) => {
          const name = p.name ?? p.email.split("@")[0];
          const initial = name.charAt(0).toUpperCase();
          const rowHref = p.handle ? `/builders/${p.handle}` : undefined;
          const isMe = p.id === meId;
          return (
            <li key={p.id}>
              <div
                className={`group grid grid-cols-1 gap-3 px-5 py-4 transition-colors md:grid-cols-12 md:items-center hover:bg-surface-container-lowest ${
                  idx % 2 === 1 ? "bg-surface-container-lowest/40" : ""
                }`}
              >
                {/* Person — avatar + name + pills */}
                <div className="md:col-span-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-bold text-on-secondary-container">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {rowHref ? (
                        <Link
                          href={rowHref}
                          className="truncate text-sm font-bold text-on-surface hover:text-primary"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="truncate text-sm font-bold text-on-surface">
                          {name}
                        </span>
                      )}
                      {p.role === "admin" && (
                        <RolePill tone="primary" label="Admin" />
                      )}
                      {p.role === "instructor" && (
                        <RolePill tone="primary-container" label="Teacher" />
                      )}
                      {p.mentorAvailable && (
                        <RolePill tone="tertiary" label="Mentor" icon="handshake" />
                      )}
                    </div>
                    <div className="truncate text-[11px] text-on-surface-variant">
                      {p.handle ? `@${p.handle} · ` : ""}
                      {p.email}
                    </div>
                  </div>
                </div>

                {/* Middle column — building now + primary cohort hint */}
                <div className="md:col-span-4 min-w-0">
                  {p.primaryCohortName && (
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      <span className="material-symbols-outlined text-[10px]">
                        home_storage
                      </span>
                      Primary: {p.primaryCohortName}
                    </div>
                  )}
                  {p.buildingNow ? (
                    <p className="line-clamp-2 text-xs text-on-surface-variant">
                      <span className="font-bold text-primary">Building:</span>{" "}
                      {p.buildingNow}
                    </p>
                  ) : !p.primaryCohortName ? (
                    <p className="text-xs text-on-surface-variant/60">—</p>
                  ) : null}
                </div>

                {/* Badges — count + tiny icons */}
                <div className="md:col-span-3 flex items-center justify-end gap-2">
                  {p.earnedBadges.length === 0 ? (
                    <span className="text-[11px] text-on-surface-variant/60">
                      No badges
                    </span>
                  ) : (
                    <>
                      <div className="flex -space-x-1">
                        {p.earnedBadges.slice(0, 5).map((eb) => (
                          <span
                            key={eb.id}
                            title={eb.badge.name}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-white ${TONE_BG[eb.badge.tone] ?? TONE_BG.primary}`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {eb.badge.icon}
                            </span>
                          </span>
                        ))}
                      </div>
                      <span className="mono-label rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">
                        {p.earnedBadges.length}
                      </span>
                    </>
                  )}
                  {!isMe && (
                    <MessageButton
                      toUserId={p.id}
                      currentUserId={meId}
                      size="icon"
                    />
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Card view (kept for printing / yearbook) ─────────────────────

function RosterCards({
  people,
}: {
  people: Array<{
    id: string;
    email: string;
    name: string | null;
    handle: string | null;
    role: string;
    mentorAvailable: boolean;
    buildingNow: string | null;
    primaryCohortName?: string;
    earnedBadges: Array<{
      id: string;
      earnedAt: Date;
      badge: { name: string; icon: string; tone: string; description: string };
    }>;
  }>;
}) {
  return (
    <ul className="space-y-4">
      {people.map((p) => {
        const name = p.name ?? p.email.split("@")[0];
        const initial = name.charAt(0).toUpperCase();
        return (
          <li
            key={p.id}
            className="sticker-shadow rounded-[24px] border-2 border-outline-variant bg-card p-5 md:p-6"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex shrink-0 items-start gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary-container text-xl font-bold text-on-secondary-container">
                  {initial}
                </div>
                <div className="min-w-0 md:w-56">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.handle ? (
                      <Link
                        href={`/builders/${p.handle}`}
                        className="text-base font-bold text-on-surface hover:text-primary"
                      >
                        {name}
                      </Link>
                    ) : (
                      <span className="text-base font-bold text-on-surface">
                        {name}
                      </span>
                    )}
                    {p.role === "admin" && (
                      <RolePill tone="primary" label="Admin" />
                    )}
                    {p.role === "instructor" && (
                      <RolePill tone="primary-container" label="Teacher" />
                    )}
                    {p.mentorAvailable && (
                      <RolePill tone="tertiary" label="Mentor" icon="handshake" />
                    )}
                  </div>
                  {p.handle && (
                    <div className="mt-0.5 text-[11px] font-bold text-on-surface-variant">
                      @{p.handle}
                    </div>
                  )}
                  {p.primaryCohortName && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      <span className="material-symbols-outlined text-[10px]">
                        home_storage
                      </span>
                      Primary: {p.primaryCohortName}
                    </div>
                  )}
                  {p.buildingNow && (
                    <p className="mt-2 text-[11px] text-on-surface-variant">
                      <span className="font-bold text-primary">Building:</span>{" "}
                      {p.buildingNow}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    Badges earned
                  </span>
                  <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                    {p.earnedBadges.length}
                  </span>
                </div>
                {p.earnedBadges.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
                    No badges yet.
                  </p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {p.earnedBadges.map((eb) => (
                      <li
                        key={eb.id}
                        className={`flex items-start gap-2 rounded-2xl border-2 border-white p-2.5 ${
                          TONE_BG[eb.badge.tone] ?? TONE_BG.primary
                        }`}
                        title={`Earned ${new Date(eb.earnedAt).toLocaleDateString()}`}
                      >
                        <span className="material-symbols-outlined mt-0.5 text-[20px]">
                          {eb.badge.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold">
                            {eb.badge.name}
                          </div>
                          <p className="line-clamp-2 text-[10px] opacity-90">
                            {eb.badge.description}
                          </p>
                          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider opacity-70">
                            {new Date(eb.earnedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function RolePill({
  tone,
  label,
  icon,
}: {
  tone: "primary" | "primary-container" | "tertiary";
  label: string;
  icon?: string;
}) {
  const map: Record<typeof tone, string> = {
    primary: "bg-primary text-on-primary",
    "primary-container": "bg-primary-container text-on-primary-container",
    tertiary: "bg-tertiary-fixed text-on-tertiary-fixed",
  };
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${map[tone]}`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[10px]">{icon}</span>
      )}
      {label}
    </span>
  );
}

function Stat({
  icon,
  label,
  tone = "default",
}: {
  icon: string;
  label: string;
  tone?: "default" | "primary" | "secondary";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        tone === "primary"
          ? "bg-primary-fixed text-on-primary-fixed-variant"
          : tone === "secondary"
            ? "bg-secondary-container text-on-secondary-container"
            : "bg-surface-container text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </span>
  );
}

function ViewToggle({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
        active
          ? "bg-primary text-on-primary"
          : "text-on-surface-variant hover:text-primary"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </Link>
  );
}
