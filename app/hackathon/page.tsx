import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "../../generated/prisma/client";
import { getHackathonConfig } from "@/lib/hackathon-config";
import {
  createTeam,
  joinTeam,
  postLookingForTeam,
  removeLookingForTeam,
} from "@/lib/actions/hackathon";
import { Mascot } from "@/components/ui/mascot";
import { SpeechBubble } from "@/components/ui/speech-bubble";
import { MessageButton } from "@/components/ui/message-button";

export const metadata = { title: "Hackathon · Yukti AI Labs" };

/**
 * Hackathon home (locked 2026-06-27).
 *
 * Sections:
 *   1. Mascot hero — greeting + deadline pill + workshop chip
 *   2. Your team / form-or-join row — depending on state
 *   3. Teams formed in this workshop — every team with member chips
 *   4. People in this workshop — every participant with their team chip
 *
 * Workshop scoping: every list is filtered to the user's workshops (primary
 * cohortId + every UserCohort secondary row). Admins see everything.
 */
export default async function HackathonPage() {
  const user = await requireUser();
  const isMod = user.role === "admin" || user.role === "instructor";

  const userWithCohort = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      cohortId: true,
      cohort: { select: { id: true, name: true } },
      workshops: { select: { cohortId: true } },
    },
  });
  const myCohortId = userWithCohort?.cohortId ?? null;
  const myCohort = userWithCohort?.cohort ?? null;
  const myCohortIds = Array.from(
    new Set(
      [
        ...(myCohortId ? [myCohortId] : []),
        ...(userWithCohort?.workshops?.map((w) => w.cohortId) ?? []),
      ].filter((id): id is string => !!id),
    ),
  );

  // Short-circuit the team + people queries when the user is in zero
  // workshops (and isn't a mod). The no-cohort gate is already rendered
  // below so we don't need any rows for those sections.
  const hasScope = isMod || myCohortIds.length > 0;
  const teamWhere = isMod
    ? {}
    : { cohortId: { in: myCohortIds } };
  const userWhere = isMod
    ? { role: { in: ["participant", "judge"] as Role[] } }
    : {
        role: { in: ["participant", "judge"] as Role[] },
        OR: [
          { cohortId: { in: myCohortIds } },
          { workshops: { some: { cohortId: { in: myCohortIds } } } },
        ],
      };

  const [
    config,
    myMembership,
    allTeams,
    workshopPeople,
    lookingPosts,
    myLookingPost,
  ] = await Promise.all([
    getHackathonConfig(myCohortId),
    prisma.teamMember.findUnique({
      where: { userId: user.id },
      include: {
        team: {
          include: {
            cohort: { select: { id: true, name: true } },
            submission: { select: { id: true, locked: true } },
            members: {
              orderBy: { joinedAt: "asc" },
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
            _count: { select: { members: true } },
          },
        },
      },
    }),
    hasScope
      ? prisma.team.findMany({
          where: teamWhere,
          include: {
            cohort: { select: { id: true, name: true } },
            members: {
              orderBy: { joinedAt: "asc" },
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
            _count: { select: { members: true } },
          },
          orderBy: { createdAt: "asc" },
          take: 100,
        })
      : Promise.resolve([]),
    hasScope
      ? prisma.user.findMany({
          where: userWhere,
          orderBy: [{ name: "asc" }, { email: "asc" }],
          select: {
            id: true,
            name: true,
            email: true,
            handle: true,
            mentorAvailable: true,
            cohort: { select: { id: true, name: true } },
            teamMembership: {
              select: {
                isCaptain: true,
                team: {
                  select: {
                    id: true,
                    name: true,
                    cohortId: true,
                  },
                },
              },
            },
          },
          take: 300,
        })
      : Promise.resolve([]),
    prisma.lookingForTeam.findMany({
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.lookingForTeam.findUnique({
      where: { userId: user.id },
    }),
  ]);

  const onTeam = !!myMembership;
  const lookingByUserId = new Map(
    lookingPosts.map((p) => [p.user.id, p] as const),
  );

  // Split people into "on a team" and "solo" for the bottom list.
  const peopleOnTeam = workshopPeople.filter((p) => p.teamMembership);
  const peopleSolo = workshopPeople.filter((p) => !p.teamMembership);

  // Deadline status
  let deadline:
    | { label: string; tone: "open" | "soon" | "closed"; copy: string }
    | null = null;
  if (config.submitBy) {
    const ms = new Date(config.submitBy).getTime() - Date.now();
    if (ms < 0) {
      deadline = {
        label: "Closed",
        tone: "closed",
        copy: `Closed ${new Date(config.submitBy).toLocaleString()}`,
      };
    } else if (ms < 1000 * 60 * 60 * 48) {
      const hours = Math.floor(ms / (1000 * 60 * 60));
      deadline = {
        label: "Closing soon",
        tone: "soon",
        copy: `${hours}h until deadline`,
      };
    } else {
      const days = Math.floor(ms / (1000 * 60 * 60 * 24));
      deadline = {
        label: "Open",
        tone: "open",
        copy: `${days}d until deadline`,
      };
    }
  }

  const displayName = user.name ?? user.email.split("@")[0];

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-10">
      {/* ───────────────────────────────────────────────────────────
       * 1. MASCOT HERO
       * ─────────────────────────────────────────────────────────── */}
      <section className="relative mb-10 overflow-hidden rounded-[36px] border-2 border-outline-variant bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary-fixed/50 blur-3xl" />
          <div className="absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-tertiary-fixed/40 blur-3xl" />
        </div>
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-12 md:items-center">
          <div className="flex items-start gap-4 md:col-span-7">
            <Mascot pose="cheer" size={120} className="shrink-0" />
            <div className="pt-2">
              <SpeechBubble direction="left" tone="primary" className="max-w-md">
                {onTeam
                  ? `You're on Team ${myMembership!.team.name}! Build something awesome.`
                  : "Let's form your hackathon team!"}
              </SpeechBubble>
              <h1 className="text-display-md mt-3 text-on-surface">
                Hackathon
              </h1>
              <p className="mt-1 text-on-surface-variant">
                Teams of up to {config.maxTeamSize}. Build a project, share it.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 md:col-span-5 md:items-end">
            {/* Status chips */}
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              {myCohort && (
                <Link
                  href={`/cohorts/${myCohort.id}`}
                  className="press-soft inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-secondary-container"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    home_storage
                  </span>
                  {myCohort.name}
                </Link>
              )}
              {deadline ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                    deadline.tone === "open"
                      ? "bg-primary-fixed text-on-primary-fixed-variant"
                      : deadline.tone === "soon"
                        ? "bg-secondary text-on-secondary"
                        : "bg-surface-container text-on-surface-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {deadline.tone === "closed" ? "lock" : "schedule"}
                  </span>
                  {deadline.label} · {deadline.copy}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">
                    schedule
                  </span>
                  Deadline TBA
                </span>
              )}
            </div>
            <Link
              href="/hackathon/leaderboard"
              className="press-soft inline-flex items-center justify-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                emoji_events
              </span>
              Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────
       * No cohort gate
       * ─────────────────────────────────────────────────────────── */}
      {myCohortIds.length === 0 && !isMod && !onTeam && (
        <section className="mb-10 flex flex-col items-center gap-4 rounded-[28px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
          <Mascot pose="think" size={120} />
          <h2 className="text-headline-md text-on-surface">
            Join a workshop first.
          </h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            Hackathons happen inside workshops. Pick one and you&apos;ll be
            able to form your team here.
          </p>
          <Link
            href="/workshops"
            className="press-soft sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
          >
            <span className="material-symbols-outlined text-[16px]">
              arrow_forward
            </span>
            See workshops
          </Link>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
       * 2. YOUR TEAM (if on one)
       * ─────────────────────────────────────────────────────────── */}
      {onTeam && myMembership && (
        <section
          className="press-soft mb-10 overflow-hidden rounded-[32px] border-2 border-primary bg-primary-fixed p-6 md:p-8"
          style={{
            boxShadow: "0 8px 0 0 #7a2900, 0 24px 48px -16px rgba(167,58,0,0.35)",
          }}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            <div className="md:col-span-8">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-0.5 text-xs font-black uppercase tracking-widest text-primary">
                  <span className="material-symbols-outlined text-[14px]">
                    workspaces
                  </span>
                  Your team
                </span>
                {myMembership.isCaptain && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                    <span className="material-symbols-outlined text-[12px]">
                      star
                    </span>
                    Captain
                  </span>
                )}
                <span className="rounded-full bg-card/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-primary-fixed-variant">
                  {myMembership.team._count.members} / {config.maxTeamSize}{" "}
                  members
                </span>
              </div>
              <h2 className="text-display-md text-on-primary-fixed">
                {myMembership.team.name}
              </h2>
              {myMembership.team.description && (
                <p className="mt-1 max-w-2xl text-sm text-on-primary-fixed-variant">
                  {myMembership.team.description}
                </p>
              )}
              <div className="mt-3 text-xs font-bold text-on-primary-fixed-variant">
                {myMembership.team.submission ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      check_circle
                    </span>
                    Submission saved
                    {myMembership.team.submission.locked
                      ? " · locked"
                      : " · you can keep editing"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">
                      pending
                    </span>
                    No submission yet
                  </span>
                )}
              </div>
              <div className="mt-4 flex -space-x-2">
                {myMembership.team.members.map((m) => (
                  <Avatar
                    key={m.id}
                    name={m.user.name ?? m.user.email.split("@")[0]}
                    isCaptain={m.isCaptain}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2 md:col-span-4 md:justify-end">
              <Link
                href={`/hackathon/teams/${myMembership.teamId}`}
                className="press-soft inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-black uppercase tracking-wide text-on-primary"
                style={{ boxShadow: "0 5px 0 0 #531800" }}
              >
                Open workspace
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </Link>
              <Link
                href={`/hackathon/teams/${myMembership.teamId}/submit`}
                className="press-soft inline-flex items-center gap-2 rounded-full border-2 border-on-primary-fixed-variant/40 px-4 py-2.5 text-sm font-bold text-on-primary-fixed-variant"
              >
                <span className="material-symbols-outlined text-[16px]">
                  rocket_launch
                </span>
                Submit
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
       * 3. CREATE TEAM (if not on one)
       * ─────────────────────────────────────────────────────────── */}
      {!onTeam && (myCohortIds.length > 0 || isMod) && (
        <section className="mb-10 rounded-[28px] border-2 border-outline-variant bg-card p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-on-primary">
              <span className="material-symbols-outlined">group_add</span>
            </span>
            <div>
              <h2 className="text-base font-black text-on-surface">
                Start your own team
              </h2>
              <p className="text-xs text-on-surface-variant">
                You&apos;ll be the captain. You can rename or close the team
                from the workspace later.
              </p>
            </div>
          </div>
          <form
            action={createTeam}
            className="grid grid-cols-1 gap-3 md:grid-cols-12"
          >
            <label className="md:col-span-4 space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Team name
              </span>
              <input
                type="text"
                name="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="Sensor Sages"
                className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <label className="md:col-span-6 space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                What you&apos;ll build (optional)
              </span>
              <input
                type="text"
                name="description"
                maxLength={280}
                placeholder="Smart plant alarm with the ESP32"
                className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <div className="md:col-span-2 flex items-end">
              <button
                type="submit"
                className="press-soft inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-black uppercase tracking-wide text-on-primary"
                style={{ boxShadow: "0 5px 0 0 #531800" }}
              >
                Create
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
       * 4. TEAMS FORMED
       * ─────────────────────────────────────────────────────────── */}
      {(myCohortIds.length > 0 || isMod) && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-headline-md text-on-surface">
                Teams formed
              </h2>
              <p className="text-sm text-on-surface-variant">
                {allTeams.length === 0
                  ? "No teams yet — be the first to start one."
                  : "Every team in your workshop and who's on it."}
              </p>
            </div>
            <span className="rounded-full bg-surface-container px-3 py-1 text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              {allTeams.length} team
              {allTeams.length === 1 ? "" : "s"}
            </span>
          </div>
          {allTeams.length === 0 ? (
            <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
              <p className="text-sm text-on-surface-variant">
                When someone forms a team, it shows up here.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allTeams.map((t) => {
                const slotsLeft = config.maxTeamSize - t._count.members;
                const isMine = t.id === myMembership?.teamId;
                return (
                  <li
                    key={t.id}
                    className={`press-soft soft-card flex flex-col gap-3 p-5 ${
                      isMine ? "ring-4 ring-primary/30" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-black leading-tight text-on-surface">
                          {t.name}
                        </h3>
                        {isMod && t.cohort?.name && (
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                            {t.cohort.name}
                          </div>
                        )}
                      </div>
                      {slotsLeft > 0 ? (
                        <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-on-secondary-container">
                          {slotsLeft} spot{slotsLeft === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">
                          Full
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="line-clamp-2 text-sm text-on-surface-variant">
                        {t.description}
                      </p>
                    )}
                    {/* Member chips */}
                    <ul className="flex flex-wrap gap-1.5">
                      {t.members.map((m) => {
                        const n =
                          m.user.name ?? m.user.email.split("@")[0];
                        return (
                          <li
                            key={m.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface"
                            title={n}
                          >
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-container text-[10px] font-black text-on-secondary-container">
                              {n.charAt(0).toUpperCase()}
                            </span>
                            {n.length > 14 ? `${n.slice(0, 12)}…` : n}
                            {m.isCaptain && (
                              <span className="material-symbols-outlined text-[12px] text-primary">
                                star
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] font-bold text-on-surface-variant">
                        {t._count.members} / {config.maxTeamSize} members
                      </span>
                      {isMine ? (
                        <Link
                          href={`/hackathon/teams/${t.id}`}
                          className="press-soft inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wider text-on-primary"
                          style={{ boxShadow: "0 3px 0 0 #531800" }}
                        >
                          Open
                          <span className="material-symbols-outlined text-[14px]">
                            arrow_forward
                          </span>
                        </Link>
                      ) : !onTeam && t.lookingForMembers && slotsLeft > 0 ? (
                        <form action={joinTeam}>
                          <input type="hidden" name="teamId" value={t.id} />
                          <button
                            type="submit"
                            className="press-soft inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-black uppercase tracking-wider text-on-primary"
                            style={{ boxShadow: "0 3px 0 0 #531800" }}
                          >
                            Join
                            <span className="material-symbols-outlined text-[14px]">
                              add
                            </span>
                          </button>
                        </form>
                      ) : (
                        <span className="text-[10px] font-bold text-on-surface-variant">
                          {t.lookingForMembers
                            ? ""
                            : "not looking right now"}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
       * 5. PEOPLE IN THIS WORKSHOP
       * ─────────────────────────────────────────────────────────── */}
      {(myCohortIds.length > 0 || isMod) && (
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-headline-md text-on-surface">
                People in this workshop
              </h2>
              <p className="text-sm text-on-surface-variant">
                Everyone&apos;s team status at a glance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-secondary-container px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-secondary-container">
                {peopleOnTeam.length} on a team
              </span>
              <span className="rounded-full bg-tertiary-fixed px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-on-tertiary-fixed">
                {peopleSolo.length} solo
              </span>
            </div>
          </div>

          {workshopPeople.length === 0 ? (
            <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
              <p className="text-sm text-on-surface-variant">
                No one in the workshop yet.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border-2 border-outline-variant bg-card">
              <div className="hidden grid-cols-12 gap-3 border-b-2 border-outline-variant bg-surface-container-lowest px-5 py-2 text-[10px] font-black uppercase tracking-widest text-on-surface-variant md:grid">
                <div className="col-span-5">Person</div>
                <div className="col-span-4">Team</div>
                <div className="col-span-3 text-right">Status</div>
              </div>
              <ul className="divide-y-2 divide-outline-variant">
                {workshopPeople.map((p, idx) => {
                  const name = p.name ?? p.email.split("@")[0];
                  const initial = name.charAt(0).toUpperCase();
                  const team = p.teamMembership?.team;
                  const looking = lookingByUserId.get(p.id);
                  const isYou = p.id === user.id;
                  return (
                    <li
                      key={p.id}
                      className={`grid grid-cols-1 gap-3 px-5 py-3 transition-colors md:grid-cols-12 md:items-center ${
                        idx % 2 === 1 ? "bg-surface-container-lowest/40" : ""
                      } ${isYou ? "ring-2 ring-inset ring-primary/30" : ""}`}
                    >
                      <div className="md:col-span-5 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-container text-sm font-black text-on-secondary-container">
                          {initial}
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {p.handle ? (
                              <Link
                                href={`/builders/${p.handle}`}
                                className="truncate text-sm font-bold text-on-surface hover:text-primary"
                              >
                                {name}
                              </Link>
                            ) : (
                              <span className="truncate text-sm font-bold text-on-surface">
                                {name}
                              </span>
                            )}
                            {isYou && (
                              <span className="rounded-full bg-secondary-container px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-on-secondary-container">
                                you
                              </span>
                            )}
                            {p.mentorAvailable && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-tertiary-fixed px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-on-tertiary-fixed">
                                <span className="material-symbols-outlined text-[10px]">
                                  handshake
                                </span>
                                Mentor
                              </span>
                            )}
                          </div>
                          {isMod && p.cohort?.name && (
                            <div className="truncate text-[10px] text-on-surface-variant">
                              {p.cohort.name}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-4">
                        {team ? (
                          <Link
                            href={`/hackathon/teams/${team.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-primary-fixed px-2.5 py-1 text-xs font-black text-on-primary-fixed-variant hover:underline"
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              workspaces
                            </span>
                            {team.name}
                            {p.teamMembership?.isCaptain && (
                              <span className="material-symbols-outlined text-[12px]">
                                star
                              </span>
                            )}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px]">
                              person
                            </span>
                            No team yet
                          </span>
                        )}
                      </div>
                      <div className="md:col-span-3 flex items-center gap-2 md:justify-end">
                        {looking ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-on-secondary-container"
                            title={`${looking.skills}${looking.interests ? ` · ${looking.interests}` : ""}`}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              campaign
                            </span>
                            Looking for a team
                          </span>
                        ) : team ? (
                          <span className="text-[10px] font-bold text-on-surface-variant">
                            {p.teamMembership?.isCaptain
                              ? "Captain"
                              : "Member"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant/60">
                            —
                          </span>
                        )}
                        {!isYou && (
                          <MessageButton
                            toUserId={p.id}
                            currentUserId={user.id}
                            size="icon"
                          />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ───────────────────────────────────────────────────────────
       * 6. SOLO BOARD COMPOSER — let people post that they're looking
       * ─────────────────────────────────────────────────────────── */}
      {!onTeam && (myCohortIds.length > 0 || isMod) && (
        <section className="rounded-[28px] border-2 border-outline-variant bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-tertiary text-on-tertiary">
              <span className="material-symbols-outlined">campaign</span>
            </span>
            <h3 className="text-base font-black text-on-surface">
              {myLookingPost
                ? "Update your looking-for-team post"
                : "Looking for a team? Post that here"}
            </h3>
          </div>
          <form
            action={postLookingForTeam}
            className="grid grid-cols-1 gap-3 md:grid-cols-12"
          >
            <label className="md:col-span-12 space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Skills
              </span>
              <input
                type="text"
                name="skills"
                required
                minLength={2}
                maxLength={280}
                defaultValue={myLookingPost?.skills ?? ""}
                placeholder="Arduino C++, basic Python, a bit of Figma"
                className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <label className="md:col-span-7 space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                What you&apos;d like to build (optional)
              </span>
              <input
                type="text"
                name="interests"
                maxLength={280}
                defaultValue={myLookingPost?.interests ?? ""}
                placeholder="Something with sound, plants, or robotics"
                className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <label className="md:col-span-5 space-y-1">
              <span className="block text-[10px] font-black uppercase tracking-widest text-on-surface-variant">
                Contact (optional)
              </span>
              <input
                type="text"
                name="contact"
                maxLength={120}
                defaultValue={myLookingPost?.contact ?? ""}
                placeholder="Discord handle / email"
                className="w-full rounded-2xl border-2 border-outline-variant bg-surface-container-lowest px-4 py-3 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
            </label>
            <div className="md:col-span-12 flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                className="press-soft inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-black uppercase tracking-wide text-on-primary"
                style={{ boxShadow: "0 4px 0 0 #531800" }}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {myLookingPost ? "save" : "campaign"}
                </span>
                {myLookingPost ? "Update post" : "Post"}
              </button>
              {myLookingPost && (
                <form action={removeLookingForTeam}>
                  <button
                    type="submit"
                    className="press-soft inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant hover:border-destructive hover:text-destructive"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      delete
                    </span>
                    Remove
                  </button>
                </form>
              )}
            </div>
          </form>
        </section>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function Avatar({ name, isCaptain }: { name: string; isCaptain: boolean }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-card text-sm font-black text-on-surface"
      title={isCaptain ? `${name} · captain` : name}
    >
      {initial}
      {isCaptain && (
        <span className="material-symbols-outlined absolute -bottom-1 -right-1 rounded-full bg-secondary p-0.5 text-[10px] text-on-secondary">
          star
        </span>
      )}
    </div>
  );
}
