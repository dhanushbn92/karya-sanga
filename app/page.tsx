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
 * Public landing page (`/`) — vibrant edition.
 *
 * Dark, gradient + glassmorphic marketing page. Renders its own nav (the
 * global light TopNav is hidden on "/" via TopNavGate) and keeps all the
 * live data the previous version showed (workshops, community wall, badges,
 * counts) — only the presentation changed.
 */

const PILLARS = [
  {
    icon: "smart_toy",
    title: "Learn AI, hands-on",
    body: "Call real models from Python, wire up prompts, and make things that think.",
    glow: "#8c5cff",
  },
  {
    icon: "memory",
    title: "Build real electronics",
    body: "ESP32 boards, sensors, motors — on real hardware and in the simulator.",
    glow: "#26d0c2",
  },
  {
    icon: "rocket_launch",
    title: "Ship + earn badges",
    body: "Publish projects to the wall, join a hackathon, and collect badges for what you make.",
    glow: "#b14dff",
  },
];

const STEPS = [
  { n: "01", title: "Join a workshop", body: "Your teacher adds you to a cohort." },
  { n: "02", title: "Learn by building", body: "Lessons + slides + the live simulator." },
  { n: "03", title: "Form a team", body: "Team up for the hackathon and build together." },
  { n: "04", title: "Ship + show off", body: "Publish to the wall, earn badges, keep going." },
];

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
        limit: 8,
      }),
      db.query.badge.findMany({
        orderBy: [asc(badge.category), asc(badge.order)],
        limit: 14,
      }),
      db.$count(team),
      db.$count(user),
    ]);

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
  const wallImages = recentWall
    .map((p) => (p.imagePath ? wallUrls.get(p.imagePath) : undefined))
    .filter((u): u is string => !!u)
    .slice(0, 6);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0a1a] text-[#ece9ff]">
      {/* Background gradient + glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 8% -5%, #34206b 0%, rgba(26,19,64,0.6) 40%, rgba(11,10,26,0) 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-24 h-[36rem] w-[36rem] rounded-full opacity-40 blur-[120px]"
        style={{ background: "radial-gradient(circle, #8c5cff, transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-[42rem] h-[32rem] w-[32rem] rounded-full opacity-30 blur-[120px]"
        style={{ background: "radial-gradient(circle, #26d0c2, transparent 70%)" }}
      />

      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="relative z-20">
        <nav className="mx-auto flex h-20 w-full max-w-[1280px] items-center justify-between px-5 md:px-10">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[15px] font-black text-[#0b0a1a]"
              style={{ background: "linear-gradient(135deg,#8c5cff,#26d0c2)" }}
            >
              क
            </span>
            <span className="text-[17px] tracking-tight">Karya Sanga</span>
          </Link>
          <div className="hidden items-center gap-7 text-sm text-[#b9b3e0] md:flex">
            <Link href="/workshops" className="transition-colors hover:text-white">Workshops</Link>
            <Link href="/gallery" className="transition-colors hover:text-white">Projects</Link>
            <Link href="/wall" className="transition-colors hover:text-white">Show &amp; Tell</Link>
            <Link href="/login" className="transition-colors hover:text-white">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-[0_10px_30px_rgba(140,92,255,0.4)] transition-transform hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg,#8c5cff,#b14dff)" }}
            >
              Join a workshop
            </Link>
          </div>
          <Link
            href="/signup"
            className="rounded-full px-4 py-2 text-sm font-medium text-white md:hidden"
            style={{ background: "linear-gradient(135deg,#8c5cff,#b14dff)" }}
          >
            Join
          </Link>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 px-5 pb-8 pt-10 md:grid-cols-12 md:px-10 md:pt-16">
        <div className="md:col-span-7">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-xs text-[#cdc8f0] backdrop-blur-xl">
            <Image src="/anaadi-logo-mark.png" alt="" aria-hidden="true" width={18} height={18} priority className="h-4 w-auto object-contain" />
            AI + ESP32 · an initiative of Anaadi Foundation
          </div>
          <h1 className="text-[2.75rem] font-extrabold leading-[1.04] tracking-tight md:text-[3.75rem]">
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(115deg,#ffffff 20%,#a78bff 58%,#26d0c2 100%)" }}
            >
              Where curious kids build the future.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#b9b3e0]">
            Pair artificial intelligence with real electronics, ship projects
            you&apos;re proud of, earn badges, and build alongside a community of
            young makers.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="rounded-2xl px-6 py-3.5 font-semibold text-white shadow-[0_14px_36px_rgba(140,92,255,0.42)] transition-transform hover:scale-[1.03]"
              style={{ background: "linear-gradient(135deg,#8c5cff,#b14dff)" }}
            >
              Start building →
            </Link>
            <Link
              href="/gallery"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 font-medium text-[#ece9ff] backdrop-blur-xl transition-colors hover:bg-white/10"
            >
              See the projects
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4">
            {[
              { v: cohorts.length, l: "workshops" },
              { v: builderCount, l: "young builders" },
              { v: teamCount, l: "teams formed" },
            ].map((s) => (
              <div key={s.l}>
                <div
                  className="bg-clip-text text-3xl font-extrabold text-transparent"
                  style={{ backgroundImage: "linear-gradient(120deg,#fff,#a78bff)" }}
                >
                  {s.v}
                </div>
                <div className="mt-0.5 text-sm text-[#8f89bd]">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero visual */}
        <div className="md:col-span-5">
          <div className="relative rounded-[28px] border border-white/12 bg-white/[0.04] p-3 backdrop-blur-xl">
            <div
              className="absolute -inset-px rounded-[28px] opacity-40 blur-md"
              aria-hidden="true"
              style={{ background: "linear-gradient(135deg,#8c5cff55,transparent,#26d0c255)" }}
            />
            <Image
              src="/hero-illustration.png"
              alt="Kids building AI and electronics projects at Karya Sanga"
              width={620}
              height={480}
              priority
              className="relative w-full rounded-[20px] object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Pillars ─────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 py-16 md:px-10 md:py-24">
        <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
          What you&apos;ll do here
        </h2>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.045] p-7 backdrop-blur-xl transition-transform hover:-translate-y-1"
            >
              <div
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-40 blur-2xl transition-opacity group-hover:opacity-70"
                aria-hidden="true"
                style={{ background: `radial-gradient(circle, ${p.glow}, transparent 70%)` }}
              />
              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                style={{ background: `linear-gradient(135deg, ${p.glow}, #b14dff)` }}
              >
                <span className="material-symbols-outlined text-[24px]">{p.icon}</span>
              </span>
              <h3 className="relative mt-5 text-xl font-semibold">{p.title}</h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-[#b9b3e0]">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it runs ─────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-16 md:px-10 md:pb-24">
        <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How a workshop runs</h2>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl">
              <div
                className="bg-clip-text text-2xl font-black text-transparent"
                style={{ backgroundImage: "linear-gradient(120deg,#8c5cff,#26d0c2)" }}
              >
                {s.n}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#b9b3e0]">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live workshops ──────────────────────────────────── */}
      {cohorts.length > 0 && (
        <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-16 md:px-10 md:pb-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Live workshops</h2>
            <Link href="/workshops" className="text-sm text-[#b9b3e0] transition-colors hover:text-white">
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((c) => (
              <div key={c.id} className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{c.name}</h3>
                  {c.current && (
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg,#8c5cff,#b14dff)" }}
                    >
                      Running now
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#b9b3e0]">{c.description}</p>
                )}
                <div className="mt-5 flex gap-6 text-sm text-[#8f89bd]">
                  <span><span className="font-semibold text-[#cdc8f0]">{c._count.members}</span> builders</span>
                  <span><span className="font-semibold text-[#cdc8f0]">{c._count.projects}</span> projects</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Community wall ──────────────────────────────────── */}
      {wallImages.length > 0 && (
        <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-16 md:px-10 md:pb-24">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Made by the community</h2>
            <Link href="/wall" className="text-sm text-[#b9b3e0] transition-colors hover:text-white">
              Show &amp; Tell →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {wallImages.map((url, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Community project" className="h-full w-full object-cover transition-transform duration-500 hover:scale-110" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Badges ──────────────────────────────────────────── */}
      {badges.length > 0 && (
        <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-16 md:px-10 md:pb-24">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Badges to collect</h2>
          <p className="mt-2 max-w-xl text-[#b9b3e0]">Earn them for what you build, learn, and share.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {badges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-2.5 backdrop-blur-xl"
                title={b.description}
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg,#8c5cff,#26d0c2)" }}
                >
                  <span className="material-symbols-outlined text-[18px]">{b.icon}</span>
                </span>
                <span className="text-sm font-medium">{b.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Final CTA ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto w-full max-w-[1280px] px-5 pb-24 md:px-10">
        <div className="relative overflow-hidden rounded-[32px] border border-white/12 p-10 text-center md:p-16"
          style={{ background: "linear-gradient(135deg, rgba(140,92,255,0.22), rgba(38,208,194,0.14))" }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle,#8c5cff,transparent 70%)" }}
          />
          <h2 className="relative text-3xl font-extrabold tracking-tight md:text-5xl">
            Come build with us.
          </h2>
          <p className="relative mx-auto mt-4 max-w-lg text-lg text-[#cdc8f0]">
            Anaadi Foundation runs Karya Sanga as a community. Workshops fill
            quickly — make an account and your teacher will add you.
          </p>
          <Link
            href="/signup"
            className="relative mt-8 inline-block rounded-2xl px-8 py-4 font-semibold text-white shadow-[0_16px_40px_rgba(140,92,255,0.45)] transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg,#8c5cff,#b14dff)" }}
          >
            Create your account
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/8">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col items-center gap-3 px-5 py-10 text-center md:px-10">
          <div className="flex items-center gap-2.5">
            <Image src="/anaadi-logo-mark.png" alt="" aria-hidden="true" width={22} height={22} className="h-5 w-auto object-contain opacity-80" />
            <span className="text-sm font-medium text-[#b9b3e0]">Karya Sanga · An initiative of Anaadi Foundation</span>
          </div>
          <p className="text-xs text-[#6f6a95]">
            © {new Date().getFullYear()} Anaadi Foundation. Built with curiosity.
          </p>
        </div>
      </footer>
    </div>
  );
}
