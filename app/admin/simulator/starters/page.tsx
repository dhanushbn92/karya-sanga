import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createStarter,
  deleteStarter,
  updateStarter,
} from "@/lib/actions/starters";
import { STARTER_BOARDS } from "@/lib/starter-boards";

export const metadata = { title: "Starters · Admin" };

export default async function StartersAdminPage() {
  await requireRole(["admin", "instructor"]);

  const starters = await db.query.wokwiStarter.findMany({
    orderBy: (s, { asc }) => [asc(s.order), asc(s.createdAt)],
  });

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Wokwi starters
      </span>
      <h1 className="text-headline-lg text-on-surface">Starter library</h1>
      <p className="mt-2 max-w-2xl text-on-surface-variant">
        Curated Wokwi project URLs that kids can fork. They click → opens
        in Wokwi → they save a copy → paste the new URL back into{" "}
        <code className="rounded bg-surface-container px-1.5 py-0.5 text-primary">
          /simulator
        </code>
        &apos;s save form.
      </p>

      <div className="mt-8 rounded-3xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-on-surface-variant">
        <p className="font-medium text-on-surface">Why not fully automatic?</p>
        <p className="mt-1">
          Wokwi doesn&apos;t expose a public API to create projects with
          predefined code/diagram. A starter URL is the closest thing — it
          opens the editor at a known project that the kid forks. The save
          step happens in Wokwi.
        </p>
      </div>

      {/* Create */}
      <section className="glass-card mt-10 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Add a starter
        </h2>
        <form
          action={createStarter}
          className="grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <label className="md:col-span-5 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Label
            </span>
            <input
              type="text"
              name="label"
              required
              minLength={2}
              maxLength={80}
              placeholder="LED blink · ESP32"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-3 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Board
            </span>
            <select
              name="board"
              defaultValue="esp32"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {STARTER_BOARDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Category
            </span>
            <input
              type="text"
              name="category"
              maxLength={60}
              placeholder="blink"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Order
            </span>
            <input
              type="number"
              name="order"
              min={0}
              defaultValue={starters.length}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-12 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Wokwi project URL
            </span>
            <input
              type="url"
              name="wokwiProjectUrl"
              required
              placeholder="https://wokwi.com/projects/..."
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-12 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Description
            </span>
            <textarea
              name="description"
              rows={2}
              maxLength={280}
              placeholder="What does this project do? When should a kid pick it?"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="new-starter-published"
            className="md:col-span-3 flex items-end gap-3 pb-2"
          >
            <input
              id="new-starter-published"
              type="checkbox"
              name="published"
              defaultChecked
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">
              Published
            </span>
          </label>
          <div className="md:col-span-9 flex items-end justify-end">
            <button
              type="submit"
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                add
              </span>
              Add starter
            </button>
          </div>
        </form>
      </section>

      {/* List */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">All starters</h2>
          <span className="mono-label text-on-surface-variant">
            {starters.length} total
          </span>
        </div>

        {starters.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No starters yet. Add the first one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {starters.map((s) => (
              <li key={s.id} className="glass-card rounded-2xl p-5">
                <details>
                  <summary className="flex cursor-pointer flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="mono-label rounded-full bg-white/5 px-2 py-0.5 text-on-surface-variant">
                        #{s.order}
                      </span>
                      <span className="text-base font-medium text-on-surface">
                        {s.label}
                      </span>
                      <span className="mono-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                        {s.board}
                      </span>
                      {s.category && (
                        <span className="mono-label rounded-full bg-tertiary/10 px-2 py-0.5 text-tertiary">
                          {s.category}
                        </span>
                      )}
                      <span
                        className={`mono-label rounded-full px-2 py-0.5 ${
                          s.published
                            ? "bg-primary/10 text-primary"
                            : "bg-white/5 text-on-surface-variant"
                        }`}
                      >
                        {s.published ? "Live" : "Draft"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={s.wokwiProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Open
                        <span className="material-symbols-outlined text-[12px]">
                          open_in_new
                        </span>
                      </a>
                    </div>
                  </summary>

                  {/* Edit form (collapsed by default) */}
                  <form
                    action={updateStarter}
                    className="mt-4 grid grid-cols-1 gap-3 border-t border-white/5 pt-4 md:grid-cols-12"
                  >
                    <input type="hidden" name="id" value={s.id} />
                    <label className="md:col-span-5 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Label
                      </span>
                      <input
                        type="text"
                        name="label"
                        defaultValue={s.label}
                        required
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="md:col-span-3 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Board
                      </span>
                      <select
                        name="board"
                        defaultValue={s.board}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      >
                        {STARTER_BOARDS.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="md:col-span-2 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Category
                      </span>
                      <input
                        type="text"
                        name="category"
                        defaultValue={s.category ?? ""}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="md:col-span-2 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Order
                      </span>
                      <input
                        type="number"
                        name="order"
                        defaultValue={s.order}
                        min={0}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="md:col-span-12 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Wokwi URL
                      </span>
                      <input
                        type="url"
                        name="wokwiProjectUrl"
                        defaultValue={s.wokwiProjectUrl}
                        required
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="md:col-span-12 space-y-1">
                      <span className="mono-label block text-on-surface-variant">
                        Description
                      </span>
                      <textarea
                        name="description"
                        rows={2}
                        defaultValue={s.description ?? ""}
                        className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label
                      htmlFor={`p-${s.id}`}
                      className="md:col-span-3 flex items-center gap-2"
                    >
                      <input
                        id={`p-${s.id}`}
                        type="checkbox"
                        name="published"
                        defaultChecked={s.published}
                        className="h-4 w-4 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
                      />
                      <span className="mono-label text-on-surface-variant">
                        Published
                      </span>
                    </label>
                    <div className="md:col-span-9 flex items-center justify-end gap-2">
                      <button
                        type="submit"
                        className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-on-primary hover:brightness-110"
                      >
                        Save
                      </button>
                    </div>
                  </form>

                  <form action={deleteStarter} className="mt-3 border-t border-white/5 pt-3">
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        delete
                      </span>
                      Delete starter
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
