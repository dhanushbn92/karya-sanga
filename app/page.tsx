import Image from "next/image";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, cohort, wallPost, badge, team, user } from "@/lib/db";
import { signedWallImageUrls } from "@/lib/supabase/admin";

export const metadata = {
  title: "Karya Sanga · An initiative of Anaadi Foundation",
  description:
    "Where curious kids learn AI, build with electronics, and ship real projects together. Online or in person, you bring the curiosity, we bring the labs.",
};

/**
 * Public landing page (`/`).
 *
 * Design intent (locked with user 2026-05-30):
 *   - Tell the story of what the platform is, not just what's inside it
 *   - Show live activity (cohorts, projects, community posts) so anyone
 *     landing here knows it's used, not a stale brochure
 *   - Colorful + fun: lean into the Youth Edition palette (terracotta,
 *     teal, purple, cream, lavender), playful sticker shadows, rotational
 *     hovers, and concrete numbers
 *
 * Sections (top → bottom):
 *   1. Hero with Anaadi badge + headline + dual CTA
 *   2. "What you'll do here" — three pillar cards
 *   3. "How a workshop runs" — 4-step timeline
 *   4. Live workshops (real Cohort rows)
 *   5. Recent community wall thumbnails (real WallPost rows)
 *   6. Badge collection showcase
 *   7. Powered by Wokwi
 *   8. Final CTA + footer
 */
