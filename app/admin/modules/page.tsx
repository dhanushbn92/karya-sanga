import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { createModule } from "@/lib/actions/admin-lessons";

export const metadata = { title: "Chapters · Admin" };

export default async function ModulesAdminPage() {
  await requireRole(["admin", "instructor"]);

  const moduleRows = await db.query.module.findMany({
    orderBy: (m, { asc }) => [asc(m.order)],
    with: { lessons: { columns: { id: true } } },
  });

  // Translate _count.lessons via fetched-rows length.
  const modules = moduleRows.map((m) => ({
    ...m,
    _count: { lessons: m.lessons.length },
  }));

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Authoring
      </span>
      <h1 className="text-headline-lg text-on-surface">Chapters</h1>
      <p className="mt-2 text-on-surface-variant">
        Group lessons into chapters. Publish a chapter to make its lessons
        visible to participants.
      </p>

      {/* Create chapter form */}
      <section className="glass-card mt-10 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Create a chapter
        </h2>
        <form action={createModule} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <label className="md:col-span-7 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Title
            </span>
            <input
              type="text"
              name="title"
              required
              placeholder="Chapter 01 · Components & Circuits"
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
              defaultValue={modules.length}
              min={0}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="new-module-published"
            className="md:col-span-3 flex items-end gap-3 pb-2"
          >
            <input
              id="new-module-published"
              type="checkbox"
              name="published"
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">Publish</span>
          </label>
          <label className="md:col-span-12 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Description
            </span>
            <textarea
              name="description"
              rows={2}
              placeholder="What kids will learn in this chapter"
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12">
            <button
              type="submit"
              className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                add
              </span>
              Create chapter
            </button>
          </div>
        </form>
      </section>

      {/* Chapter list */}
      <section className="mt-10">
        <h2 className="text-headline-md mb-4 text-on-surface">All chapters</h2>
        {modules.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No chapters yet. Create the first one above.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {modules.map((m) => (
              <Link
                key={m.id}
                href={`/admin/modules/${m.id}`}
                className="glass-card group block rounded-2xl p-6 transition-colors hover:border-primary/30"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-headline-md text-on-surface group-hover:text-primary">
                    {m.title}
                  </h3>
                  <span
                    className={`mono-label rounded-full px-2 py-0.5 ${
                      m.published
                        ? "bg-primary/10 text-primary"
                        : "bg-white/5 text-on-surface-variant"
                    }`}
                  >
                    {m.published ? "Live" : "Draft"}
                  </span>
                </div>
                {m.description && (
                  <p className="mb-3 text-sm text-on-surface-variant line-clamp-2">
                    {m.description}
                  </p>
                )}
                <div className="mono-label text-on-surface-variant">
                  {m._count.lessons} lesson{m._count.lessons === 1 ? "" : "s"}
                  {" · "}
                  Order {m.order}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
