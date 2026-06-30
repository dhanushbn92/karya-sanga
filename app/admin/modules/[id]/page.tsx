import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db, module as moduleTable } from "@/lib/db";
import {
  createLesson,
  deleteLesson,
  deleteModule,
  setLessonPublished,
  updateLesson,
  updateModule,
} from "@/lib/actions/admin-lessons";
import { UploadSlideFile } from "@/components/lessons/upload-slide-file";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Edit module · Admin" };

export default async function ModuleEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireRole(["admin", "instructor"]);
  const { id } = await params;

  const mod = await db.query.module.findFirst({
    where: eq(moduleTable.id, id),
    with: {
      lessons: { orderBy: (l, { asc }) => [asc(l.order)] },
    },
  });
  if (!mod) notFound();

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin/modules"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← All chapters
      </Link>
      <h1 className="text-headline-lg text-on-surface">{mod.title}</h1>

      {/* Chapter edit form */}
      <section className="glass-card mt-8 rounded-3xl p-8">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Chapter settings
        </h2>
        <form action={updateModule} className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <input type="hidden" name="id" value={mod.id} />
          <label className="md:col-span-7 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Title
            </span>
            <input
              type="text"
              name="title"
              defaultValue={mod.title}
              required
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Order
            </span>
            <input
              type="number"
              name="order"
              defaultValue={mod.order}
              min={0}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <label
            htmlFor="module-published"
            className="md:col-span-3 flex items-end gap-3 pb-2"
          >
            <input
              id="module-published"
              type="checkbox"
              name="published"
              defaultChecked={mod.published}
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="mono-label text-on-surface-variant">
              Published
            </span>
          </label>
          <label className="md:col-span-12 space-y-2">
            <span className="mono-label block text-on-surface-variant">
              Description
            </span>
            <textarea
              name="description"
              rows={2}
              defaultValue={mod.description ?? ""}
              className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </label>
          <div className="md:col-span-12 flex items-center justify-between gap-4">
            <SubmitButton
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
            >
              <span className="material-symbols-outlined text-[18px]">
                save
              </span>
              Save changes
            </SubmitButton>
          </div>
        </form>

        <form action={deleteModule} className="mt-6 border-t border-white/10 pt-4">
          <input type="hidden" name="id" value={mod.id} />
          <SubmitButton
            className="mono-label inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-1.5 text-destructive transition-colors hover:bg-destructive/10"
          >
            <span className="material-symbols-outlined text-[14px]">
              delete
            </span>
            Delete module + all lessons
          </SubmitButton>
        </form>
      </section>

      {/* Lesson list + create */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">Lessons</h2>
          <span className="mono-label text-on-surface-variant">
            {mod.lessons.length} total
          </span>
        </div>

        {mod.lessons.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            No lessons yet. Add one below.
          </p>
        ) : (
          <ul className="space-y-3">
            {mod.lessons.map((l, i) => (
              <li key={l.id} className="glass-card rounded-2xl p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mono-label text-on-surface-variant">
                        #{String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-base font-medium text-on-surface">
                        {l.title}
                      </span>
                      {l.difficulty && (
                        <span className="mono-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                          {l.difficulty}
                        </span>
                      )}
                      <span
                        className={`mono-label rounded-full px-2 py-0.5 ${
                          l.published
                            ? "bg-primary/10 text-primary"
                            : "bg-white/5 text-on-surface-variant"
                        }`}
                      >
                        {l.published ? "Live" : "Draft"}
                      </span>
                    </div>
                    {l.summary && (
                      <p className="mt-1 text-sm text-on-surface-variant line-clamp-1">
                        {l.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {l.wokwiProjectUrl && (
                      <a
                        href={l.wokwiProjectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                      >
                        Wokwi
                        <span className="material-symbols-outlined text-[12px]">
                          open_in_new
                        </span>
                      </a>
                    )}
                    <Link
                      href={`/lessons/${l.id}`}
                      className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                    >
                      Preview
                    </Link>
                    {/* One-click publish toggle */}
                    <form action={setLessonPublished}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="moduleId" value={mod.id} />
                      <input
                        type="hidden"
                        name="published"
                        value={l.published ? "" : "on"}
                      />
                      <SubmitButton
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {l.published ? "Unpublish" : "Publish"}
                      </SubmitButton>
                    </form>
                  </div>
                </div>

                {/* Edit (collapsible) */}
                <details className="mt-4 border-t border-white/5 pt-4">
                  <summary className="mono-label cursor-pointer text-on-surface-variant hover:text-primary">
                    Edit
                  </summary>
                  <form
                    action={updateLesson}
                    className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-12"
                  >
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="moduleId" value={mod.id} />
                    <label className="md:col-span-8 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        Title
                      </span>
                      <input
                        type="text"
                        name="title"
                        defaultValue={l.title}
                        required
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
                        defaultValue={l.order}
                        min={0}
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="md:col-span-2 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        Difficulty
                      </span>
                      <select
                        name="difficulty"
                        defaultValue={l.difficulty ?? ""}
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      >
                        <option value="">—</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </label>
                    <label className="md:col-span-12 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        Summary
                      </span>
                      <input
                        type="text"
                        name="summary"
                        defaultValue={l.summary ?? ""}
                        placeholder="One-line description"
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="md:col-span-12 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        Body (Markdown — supports GFM, code blocks, and slide
                        separators)
                      </span>
                      <textarea
                        name="body"
                        rows={10}
                        defaultValue={l.body ?? ""}
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="md:col-span-6 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        Wokwi project URL (optional · opens in a new tab)
                      </span>
                      <input
                        type="url"
                        name="wokwiProjectUrl"
                        defaultValue={l.wokwiProjectUrl ?? ""}
                        placeholder="https://wokwi.com/projects/123456789"
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label className="md:col-span-3 space-y-2">
                      <span className="mono-label block text-on-surface-variant">
                        External slides URL (optional)
                      </span>
                      <input
                        type="url"
                        name="slidesUrl"
                        defaultValue={l.slidesUrl ?? ""}
                        placeholder="Google Slides / PDF link"
                        className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </label>
                    <label
                      htmlFor={`lesson-published-${l.id}`}
                      className="md:col-span-3 flex items-end gap-3 pb-2"
                    >
                      <input
                        id={`lesson-published-${l.id}`}
                        type="checkbox"
                        name="published"
                        defaultChecked={l.published}
                        className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
                      />
                      <span className="mono-label text-on-surface-variant">
                        Published
                      </span>
                    </label>
                    <div className="md:col-span-12">
                      <SubmitButton
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          save
                        </span>
                        Save changes
                      </SubmitButton>
                    </div>
                  </form>

                  {/* Delete lesson */}
                  <form action={deleteLesson} className="mt-4">
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="moduleId" value={mod.id} />
                    <SubmitButton
                      className="mono-label inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-1.5 text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        delete
                      </span>
                      Delete
                    </SubmitButton>
                  </form>
                </details>

                {/* Slide file uploader, per-lesson */}
                <div className="mt-4 border-t border-white/5 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="mono-label text-on-surface-variant">
                      Slides deck (PDF / PPT / PPTX)
                    </span>
                    {l.slideFilePath && (
                      <Link
                        href={`/lessons/${l.id}/deck`}
                        target="_blank"
                        rel="noopener"
                        className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary"
                      >
                        Open viewer
                        <span className="material-symbols-outlined text-[12px]">
                          open_in_new
                        </span>
                      </Link>
                    )}
                  </div>
                  <UploadSlideFile
                    lessonId={l.id}
                    userId={me.id}
                    currentFileName={l.slideFileName}
                    currentFileType={l.slideFileType}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Create lesson form */}
        <div className="glass-card mt-6 rounded-3xl p-8">
          <h3 className="text-headline-md mb-4 text-on-surface">
            New lesson
          </h3>
          <form action={createLesson} className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <input type="hidden" name="moduleId" value={mod.id} />
            <label className="md:col-span-8 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Title
              </span>
              <input
                type="text"
                name="title"
                required
                placeholder="Blink the LED with ESP32"
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
                defaultValue={mod.lessons.length}
                min={0}
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="md:col-span-2 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Difficulty
              </span>
              <select
                name="difficulty"
                defaultValue=""
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">—</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </label>
            <label className="md:col-span-12 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Summary
              </span>
              <input
                type="text"
                name="summary"
                placeholder="One-line description"
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="md:col-span-12 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Body (Markdown — supports GFM, code blocks, and slide
                separators)
              </span>
              <textarea
                name="body"
                rows={10}
                placeholder={`## Slide 1 · What you'll learn\n\n- How the ESP32 GPIO pins drive an LED\n- Reading code with \`pinMode\` and \`digitalWrite\`\n\n---\n\n## Slide 2 · Code\n\n\`\`\`cpp\nvoid setup() {\n  pinMode(2, OUTPUT);\n}\n\`\`\``}
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 font-mono text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="mono-label block text-on-surface-variant">
                Tip: separate slides with{" "}
                <code className="rounded bg-surface-container-high px-1.5 py-0.5 text-primary">
                  ---
                </code>{" "}
                on its own line. The reader view shows them as one document;
                presenter mode advances one at a time.
              </span>
            </label>
            <label className="md:col-span-6 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                Wokwi project URL (optional · opens in a new tab)
              </span>
              <input
                type="url"
                name="wokwiProjectUrl"
                placeholder="https://wokwi.com/projects/123456789"
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="md:col-span-3 space-y-2">
              <span className="mono-label block text-on-surface-variant">
                External slides URL (optional)
              </span>
              <input
                type="url"
                name="slidesUrl"
                placeholder="Google Slides / PDF link"
                className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label
              htmlFor="lesson-published"
              className="md:col-span-3 flex items-end gap-3 pb-2"
            >
              <input
                id="lesson-published"
                type="checkbox"
                name="published"
                className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
              />
              <span className="mono-label text-on-surface-variant">
                Publish
              </span>
            </label>
            <div className="md:col-span-12">
              <SubmitButton
                className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container"
              >
                <span className="material-symbols-outlined text-[18px]">
                  add
                </span>
                Add lesson
              </SubmitButton>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
