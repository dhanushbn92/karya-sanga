import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Projects · Karya Sanga" };

const STATUS_TONE: Record<string, string> = {
  active: "bg-secondary-container text-on-secondary-container",
  shipped: "bg-primary-fixed text-on-primary-fixed-variant",
  archived: "bg-surface-container text-on-surface-variant",
};

/**
 * Project Gallery — every team's project across every workshop.
 *
 * Layout (locked 2026-06-26):
 *   1. Header
 *   2. "Your team's project" — if the signed-in user is on a team, that
 *      team's project card sits front-and-center (saffron sticker)
 *   3. "Featured Builder" — admin-pinned project of the moment
 *   4. Filters — Workshop pills · Status pills · Tag pills
 *   5. All projects — grid, 3 cols on lg
 *
 * Status filter values: 'active' (default), 'shipped', or absent = both.
 */

type StatusFilter = "active" | "shipped";

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{
    cohort?: string;
    tag?: string;
    status?: string;
    featured?: string;
    q?: string;
  }>;
}) {
  const me = await requireUser();
  const { cohort, tag, status, featured, q } = await searchParams;
  const query = (q ?? "").trim();
  const activeStatus: StatusFilter | "all" =
    status === "active" || status === "shipped" ? status : "all";

  const where: {
    status?: { not?: "archived"; equals?: "active" | "shipped" };
    cohortId?: string;
    tags?: { has: string };
    featured?: boolean;
    OR?: Array<
      | { name: { contains: string; mode: "insensitive" } }
      | { projectTitle: { contains: string; mode: "insensitive" } }
      | { projectDescription: { contains: string; mode: "insensitive" } }
    >;
  } = { status: { not: "archived" } };
  if (cohort) where.cohortId = cohort;
  if (tag) where.tags = { has: tag.toLowerCase() };
  if (featured === "1") where.featured = true;
  if (activeStatus === "active") where.status = { equals: "active" };
  if (activeStatus === "shipped") where.status = { equals: "shipped" };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { projectTitle: { contains: query, mode: "insensitive" } },
      { projectDescription: { contains: query, mode: "insensitive" } },
    ];
  }

  const [cohorts, projects, featuredOne, myTeamProject] = await Promise.all([
    prisma.cohort.findMany({
      orderBy: [{ current: "desc" }, { startedOn: "desc" }],
      select: {
        id: true,
        name: true,
        _count: { select: { projects: true } },
      },
    }),
    prisma.team.findMany({
      where,
      orderBy: [{ featured: "desc" }, { updatedAt: "desc" }],
      include: {
        cohort: { select: { id: true, name: true } },
        members: {
          select: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { buildLogEntries: true } },
      },
      take: 60,
    }),
    prisma.team.findFirst({
      where: { featured: true, status: { not: "archived" } },
      include: {
        cohort: { select: { id: true, name: true } },
        members: {
          select: { user: { select: { name: true, email: true } } },
        },
      },
      orderBy: { featuredAt: "desc" },
    }),
    // The user's own team's project (if any), so we can pin it at the top.
    prisma.team.findFirst({
      where: {
        status: { not: "archived" },
        members: { some: { userId: me.id } },
      },
      include: {
        cohort: { select: { id: true, name: true } },
        members: {
          select: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { buildLogEntries: true } },
      },
    }),
  ]);

  const allTags = new Set<string>();
  for (const p of projects) p.tags.forEach((t) => allTags.add(t));
  const myTeamId: string | null = myTeamProject?.id ?? null;

  const hasAnyFilter =
    !!cohort ||
    !!tag ||
    activeStatus !== "all" ||
    featured === "1" ||
    !!query;

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      {/* ──────────────────────────────────────────────────────────
       * Header
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-10">
        <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            rocket_launch
          </span>
          <span className="text-xs font-bold tracking-wide">Projects</span>
        </div>
        <h1 className="text-headline-lg text-on-surface">
          Built by everyone at Karya Sanga
        </h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          Every team&apos;s project across every workshop. Open one to read
          the story, follow the build log, or fork the Wokwi circuit.
        </p>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * 1. YOUR TEAM'S PROJECT (only if you're on a team)
       * ────────────────────────────────────────────────────────── */}
      {myTeamProject && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">
              workspaces
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-secondary">
              Your team
            </span>
          </div>
          <Link
            href={`/gallery/${myTeamProject.id}`}
            className="sticker-shadow group block rounded-[28px] border-2 border-secondary bg-secondary-container p-6 text-on-secondary-container transition-transform hover:-translate-y-1 md:p-7"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
              <div className="md:col-span-9">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  {myTeamProject.cohort?.name && (
                    <span className="rounded-full bg-card px-2 py-0.5 text-on-surface-variant">
                      {myTeamProject.cohort.name}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 ${STATUS_TONE[myTeamProject.status]}`}
                  >
                    {myTeamProject.status}
                  </span>
                  {myTeamProject.featured && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-fixed px-2 py-0.5 text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[10px]">
                        star
                      </span>
                      Featured
                    </span>
                  )}
                </div>
                <h2 className="text-headline-md text-on-secondary-container">
                  {myTeamProject.projectTitle ?? myTeamProject.name}
                </h2>
                {myTeamProject.projectDescription && (
                  <p className="mt-1 line-clamp-2 text-sm">
                    {myTeamProject.projectDescription}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <div className="flex -space-x-2">
                    {myTeamProject.members.slice(0, 5).map((m, i) => {
                      const n = m.user.name ?? m.user.email.split("@")[0];
                      return (
                        <div
                          key={i}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-card text-[10px] font-bold text-on-surface"
                        >
                          {n.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                  </div>
                  <span className="font-bold">
                    {myTeamProject.members.length} member
                    {myTeamProject.members.length === 1 ? "" : "s"} ·{" "}
                    {myTeamProject._count.buildLogEntries} build log
                    {myTeamProject._count.buildLogEntries === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="md:col-span-3 flex md:justify-end">
                <span className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-secondary px-5 py-2 font-bold text-on-secondary">
                  Open project
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_forward
                  </span>
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────
       * 2. FEATURED BUILDER (admin-pinned)
       * ────────────────────────────────────────────────────────── */}
      {featuredOne && featuredOne.id !== myTeamId && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">
              star
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">
              Builder of the Month
            </span>
          </div>
          <Link
            href={`/gallery/${featuredOne.id}`}
            className="sticker-shadow group block rounded-[28px] border-2 border-primary bg-primary-fixed p-6 text-on-primary-fixed transition-transform hover:-translate-y-1 md:p-7"
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
              <div className="md:col-span-9">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  {featuredOne.cohort?.name && (
                    <span className="rounded-full bg-card px-2 py-0.5 text-on-surface-variant">
                      {featuredOne.cohort.name}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 ${STATUS_TONE[featuredOne.status]}`}
                  >
                    {featuredOne.status}
                  </span>
                </div>
                <h2 className="text-headline-md text-on-primary-fixed">
                  {featuredOne.projectTitle ?? featuredOne.name}
                </h2>
                {featuredOne.projectDescription && (
                  <p className="mt-1 line-clamp-2 text-sm">
                    {featuredOne.projectDescription}
                  </p>
                )}
                <div className="mt-3 flex -space-x-2">
                  {featuredOne.members.slice(0, 5).map((m, i) => {
                    const n = m.user.name ?? m.user.email.split("@")[0];
                    return (
                      <div
                        key={i}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-card text-[10px] font-bold text-on-surface"
                      >
                        {n.charAt(0).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="md:col-span-3 flex md:justify-end">
                <span className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary">
                  Open project
                  <span className="material-symbols-outlined text-[16px]">
                    arrow_forward
                  </span>
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Divider before all projects */}
      {(myTeamProject || (featuredOne && featuredOne.id !== myTeamId)) && (
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-outline-variant" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            All projects
          </span>
          <div className="h-px flex-1 bg-outline-variant" />
        </div>
      )}

      {/* Search */}
      <form
        method="get"
        className="mb-3 flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2"
      >
        {cohort && <input type="hidden" name="cohort" value={cohort} />}
        {tag && <input type="hidden" name="tag" value={tag} />}
        {status && <input type="hidden" name="status" value={status} />}
        {featured && (
          <input type="hidden" name="featured" value={featured} />
        )}
        <span className="material-symbols-outlined text-on-surface-variant">
          search
        </span>
        <input
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search projects by title or description…"
          className="w-full bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none"
        />
        {query && (
          <a
            href={buildHref({ cohort, tag, status, featured })}
            className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant hover:text-destructive"
          >
            Clear
          </a>
        )}
      </form>

      {/* ──────────────────────────────────────────────────────────
       * 3. FILTERS — workshop / status / tag
       * ────────────────────────────────────────────────────────── */}
      <section className="mb-6 space-y-3">
        {/* Workshop pills */}
        <FilterRow label="Workshop">
          <FilterPill
            href={buildHref({ cohort: undefined, tag, status, featured })}
            label="All"
            active={!cohort}
          />
          {cohorts.map((c) => (
            <FilterPill
              key={c.id}
              href={buildHref({ cohort: c.id, tag, status, featured })}
              label={c.name}
              count={c._count.projects}
              active={cohort === c.id}
            />
          ))}
        </FilterRow>

        {/* Status pills */}
        <FilterRow label="Status">
          <FilterPill
            href={buildHref({ cohort, tag, status: undefined, featured })}
            label="Both"
            active={activeStatus === "all"}
          />
          <FilterPill
            href={buildHref({ cohort, tag, status: "active", featured })}
            label="Active"
            active={activeStatus === "active"}
          />
          <FilterPill
            href={buildHref({ cohort, tag, status: "shipped", featured })}
            label="Shipped"
            active={activeStatus === "shipped"}
          />
          <FilterPill
            href={buildHref({
              cohort,
              tag,
              status,
              featured: featured === "1" ? undefined : "1",
            })}
            label="Featured only"
            active={featured === "1"}
            icon="star"
          />
        </FilterRow>

        {/* Tag pills (only if any tags exist) */}
        {allTags.size > 0 && (
          <FilterRow label="Tag">
            {tag && (
              <FilterPill
                href={buildHref({ cohort, tag: undefined, status, featured })}
                label="Clear"
                active={false}
                icon="close"
              />
            )}
            {Array.from(allTags)
              .sort()
              .slice(0, 16)
              .map((t) => (
                <FilterPill
                  key={t}
                  href={buildHref({ cohort, tag: t, status, featured })}
                  label={`#${t}`}
                  active={tag === t}
                />
              ))}
          </FilterRow>
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
       * 4. ALL PROJECTS GRID
       * ────────────────────────────────────────────────────────── */}
      {projects.length === 0 ? (
        <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-12 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
            rocket_launch
          </span>
          <h2 className="text-headline-md text-on-surface">
            {hasAnyFilter
              ? "Nothing matches those filters."
              : "No projects yet."}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
            {hasAnyFilter ? (
              <>
                Try{" "}
                <Link href="/gallery" className="font-bold text-primary">
                  clearing the filters
                </Link>{" "}
                or pick a different combination.
              </>
            ) : (
              "As workshops finish, their team projects appear here."
            )}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const memberInitials = p.members.slice(0, 5).map((m) => {
              const n = m.user.name ?? m.user.email.split("@")[0];
              return n.charAt(0).toUpperCase();
            });
            const isMine = p.id === myTeamId;
            return (
              <Link
                key={p.id}
                href={`/gallery/${p.id}`}
                className={`group flex flex-col rounded-[24px] border-2 bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary ${
                  isMine
                    ? "border-secondary/40 ring-2 ring-secondary/10"
                    : "border-outline-variant"
                }`}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                  {p.cohort?.name && (
                    <span className="rounded-full bg-surface-container px-2 py-0.5 text-on-surface-variant">
                      {p.cohort.name}
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 ${STATUS_TONE[p.status]}`}
                  >
                    {p.status}
                  </span>
                  {p.featured && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary-fixed px-2 py-0.5 text-on-primary-fixed-variant">
                      <span className="material-symbols-outlined text-[10px]">
                        star
                      </span>
                      Featured
                    </span>
                  )}
                  {isMine && (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-on-secondary-container">
                      Your team
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold leading-tight text-on-surface group-hover:text-primary">
                  {p.projectTitle ?? p.name}
                </h3>
                {p.projectDescription && (
                  <p className="mt-1.5 line-clamp-3 text-sm text-on-surface-variant">
                    {p.projectDescription}
                  </p>
                )}
                {p.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between pt-4">
                  <div className="flex -space-x-2">
                    {memberInitials.map((init, i) => (
                      <div
                        key={i}
                        className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-secondary-container text-[10px] font-bold text-on-secondary-container"
                      >
                        {init}
                      </div>
                    ))}
                  </div>
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    {p._count.buildLogEntries > 0 && (
                      <>
                        {p._count.buildLogEntries} log
                        {p._count.buildLogEntries === 1 ? "" : "s"} ·{" "}
                      </>
                    )}
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function buildHref(params: {
  cohort?: string;
  tag?: string;
  status?: string;
  featured?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.cohort) qs.set("cohort", params.cohort);
  if (params.tag) qs.set("tag", params.tag);
  if (params.status) qs.set("status", params.status);
  if (params.featured) qs.set("featured", params.featured);
  const str = qs.toString();
  return str ? `/gallery?${str}` : "/gallery";
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