export default async function LandingPage() {
  const [cohortRows, recentWall, badges, teamCount, builderCount] =
    await Promise.all([
      db.query.cohort.findMany({
        orderBy: [desc(cohort.current), desc(cohort.startedOn)],
        limit: 6,
      }),
      db.query.wallPost.findMany({
        where: eq(wallPost.approved, true),
        orderBy: [desc(wallPost.createdAt)],
        limit: 6,
      }),
      db.query.badge.findMany({
        orderBy: [asc(badge.category), asc(badge.order)],
        limit: 17,
      }),
      db.$count(team),
      db.$count(user),
    ]);

  // _count.members (User.cohortId FK → relation "users") and _count.projects
  // (Team.cohortId FK → relation "teams") via correlated counts per cohort.
  const cohorts = await Promise.all(
    cohortRows.map(async (c) => {
      const [members, projects] = await Promise.all([
        db.$count(user, eq(user.cohortId, c.id)),
        db.$count(team, eq(team.cohortId, c.id)),
      ]);
      return { ...c, _count: { members, projects } };
    }),
  );

  const wallUrls = await signedWallImageUrls(
    recentWall.map((p) => p.imagePath).filter((p): p is string => !!p),
    60 * 30,
  );

  return (
    <>
      {/* ============================================================
       * 1. HERO
       * ============================================================ */}
      <section className="relative overflow-hidden">
        {/* Soft colored blobs in the background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 top-10 h-96 w-96 rounded-full bg-secondary-container/40 blur-3xl" />
          <div className="absolute -right-20 top-40 h-96 w-96 rounded-full bg-tertiary-fixed/40 blur-3xl" />
          <div className="absolute left-1/3 bottom-0 h-72 w-72 rounded-full bg-primary-fixed/40 blur-3xl" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-12 md:px-12 md:py-24">
          <div className="space-y-7 md:col-span-7">
            {/* Anaadi badge */}
            <div className="inline-flex items-center gap-3 rounded-full border-2 border-white bg-card px-3 py-1.5 shadow-sm">
              <Image
                src="/anaadi-logo-mark.png"
                alt=""
                aria-hidden="true"
                width={28}
                height={28}
                className="h-7 w-auto object-contain"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Karya Sanga · An initiative of Anaadi Foundation
              </span>
            </div>

            {/* Big headline */}
            <h1 className="text-display-lg leading-none text-on-surface">
              Where{" "}
              <span className="relative inline-block">
                <span className="text-primary">curious kids</span>
                <span className="absolute -bottom-1 left-0 right-0 h-3 -z-10 rounded-full bg-secondary-container/70" />
              </span>{" "}
              learn AI &amp; build real circuits.
            </h1>

            <p className="max-w-2xl text-lg text-on-surface-variant">
              A workshop platform for in-person and online classes. You
              bring the curiosity — we bring the lessons, the simulator,
              the teams, and the place to share what you build.
            </p>

            {/* Dual CTA */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/signup"
                className="sticker-shadow sticker-hover inline-flex items-center gap-2 rounded-full bg-primary-container px-7 py-3.5 text-lg font-bold text-on-primary-container"
              >
                Join a workshop
                <span className="material-symbols-outlined">rocket_launch</span>
              </Link>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-7 py-3.5 text-lg font-bold text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                See what people are making
                <span className="material-symbols-outlined">arrow_outward</span>
              </Link>
            </div>

            {/* Live numbers */}
            <div className="flex flex-wrap items-center gap-4 pt-4 text-sm font-bold text-on-surface-variant">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />
                Live now
              </span>
              <span>
                <span className="font-black text-primary">
                  {cohorts.length}
                </span>{" "}
                workshop{cohorts.length === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>
                <span className="font-black text-primary">{teamCount}</span>{" "}
                team{teamCount === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>
                <span className="font-black text-primary">
                  {builderCount}
                </span>{" "}
                builder{builderCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          {/* Mascot card */}
          <div className="relative md:col-span-5">
            <div className="absolute -right-6 -top-6 inline-flex items-center gap-1.5 rounded-full border-2 border-white bg-primary-fixed px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-on-primary-fixed-variant shadow-lg rotate-3">
              <span className="material-symbols-outlined text-[14px]">
                bolt
              </span>
              ESP32 + AI
            </div>
            <div className="absolute -bottom-6 -left-6 inline-flex items-center gap-1.5 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-on-tertiary-fixed shadow-lg -rotate-3">
              Powered by Wokwi
            </div>
            <div className="sticker-shadow relative rounded-[36px] border-2 border-outline-variant bg-card p-5">
              <div className="relative aspect-[53/28] overflow-hidden rounded-[28px] bg-gradient-to-br from-primary-fixed via-tertiary-fixed to-secondary-fixed">
                <Image
                  src="/hero-illustration.png"
                  alt="People learning AI at the ashram with Karya Sanga"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
       * 2. "WHAT YOU'LL DO HERE"
       * ============================================================ */}
      <section className="bg-surface-container-low py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <div className="mb-10 text-center">
            <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
              <span className="material-symbols-outlined text-[14px]">
                explore
              </span>
              Why this platform
            </span>
            <h2 className="text-headline-lg mt-4 text-on-surface">
              Three things every kid does here.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-on-surface-variant">
              Learn the concepts. Build the circuits. Ship a real project
              with friends. Everything else exists to make those three easier.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <PillarCard
              tone="primary"
              icon="psychology"
              eyebrow="Step 1"
              title="Learn AI &amp; electronics"
              body="Bite-size lessons your instructor publishes per workshop. Slides, code snippets, and presenter mode for live sessions."
              ctaLabel="Browse lessons"
              ctaHref="/lessons"
            />
            <PillarCard
              tone="secondary"
              icon="memory"
              eyebrow="Step 2"
              title="Build virtual circuits"
              body="Wokwi-powered simulator with a starter library and a component reference. Wire up an ESP32 with a soldering iron later — get it right here first."
              ctaLabel="Open the lab"
              ctaHref="/simulator"
            />
            <PillarCard
              tone="tertiary"
              icon="rocket_launch"
              eyebrow="Step 3"
              title="Ship with your team"
              body="Form a hackathon team, build a project, submit it. Then add to the build log forever — your project page never closes."
              ctaLabel="See projects"
              ctaHref="/gallery"
            />
          </div>
        </div>
      </section>

      {/* ============================================================
       * 3. "HOW A WORKSHOP RUNS" timeline
       * ============================================================ */}
      <section className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <div className="mb-10">
            <h2 className="text-headline-lg text-on-surface">
              How a workshop runs.
            </h2>
            <p className="mt-2 max-w-2xl text-on-surface-variant">
              The same four steps every workshop, whether you join online
              or meet up in person at the ashram.
            </p>
          </div>

          <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-4">
            <TimelineStep
              n="01"
              tone="primary"
              icon="how_to_reg"
              title="Join a workshop"
              body="Your teacher adds you. You see your classmates, lessons, and your team — all in one place."
            />
            <TimelineStep
              n="02"
              tone="secondary"
              icon="menu_book"
              title="Follow the lessons"
              body="Read at your pace or watch live. Mark complete. Earn badges as you go."
            />
            <TimelineStep
              n="03"
              tone="tertiary"
              icon="memory"
              title="Build in the lab"
              body="Wokwi simulator, sensor reference, save your projects to your account."
            />
            <TimelineStep
              n="04"
              tone="primary"
              icon="rocket_launch"
              title="Submit + share"
              body="Hackathon team submission, judges score, leaderboard, project lives in the gallery forever."
            />
          </ol>
        </div>
      </section>

      {/* ============================================================
       * 4. LIVE WORKSHOPS
       * ============================================================ */}
      {cohorts.length > 0 && (
        <section className="bg-tertiary-fixed/30 py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
            <div className="mb-8 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-card px-3 py-1 text-xs font-bold text-on-tertiary-fixed shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    home_storage
                  </span>
                  Active workshops
                </span>
                <h2 className="text-headline-lg mt-3 text-on-surface">
                  Workshops running right now.
                </h2>
                <p className="mt-1 text-on-surface-variant">
                  Each workshop is its own space — same platform,
                  different rooms.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cohorts.map((c) => (
                <article
                  key={c.id}
                  className="group rounded-[24px] border-2 border-outline-variant bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary"
                >
                  <div className="mb-3 flex items-center justify-between">
                    {c.current ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-on-primary" />
                        Current
                      </span>
                    ) : (
                      <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        Past workshop
                      </span>
                    )}
                    <span className="text-[11px] text-on-surface-variant">
                      {c.startedOn
                        ? new Date(c.startedOn).toLocaleDateString(
                            undefined,
                            { month: "short", year: "numeric" },
                          )
                        : "—"}
                    </span>
                  </div>
                  <h3 className="text-headline-md text-on-surface group-hover:text-primary">
                    {c.name}
                  </h3>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-on-surface-variant">
                      {c.description}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-3 text-xs font-bold text-on-surface-variant">
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        groups
                      </span>
                      {c._count.members} member
                      {c._count.members === 1 ? "" : "s"}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        rocket_launch
                      </span>
                      {c._count.projects} project
                      {c._count.projects === 1 ? "" : "s"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
       * 5. RECENT COMMUNITY POSTS
       * ============================================================ */}
      {recentWall.length > 0 && (
        <section className="py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
            <div className="mb-8 flex flex-col items-start justify-between gap-3 md:flex-row md:items-end">
              <div>
                <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container shadow-sm">
                  <span className="material-symbols-outlined text-[14px]">
                    photo_library
                  </span>
                  Show &amp; Tell
                </span>
                <h2 className="text-headline-lg mt-3 text-on-surface">
                  What people are sharing this week.
                </h2>
                <p className="mt-1 text-on-surface-variant">
                  Snaps from labs, screenshots, soldering wins.
                </p>
              </div>
              <Link
                href="/wall"
                className="text-sm font-bold text-primary hover:underline"
              >
                Open the wall →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
              {recentWall.map((p) => {
                const url = p.imagePath ? wallUrls.get(p.imagePath) : undefined;
                return (
                  <Link
                    key={p.id}
                    href="/wall"
                    className="group aspect-square overflow-hidden rounded-2xl border-2 border-outline-variant bg-surface-container-low"
                    title={p.caption ?? ""}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={p.caption ?? ""}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-full w-full bg-surface-container" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ============================================================
       * 6. BADGES showcase
       * ============================================================ */}
      {badges.length > 0 && (
        <section className="bg-secondary-container/30 py-16 md:py-24">
          <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
            <div className="mb-8 text-center">
              <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-primary-fixed px-3 py-1 text-xs font-bold text-on-primary-fixed-variant shadow-sm">
                <span className="material-symbols-outlined text-[14px]">
                  workspace_premium
                </span>
                Earn as you go
              </span>
              <h2 className="text-headline-lg mt-4 text-on-surface">
                Collect badges. Build a reputation.
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-on-surface-variant">
                10 from the workshop, 7 more for what you do after. Each one
                tells a real story about something you built or shipped.
              </p>
            </div>

            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9">
              {badges.map((b, i) => (
                <BadgeChip key={b.id} badge={b} rotate={i % 2 === 0} />
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ============================================================
       * 7. POWERED BY WOKWI
       * ============================================================ */}
      <section className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <article className="sticker-shadow grid grid-cols-1 gap-8 rounded-[36px] border-2 border-outline-variant bg-card p-6 md:grid-cols-12 md:p-10">
            <div className="md:col-span-5">
              <div className="flex aspect-video items-center justify-center rounded-[24px] bg-gradient-to-br from-primary-fixed via-tertiary-fixed to-secondary-fixed">
                <span className="material-symbols-outlined text-[100px] text-on-surface/30">
                  memory
                </span>
              </div>
            </div>
            <div className="space-y-4 md:col-span-7">
              <span className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-xs font-bold text-on-tertiary-fixed shadow-sm">
                <span className="material-symbols-outlined text-[14px]">
                  bolt
                </span>
                Real circuits, no broken parts
              </span>
              <h2 className="text-headline-lg text-on-surface">
                Powered by Wokwi.
              </h2>
              <p className="text-on-surface-variant">
                Every component, sensor, and chip a kid touches is simulated
                in{" "}
                <a
                  href="https://wokwi.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-primary hover:underline"
                >
                  Wokwi
                </a>{" "}
                first. Try a soil sensor without buying one. Burn an LED
                without burning an LED. When it works in the sim, build it
                IRL with confidence.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  "ESP32",
                  "ESP32-S3",
                  "Arduino UNO",
                  "RP2040",
                  "Soil moisture",
                  "HC-SR04",
                  "LED",
                  "Buzzer",
                ].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href="/simulator"
                className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
              >
                Open the Maker Lab
                <span className="material-symbols-outlined text-[16px]">
                  arrow_forward
                </span>
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* ============================================================
       * 8. FINAL CTA
       * ============================================================ */}
      <section className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-[1280px] px-4 md:px-12">
          <article className="sticker-shadow relative overflow-hidden rounded-[36px] bg-primary-container p-10 text-center text-on-primary-container md:p-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="relative mx-auto max-w-2xl space-y-5">
              <h2 className="text-display-lg leading-none">
                Curious? <br /> Come build with us.
              </h2>
              <p className="text-lg opacity-90">
                Anaadi Foundation runs Karya Sanga as a community.
                Workshops fill quickly — make an account and your teacher
                will add you to the next one.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Link
                  href="/signup"
                  className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-card px-7 py-3.5 text-lg font-bold text-primary"
                >
                  Create your account
                  <span className="material-symbols-outlined">
                    arrow_forward
                  </span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 rounded-full border-2 border-on-primary-container px-7 py-3.5 text-lg font-bold"
                >
                  I already have one
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ============================================================
       * FOOTER
       * ============================================================ */}
      <footer className="border-t border-outline-variant py-10">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center justify-between gap-6 px-4 md:flex-row md:items-end md:px-12">
          <div className="flex flex-col items-center gap-3 md:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/anaadi-logo-full.jpg"
              alt="Anaadi Foundation"
              className="h-12 w-auto object-contain"
            />
            <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Karya Sanga · An initiative of Anaadi Foundation
            </p>
            <p className="text-[11px] text-on-surface-variant">
              © {new Date().getFullYear()} Anaadi Foundation. All rights
              reserved.
            </p>
          </div>
          <div className="flex gap-6 text-sm font-medium text-on-surface-variant">
            <Link href="/gallery" className="hover:text-primary">
              Projects
            </Link>
            <Link href="/wall" className="hover:text-primary">
              Show &amp; Tell
            </Link>
            <Link href="/login" className="hover:text-primary">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}

// ─── Pillar card (3 in a row) ────────────────────────────────────
function PillarCard({
  tone,
  icon,
  eyebrow,
  title,
  body,
  ctaLabel,
  ctaHref,
}: {
  tone: "primary" | "secondary" | "tertiary";
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  const headBg = {
    primary: "bg-primary-fixed",
    secondary: "bg-secondary-container",
    tertiary: "bg-tertiary-fixed",
  }[tone];
  const headText = {
    primary: "text-on-primary-fixed-variant",
    secondary: "text-on-secondary-container",
    tertiary: "text-on-tertiary-fixed",
  }[tone];
  const stickerVariant = {
    primary: "sticker-shadow",
    secondary: "sticker-shadow-teal",
    tertiary: "sticker-shadow-purple",
  }[tone];
  return (
    <article
      className={`group flex flex-col rounded-[28px] border-2 border-outline-variant bg-card p-6 transition-all hover:-translate-y-2 ${stickerVariant}`}
    >
      <div
        className={`flex h-32 items-center justify-between rounded-[20px] ${headBg} px-5`}
      >
        <span
          className={`material-symbols-outlined text-[64px] ${headText} opacity-60`}
        >
          {icon}
        </span>
        <span
          className={`mono-label rounded-full bg-card px-3 py-0.5 ${headText}`}
        >
          {eyebrow}
        </span>
      </div>
      <h3
        className="text-headline-md mt-5 text-on-surface"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <p className="mt-2 text-on-surface-variant">{body}</p>
      <Link
        href={ctaHref}
        className="mt-5 inline-flex items-center gap-1 font-bold text-primary group-hover:underline"
      >
        {ctaLabel}
        <span className="material-symbols-outlined text-[18px]">
          arrow_forward
        </span>
      </Link>
    </article>
  );
}

// ─── Timeline step (4 in a row) ───────────────────────────────────
function TimelineStep({
  n,
  tone,
  icon,
  title,
  body,
}: {
  n: string;
  tone: "primary" | "secondary" | "tertiary";
  icon: string;
  title: string;
  body: string;
}) {
  const dotBg = {
    primary: "bg-primary text-on-primary",
    secondary: "bg-secondary text-on-secondary",
    tertiary: "bg-tertiary text-on-tertiary",
  }[tone];
  return (
    <li className="relative rounded-[24px] border-2 border-outline-variant bg-card p-5">
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${dotBg} text-base font-black`}
      >
        {n}
      </div>
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-primary">
          {icon}
        </span>
        <h3 className="text-base font-bold text-on-surface">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-on-surface-variant">{body}</p>
    </li>
  );
}

// ─── Badge chip for the showcase ──────────────────────────────────
function BadgeChip({
  badge,
  rotate,
}: {
  badge: {
    name: string;
    icon: string;
    tone: string;
    description: string;
  };
  rotate: boolean;
}) {
  const bg =
    {
      primary: "bg-primary-fixed text-on-primary-fixed-variant",
      secondary: "bg-secondary-container text-on-secondary-container",
      tertiary: "bg-tertiary-fixed text-on-tertiary-fixed",
    }[badge.tone] ?? "bg-primary-fixed text-on-primary-fixed-variant";
  return (
    <li
      className={`group flex flex-col items-center gap-1 rounded-2xl border-2 border-white p-3 text-center shadow-sm transition-transform hover:rotate-0 hover:scale-105 ${bg} ${
        rotate ? "rotate-2" : "-rotate-2"
      }`}
      title={badge.description}
    >
      <span className="material-symbols-outlined text-[26px]">
        {badge.icon}
      </span>
      <span className="line-clamp-2 text-[10px] font-bold leading-tight">
        {badge.name}
      </span>
    </li>
  );
}

// ─── Friendly CSS-only mascot for the hero card ───────────────────
/**
 * Modern hero illustration — friendly AI maker character with a circuit
 * board body, glowing antenna, orbiting energy dots, and brand-coloured
 * gradient background. Pure inline SVG so it stays sharp on every screen
 * and doesn't need an asset round trip.
 *
 * Animations are CSS-only on the SVG elements directly (no JS):
 *   - antenna LED pulses
 *   - eye highlights blink softly
 *   - orbiting dots gently bob
 *   - background blobs drift
 */
function CssMascot() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <svg
        viewBox="0 0 400 400"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          {/* Backdrop blobs */}
          <radialGradient id="bg-blob-1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bg-blob-2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#57fae9" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#57fae9" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="bg-blob-3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a07bff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#a07bff" stopOpacity="0" />
          </radialGradient>
          {/* Head gradient */}
          <linearGradient id="head-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2b1f17" />
            <stop offset="100%" stopColor="#1a120c" />
          </linearGradient>
          {/* Body / PCB gradient */}
          <linearGradient id="body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e3a32" />
            <stop offset="100%" stopColor="#0e2620" />
          </linearGradient>
          {/* Eye glow */}
          <radialGradient id="eye-grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#bdfff7" />
            <stop offset="60%" stopColor="#57fae9" />
            <stop offset="100%" stopColor="#1ec9b8" />
          </radialGradient>
          {/* Antenna LED */}
          <radialGradient id="led-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe7a8" />
            <stop offset="50%" stopColor="#ff8a3d" />
            <stop offset="100%" stopColor="#d8541b" />
          </radialGradient>
          {/* Soft halo behind LED */}
          <radialGradient id="led-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ff8a3d" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ff8a3d" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Drifting backdrop blobs */}
        <g className="mascot-blob mascot-blob-1">
          <circle cx="90" cy="110" r="110" fill="url(#bg-blob-1)" />
        </g>
        <g className="mascot-blob mascot-blob-2">
          <circle cx="320" cy="120" r="100" fill="url(#bg-blob-2)" />
        </g>
        <g className="mascot-blob mascot-blob-3">
          <circle cx="180" cy="330" r="120" fill="url(#bg-blob-3)" />
        </g>

        {/* Decorative circuit traces (subtle) */}
        <g
          stroke="#ffffff"
          strokeOpacity="0.18"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M 30 200 L 90 200 L 110 180" />
          <path d="M 370 200 L 310 200 L 290 180" />
          <path d="M 30 260 L 80 260" />
          <path d="M 370 260 L 320 260" />
        </g>
        <g fill="#ffffff" fillOpacity="0.45">
          <circle cx="30" cy="200" r="2.5" />
          <circle cx="370" cy="200" r="2.5" />
          <circle cx="30" cy="260" r="2.5" />
          <circle cx="370" cy="260" r="2.5" />
        </g>

        {/* Antenna halo (behind the LED) */}
        <circle
          cx="200"
          cy="70"
          r="36"
          fill="url(#led-halo)"
          className="mascot-halo"
        />

        {/* Antenna stem */}
        <line
          x1="200"
          y1="90"
          x2="200"
          y2="135"
          stroke="#1a120c"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Antenna LED */}
        <circle
          cx="200"
          cy="78"
          r="11"
          fill="url(#led-grad)"
          className="mascot-led"
        />

        {/* Head — rounded square */}
        <rect
          x="100"
          y="130"
          width="200"
          height="160"
          rx="48"
          ry="48"
          fill="url(#head-grad)"
        />
        {/* Cheek bolts */}
        <circle cx="98" cy="210" r="8" fill="#a07bff" />
        <circle cx="98" cy="210" r="3" fill="#2b1f17" />
        <circle cx="302" cy="210" r="8" fill="#a07bff" />
        <circle cx="302" cy="210" r="3" fill="#2b1f17" />

        {/* Eyes */}
        <g className="mascot-eye">
          <circle cx="162" cy="200" r="22" fill="url(#eye-grad)" />
          <circle cx="156" cy="194" r="6" fill="#ffffff" opacity="0.85" />
        </g>
        <g className="mascot-eye" style={{ animationDelay: "0.4s" }}>
          <circle cx="238" cy="200" r="22" fill="url(#eye-grad)" />
          <circle cx="232" cy="194" r="6" fill="#ffffff" opacity="0.85" />
        </g>

        {/* Smile */}
        <path
          d="M 175 248 Q 200 270 225 248"
          stroke="#ff8a3d"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />

        {/* Body — PCB shoulder strip */}
        <rect
          x="120"
          y="290"
          width="160"
          height="42"
          rx="14"
          fill="url(#body-grad)"
        />
        {/* PCB traces on body */}
        <g
          stroke="#57fae9"
          strokeOpacity="0.55"
          strokeWidth="1.6"
          strokeLinecap="round"
          fill="none"
        >
          <path d="M 134 312 L 160 312 L 168 304" />
          <path d="M 264 312 L 240 312 L 232 304" />
          <path d="M 184 320 L 216 320" />
        </g>
        {/* SMD-style component squares */}
        <g fill="#ff8a3d">
          <rect x="135" y="298" width="7" height="4" rx="1" />
          <rect x="258" y="298" width="7" height="4" rx="1" />
          <rect x="135" y="320" width="7" height="4" rx="1" />
          <rect x="258" y="320" width="7" height="4" rx="1" />
        </g>
        {/* Chip in the middle */}
        <rect
          x="184"
          y="298"
          width="32"
          height="18"
          rx="3"
          fill="#0e2620"
          stroke="#57fae9"
          strokeOpacity="0.5"
          strokeWidth="1"
        />
        <text
          x="200"
          y="311"
          textAnchor="middle"
          fill="#57fae9"
          fontSize="9"
          fontFamily="ui-monospace, SFMono-Regular, monospace"
          fontWeight="700"
        >
          AI
        </text>

        {/* Orbiting energy dots */}
        <circle cx="80" cy="80" r="5" fill="#a07bff" className="mascot-orbit mascot-orbit-1" />
        <circle cx="330" cy="60" r="7" fill="#57fae9" className="mascot-orbit mascot-orbit-2" />
        <circle cx="70" cy="330" r="4" fill="#ff8a3d" className="mascot-orbit mascot-orbit-3" />
        <circle cx="340" cy="320" r="6" fill="#a07bff" className="mascot-orbit mascot-orbit-4" />
      </svg>

      <style>{`
        @keyframes mascotBlobDrift {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(8px, -6px); }
        }
        @keyframes mascotLedPulse {
          0%, 100% { opacity: 1; transform: scale(1); transform-origin: 200px 78px; }
          50%      { opacity: 0.85; transform: scale(1.15); transform-origin: 200px 78px; }
        }
        @keyframes mascotHalo {
          0%, 100% { opacity: 0.85; transform: scale(1); transform-origin: 200px 70px; }
          50%      { opacity: 1; transform: scale(1.3); transform-origin: 200px 70px; }
        }
        @keyframes mascotEyeBlink {
          0%, 92%, 100% { transform: scaleY(1); }
          96%           { transform: scaleY(0.1); }
        }
        @keyframes mascotOrbit {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(0, -12px); }
        }
        .mascot-blob   { animation: mascotBlobDrift 9s ease-in-out infinite; }
        .mascot-blob-2 { animation-delay: -3s; }
        .mascot-blob-3 { animation-delay: -6s; }
        .mascot-led    { animation: mascotLedPulse 1.8s ease-in-out infinite; }
        .mascot-halo   { animation: mascotHalo 1.8s ease-in-out infinite; }
        .mascot-eye    { transform-origin: center; transform-box: fill-box; animation: mascotEyeBlink 5s ease-in-out infinite; }
        .mascot-orbit  { animation: mascotOrbit 3.5s ease-in-out infinite; }
        .mascot-orbit-1 { animation-delay: 0s; }
        .mascot-orbit-2 { animation-delay: 0.7s; }
        .mascot-orbit-3 { animation-delay: 1.4s; }
        .mascot-orbit-4 { animation-delay: 2.1s; }
        @media (prefers-reduced-motion: reduce) {
          .mascot-blob, .mascot-led, .mascot-halo, .mascot-eye, .mascot-orbit { animation: none; }
        }
      `}</style>
    </div>
  );
}
