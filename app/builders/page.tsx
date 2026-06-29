import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, user, cohort as cohortTable } from "@/lib/db";

export const metadata = { title: "People · Karya Sanga" };

/**
 * Builders directory (locked 2026-06-27).
 *
 * Layout:
 *   1. Header — pill + h1 + subtitle + "Edit my profile" CTA (right side)
 *   2. Stats strip — total builders, mentors available, your cohort count
 *   3. Filter row — Workshop pills + "Mentors only" toggle
 *   4. Grid — each builder card shows: avatar, name, role pill, cohort,
 *      bio (2 lines), badge previews, mentor flag, "you" highlight
 *
 * Schema note: User.cohortId is still single-FK today. When the multi-
 * workshop migration lands, swap b.cohort → b.cohorts[] and update the
 * filter to use a join.
 */
type RoleFilter = "all" | "mentor";

export default async function BuildersPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; mentor?: string; q?: string }>;
}) {
  const me = await requireUser();
  const { cohort, mentor, q } = await searchParams;
  const query = (q ?? "").trim();
  const roleFilter: RoleFilter = mentor === "1" ? "mentor" : "all";

  const conditions = [];
  if (cohort) conditions.push(eq(user.cohortId, cohort));
  if (roleFilter === "mentor") conditions.push(eq(user.mentorAvailable, true));
  if (query) {
    const orClause = or(
      ilike(user.name, `%${query}%`),
      ilike(user.handle, `%${query}%`),
      ilike(user.email, `%${query}%`),
    );
    if (orClause) conditions.push(orClause);
  }

  const [cohortsRaw, buildersRaw, totalCount, mentorCount, myCohortCount] =
    await Promise.all([
      db.query.cohort.findMany({
        orderBy: [desc(cohortTable.current), desc(cohortTable.startedOn)],
        columns: { id: true, name: true },
        extras: {
          membersCount: sql<number>`(
            select count(*)::int from ${user}
            where ${user.cohortId} = ${cohortTable.id}
          )`.as("members_count"),
        },
      }),
      db.query.user.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(user.mentorAvailable), asc(user.name), asc(user.email)],
        with: {
          cohort: { columns: { id: true, name: true } },
          earnedBadges_userId: {
            with: {
              badge: { columns: { slug: true, icon: true, tone: true } },
            },
          },
        },
        limit: 200,
      }),
      db.$count(user),
      db.$count(user, eq(user.mentorAvailable, true)),
      // My-cohort count (skip if I don't have a cohort)
      db.query.user
        .findFirst({
          where: eq(user.id, me.id),
          columns: { cohortId: true },
        })
        .then(async (u) => {
          if (!u?.cohortId) return null;
          return db.$count(user, eq(user.cohortId, u.cohortId));
        }),
    ]);

  // Map Drizzle relation names / extras back to the keys the JSX expects
  // (membersCount → _count.members, earnedBadges_userId → earnedBadges).
  const cohorts = cohortsRaw.map((c) => ({
    ...c,
    _count: { members: c.membersCount },
  }));
  const builders = buildersRaw.map((b) => ({
    ...b,
    earnedBadges: b.earnedBadges_userId,
  }));

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      {/* ──────────────────────────────────────────────────────────
       * Header
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[16px]">
              groups
            </span>
            <span className="text-xs font-bold tracking-wide">
              People
            </span>
          </div>
          <h1 className="text-headline-lg text-on-surface">
            The people behind every project
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Everyone who&apos;s been in a workshop, grouped by workshop.
            Tap a name to see what they&apos;ve built and the badges they
            earned.
          </p>
        </div>
        <Link
          href="/settings/profile"
          className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-5 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
        >
          <span className="material-symbols-outlined text-[16px]">
            edit
          </span>
          Edit my profile
        </Link>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * Stats strip
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Stat icon="groups" label={`${totalCount} people`} />
        {mentorCount > 0 && (
          <Stat
            icon="handshake"
            label={`${mentorCount} mentor${mentorCount === 1 ? "" : "s"}`}
            tone="primary"
          />
        )}
        {myCohortCount !== null && (
          <Stat
            icon="home_storage"
            label={`${myCohortCount} in your workshop`}
            tone="secondary"
          />
        )}
      </div>

      {/* Search */}
      <form
        method="get"
        className="mb-3 flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2"
      >
        {cohort && <input type="hidden" name="cohort" value={cohort} />}
        {mentor && <input type="hidden" name="mentor" value={mentor} />}
        <span className="material-symbols-outlined text-on-surface-variant">
          search
        </span>
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search by name or @handle…"
          className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
        {query && (
          <a
            href={buildHref({ cohort, mentor })}
            className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-destructive"
          >
            Clear
          </a>
        )}
      </form>

      {/* ──────────────────────────────────────────────────────────
       * Filters — workshop + mentor toggle
       * ────────────────────────────────────────────────────────── */}
      <section className="mb-8 space-y-3">
        <FilterRow label="Workshop">
          <FilterPill
            href={buildHref({ cohort: undefined, mentor })}
            label="All"
            active={!cohort}
          />
          {cohorts.map((c) => (
            <FilterPill
              key={c.id}
              href={buildHref({ cohort: c.id, mentor })}
              label={c.name}
              count={c._count.members}
              active={cohort === c.id}
            />
          ))}
        </FilterRow>
        <FilterRow label="Role">
          <FilterPill
            href={buildHref({ cohort, mentor: undefined })}
            label="Everyone"
            active={roleFilter === "all"}
          />
          <FilterPill
            href={buildHref({ cohort, mentor: "1" })}
            label="Mentors only"
            icon="handshake"
            count={mentorCount}
            active={roleFilter === "mentor"}
          />
        </FilterRow>
      </section>

      {/* ──────────────────────────────────────────────────────────
       * Grid
       * ────────────────────────────────────────────────────────── */}
      {builders.length === 0 ? (
        <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-12 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
            groups
          </span>
          <h2 className="text-headline-md text-on-surface">
            {roleFilter === "mentor"
              ? "No mentors match those filters."
              : cohort
                ? "Nobody in that workshop yet."
                : "No people here yet."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
            Try{" "}
            <Link href="/builders" className="font-bold text-primary">
              clearing the filters
            </Link>{" "}
            or pick a different combination.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {builders.map((b) => {
            const name = b.name ?? b.email.split("@")[0];
            const initial = name.charAt(0).toUpperCase();
            const linkHref = b.handle ? `/builders/${b.handle}` : "#";
            const clickable = !!b.handle;
            const isMe = b.id === me.id;
            const Card = clickable ? Link : "div";
            return (
              <Card
                // @ts-expect-error — conditional component
                href={clickable ? linkHref : undefined}
                key={b.id}
                className={`group flex items-start gap-4 rounded-[24px] border-2 bg-card p-5 ${
                  isMe
                    ? "border-secondary/40 ring-2 ring-secondary/10"
                    : "border-outline-variant"
                } ${
                  clickable
                    ? "transition-all hover:-translate-y-1 hover:border-primary"
                    : "opacity-80"
                }`}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-base font-bold text-on-secondary-container">
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-bold text-on-surface group-hover:text-primary">
                      {name}
                    </span>
                    {isMe && (
                      <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-secondary-container">
                        you
                      </span>
                    )}
                    {b.mentorAvailable && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-fixed px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                        <span className="material-symbols-outlined text-[10px]">
                          handshake
                        </span>
                        Mentor
                      </span>
                    )}
                    {b.role === "admin" && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-primary">
                        Admin
                      </span>
                    )}
                    {b.role === "instructor" && (
                      <span className="rounded-full bg-primary-container px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-on-primary-container">
                        Instructor
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-on-surface-variant">
                    {b.cohort?.name ?? "No workshop"}
                    {b.handle ? ` · @${b.handle}` : ""}
                  </div>
                  {b.bio && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-on-surface-variant">
                      {b.bio}
                    </p>
                  )}
                  {b.buildingNow && (
                    <p className="mt-1.5 text-[11px] text-on-surface-variant">
                      <span className="font-bold text-primary">
                        Building:
                      </span>{" "}
                      <span className="line-clamp-1">{b.buildingNow}</span>
                    </p>
                  )}
                  {b.earnedBadges.length > 0 && (
                    <div className="mt-3 flex items-center gap-1">
                      {b.earnedBadges.slice(0, 6).map((eb) => (
                        <span
                          key={eb.id}
                          title={eb.badge.slug}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {eb.badge.icon}
                          </span>
                        </span>
                      ))}
                      {b.earnedBadges.length > 6 && (
                        <span className="ml-1 text-[10px] font-bold text-on-surface-variant">
                          +{b.earnedBadges.length - 6}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function buildHref(params: { cohort?: string; mentor?: string }): string {
  const qs = new URLSearchParams();
  if (params.cohort) qs.set("cohort", params.cohort);
  if (params.mentor) qs.set("mentor", params.mentor);
  const str = qs.toString();
  return str ? `/builders?${str}` : "/builders";
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 inline-block min-w-[64px] text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {label}
      </span>
      {children}
    </div>
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

function FilterPill({
  href,
  label,
  count,
  active,
  icon,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  icon?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors ${
        active
          ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
          : "border-outline-variant bg-card text-on-surface-variant hover:border-primary hover:text-primary"
      }`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[12px]">{icon}</span>
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0 text-[10px] ${
            active
              ? "bg-on-primary-fixed-variant text-primary-fixed"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
