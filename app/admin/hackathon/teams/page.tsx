import Link from "next/link";
import { and, asc, count, desc, eq, inArray, notInArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import {
  db,
  hackathonConfig,
  team,
  teamMember,
  user,
  lookingForTeam,
} from "@/lib/db";
import {
  adminAddMember,
  adminCreateTeamWithMembers,
  adminDeleteTeam,
  adminMoveMember,
  adminRemoveMember,
  adminTransferCaptain,
} from "@/lib/actions/admin-hackathon";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Team management · Admin" };

export default async function AdminTeamsPage() {
  await requireRole(["admin", "instructor"]);

  // Member counts as a grouped aggregate, and the set of users who already
  // have a team, as a separate membership query. Correlated subqueries inside
  // db.query mis-resolve table aliases, so we precompute here and merge.
  const [memberCountRows, placedUserIdRows] = await Promise.all([
    db
      .select({ teamId: teamMember.teamId, n: count() })
      .from(teamMember)
      .groupBy(teamMember.teamId),
    db.select({ userId: teamMember.userId }).from(teamMember),
  ]);
  const memberCountMap = new Map(memberCountRows.map((r) => [r.teamId, r.n]));
  const placedUserIds = placedUserIdRows
    .map((r) => r.userId)
    .filter(Boolean);

  const [config, teamsRaw, soloParticipantsRaw, lookingPosts] =
    await Promise.all([
      // upsert the "default" config row, then read back just maxTeamSize.
      db
        .insert(hackathonConfig)
        .values({ id: "default", updatedAt: new Date() })
        .onConflictDoNothing({ target: hackathonConfig.id })
        .then(() =>
          db.query.hackathonConfig.findFirst({
            where: eq(hackathonConfig.id, "default"),
            columns: { maxTeamSize: true },
          }),
        ),
      db.query.team.findMany({
        orderBy: [asc(team.createdAt)],
        with: {
          teamMembers: {
            orderBy: [asc(teamMember.joinedAt)],
            with: {
              user: { columns: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      // Participants (or judges — but most likely participants) with no team.
      db.query.user.findMany({
        where: and(
          inArray(user.role, ["participant", "judge"]),
          placedUserIds.length
            ? notInArray(user.id, placedUserIds)
            : undefined,
        ),
        orderBy: [asc(user.createdAt)],
        columns: { id: true, email: true, name: true, role: true },
        with: {
          lookingForTeams: {
            columns: { skills: true, interests: true },
          },
        },
      }),
      db.query.lookingForTeam.findMany({
        orderBy: [desc(lookingForTeam.updatedAt)],
        columns: { userId: true },
      }),
    ]);

  if (!config) throw new Error("HackathonConfig default row missing");

  // Map Drizzle relation names back to the keys the JSX expects:
  // teamMembers → members, memberCount extra → _count.members,
  // lookingForTeams (many) → lookingForTeam (one).
  const teams = teamsRaw.map((t) => ({
    ...t,
    members: t.teamMembers,
    _count: { members: memberCountMap.get(t.id) ?? 0 },
  }));
  const soloParticipants = soloParticipantsRaw.map((u) => ({
    ...u,
    lookingForTeam: u.lookingForTeams[0] ?? null,
  }));

  const lookingUserIds = new Set(lookingPosts.map((p) => p.userId));
  const totalMembers = teams.reduce((s, t) => s + t._count.members, 0);

  // Build a typeahead-friendly list of solo participants for select inputs.
  const soloOptions = soloParticipants.map((u) => ({
    id: u.id,
    label: `${u.name ?? u.email.split("@")[0]} <${u.email}>${
      lookingUserIds.has(u.id) ? "  ★ looking" : ""
    }`,
  }));

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin/hackathon"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Hackathon ops
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Team placement
      </span>
      <h1 className="text-headline-lg text-on-surface">Manage teams</h1>
      <p className="mt-2 text-on-surface-variant">
        Place kids into teams, move people between teams, or build a roster
        from scratch. These actions ignore the &quot;looking for members&quot;
        gate and the captain hierarchy — but still respect the max-team-size
        config ({config.maxTeamSize}).
      </p>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Teams" value={teams.length} />
        <Stat label="Members placed" value={totalMembers} />
        <Stat label="Solo" value={soloParticipants.length} />
        <Stat label="Max team size" value={config.maxTeamSize} />
      </div>

      {/* Create team with members */}
      <section className="glass-card mt-10 rounded-3xl p-8">
        <h2 className="text-headline-md mb-2 text-on-surface">
          Create a team with members
        </h2>
        <p className="mb-5 text-sm text-on-surface-variant">
          Drop in member emails (comma, newline, or semicolon separated).
          Everyone listed must already have an account. The first listed
          becomes captain unless you set one explicitly.
        </p>
        <form
          action={adminCreateTeamWithMembers}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <label className="md:col-span-5 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Team name
            </span>
            <input
              type="text"
              name="name"
              required
              minLength={2}
              maxLength={60}
              placeholder="Sensor Sages"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-7 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Description (optional)
            </span>
            <input
              type="text"
              name="description"
              maxLength={280}
              placeholder="Smart plant alarm with the ESP32"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-8 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Member emails
            </span>
            <textarea
              name="memberEmails"
              rows={3}
              maxLength={2000}
              placeholder="amy@example.com, ben@example.com&#10;carl@example.com"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-4 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Captain email (optional)
            </span>
            <input
              type="email"
              name="captainEmail"
              maxLength={120}
              placeholder="amy@example.com"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="mono-label block text-on-surface-variant">
              Defaults to first listed
            </span>
          </label>
          <div className="md:col-span-12">
            <SubmitButton
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                group_add
              </span>
              Create team
            </SubmitButton>
          </div>
        </form>
      </section>

      {/* Solo participants — where most placements start */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">
              Solo participants
            </h2>
            <p className="text-sm text-on-surface-variant">
              Pick a team for each one. ★ means they posted on the
              looking-for-team board.
            </p>
          </div>
          <span className="mono-label text-on-surface-variant">
            {soloParticipants.length} unplaced
          </span>
        </div>

        {soloParticipants.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            Everyone is on a team.
          </p>
        ) : (
          <ul className="space-y-2">
            {soloParticipants.map((p) => {
              const looking = lookingUserIds.has(p.id);
              const name = p.name ?? p.email.split("@")[0];
              return (
                <li
                  key={p.id}
                  className="glass-card flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-on-surface">
                          {name}
                        </span>
                        {looking && (
                          <span className="mono-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                            ★ looking
                          </span>
                        )}
                        {p.role === "judge" && (
                          <span className="mono-label rounded-full bg-tertiary/10 px-2 py-0.5 text-tertiary">
                            judge
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-on-surface-variant">
                        {p.email}
                      </div>
                      {p.lookingForTeam?.skills && (
                        <div className="mt-1 line-clamp-1 text-xs text-on-surface-variant">
                          <span className="font-bold">Skills:</span>{" "}
                          {p.lookingForTeam.skills}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Place on a team */}
                  {teams.length === 0 ? (
                    <span className="mono-label text-on-surface-variant">
                      Create a team first
                    </span>
                  ) : (
                    <form
                      action={adminAddMember}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="userId" value={p.id} />
                      <select
                        name="teamId"
                        defaultValue=""
                        required
                        className="rounded-lg border border-white/10 bg-surface-container-low px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="" disabled>
                          Place on team…
                        </option>
                        {teams.map((t) => {
                          const full =
                            t._count.members >= config.maxTeamSize;
                          return (
                            <option
                              key={t.id}
                              value={t.id}
                              disabled={full}
                            >
                              {t.name} ({t._count.members}/
                              {config.maxTeamSize}
                              {full ? " · full" : ""})
                            </option>
                          );
                        })}
                      </select>
                      <SubmitButton
                        className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-2 text-on-primary hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          add
                        </span>
                        Place
                      </SubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Teams + per-team management */}
      <section className="mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">All teams</h2>
          <span className="mono-label text-on-surface-variant">
            {teams.length} team{teams.length === 1 ? "" : "s"}
          </span>
        </div>

        {teams.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No teams yet. Create one above, or wait for participants to
            self-organize at <Link className="text-primary hover:underline" href="/hackathon">/hackathon</Link>.
          </p>
        ) : (
          <ul className="space-y-4">
            {teams.map((t) => {
              const slotsLeft = config.maxTeamSize - t._count.members;
              return (
                <li
                  key={t.id}
                  id={`team-${t.id}`}
                  className="glass-card rounded-2xl p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-headline-md text-on-surface">
                          {t.name}
                        </h3>
                        <span
                          className={`mono-label rounded-full px-2 py-0.5 ${
                            slotsLeft <= 0
                              ? "bg-white/5 text-on-surface-variant"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {t._count.members}/{config.maxTeamSize}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/hackathon/teams/${t.id}`}
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                      >
                        View workspace
                      </Link>
                      <form action={adminDeleteTeam}>
                        <input type="hidden" name="teamId" value={t.id} />
                        <SubmitButton
                          className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            delete
                          </span>
                          Delete team
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  {/* Member roster */}
                  <ul className="mt-4 space-y-2">
                    {t.members.map((m) => {
                      const memberName =
                        m.user.name ?? m.user.email.split("@")[0];
                      return (
                        <li
                          key={m.id}
                          className="flex flex-col gap-2 rounded-xl border border-white/5 bg-surface-container-low px-3 py-2 md:flex-row md:items-center md:justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container/50 text-xs font-medium text-on-surface">
                              {memberName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-on-surface">
                                  {memberName}
                                </span>
                                {m.isCaptain && (
                                  <span className="mono-label inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                                    <span className="material-symbols-outlined text-[10px]">
                                      star
                                    </span>
                                    Captain
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-on-surface-variant">
                                {m.user.email}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {!m.isCaptain && (
                              <form action={adminTransferCaptain}>
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={m.id}
                                />
                                <SubmitButton
                                  className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                                >
                                  <span className="material-symbols-outlined text-[12px]">
                                    star
                                  </span>
                                  Make captain
                                </SubmitButton>
                              </form>
                            )}

                            {teams.length > 1 && (
                              <form
                                action={adminMoveMember}
                                className="flex items-center gap-1"
                              >
                                <input
                                  type="hidden"
                                  name="memberId"
                                  value={m.id}
                                />
                                <select
                                  name="toTeamId"
                                  defaultValue=""
                                  required
                                  className="rounded-lg border border-white/10 bg-surface-container-low px-2 py-1 text-xs text-on-surface focus:border-primary focus:outline-none"
                                >
                                  <option value="" disabled>
                                    Move to…
                                  </option>
                                  {teams
                                    .filter((dest) => dest.id !== t.id)
                                    .map((dest) => {
                                      const full =
                                        dest._count.members >=
                                        config.maxTeamSize;
                                      return (
                                        <option
                                          key={dest.id}
                                          value={dest.id}
                                          disabled={full}
                                        >
                                          {dest.name} (
                                          {dest._count.members}/
                                          {config.maxTeamSize}
                                          {full ? " · full" : ""})
                                        </option>
                                      );
                                    })}
                                </select>
                                <SubmitButton
                                  className="mono-label inline-flex items-center rounded-full bg-white/5 px-2 py-1 text-on-surface-variant hover:bg-white/10"
                                >
                                  →
                                </SubmitButton>
                              </form>
                            )}

                            <form action={adminRemoveMember}>
                              <input
                                type="hidden"
                                name="memberId"
                                value={m.id}
                              />
                              <SubmitButton
                                className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                              >
                                <span className="material-symbols-outlined text-[12px]">
                                  remove
                                </span>
                                Remove
                              </SubmitButton>
                            </form>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Add a solo participant to this team */}
                  {slotsLeft > 0 && soloOptions.length > 0 && (
                    <form
                      action={adminAddMember}
                      className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3"
                    >
                      <input type="hidden" name="teamId" value={t.id} />
                      <label className="mono-label text-on-surface-variant">
                        Add solo participant:
                      </label>
                      <select
                        name="userId"
                        defaultValue=""
                        required
                        className="rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      >
                        <option value="" disabled>
                          Choose…
                        </option>
                        {soloOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-on-primary hover:brightness-110"
                      >
                        <span className="material-symbols-outlined text-[12px]">
                          add
                        </span>
                        Add
                      </SubmitButton>
                    </form>
                  )}
                  {slotsLeft <= 0 && (
                    <p className="mono-label mt-3 border-t border-white/5 pt-3 text-on-surface-variant">
                      Team is full. Raise the max in{" "}
                      <Link
                        className="text-primary hover:underline"
                        href="/admin/hackathon"
                      >
                        settings
                      </Link>{" "}
                      to add more.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="text-headline-md text-on-surface">{value}</div>
      <div className="mono-label mt-1 text-on-surface-variant">{label}</div>
    </div>
  );
}
