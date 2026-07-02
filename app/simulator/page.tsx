import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, savedProject, wokwiStarter } from "@/lib/db";
import { COMPONENT_CATALOG } from "@/lib/components-catalog";
import { DeleteSavedProject } from "@/components/simulator/delete-saved-project";
import { SaveProjectForm } from "@/components/simulator/save-project-form";

export const metadata = { title: "Simulator · Karya Sanga" };

const TONE_BG: Record<string, string> = {
  primary: "bg-primary-fixed",
  secondary: "bg-secondary-container",
  tertiary: "bg-tertiary-fixed",
};
const TONE_BORDER: Record<string, string> = {
  primary: "hover:border-primary",
  secondary: "hover:border-secondary",
  tertiary: "hover:border-tertiary",
};
const DIFFICULTY_TONE: Record<string, string> = {
  Beginner: "bg-primary-fixed text-on-primary-fixed-variant",
  Intermediate: "bg-secondary-container text-on-secondary-container",
  Advanced: "bg-tertiary-fixed text-on-tertiary-fixed",
};

// One-click "new project" launchers (Wokwi exposes /projects/new/<board>).
// These open the editor pre-configured for the board, then the kid hits
// Wokwi's "Save a Copy" and brings the URL back to our save form.
const BOARD_LAUNCHERS = [
  { board: "esp32", label: "ESP32", icon: "memory", tone: "primary" as const },
  {
    board: "esp32-s3",
    label: "ESP32-S3",
    icon: "memory",
    tone: "secondary" as const,
  },
  {
    board: "esp32-c3",
    label: "ESP32-C3",
    icon: "memory",
    tone: "tertiary" as const,
  },
  {
    board: "arduino-uno",
    label: "Arduino UNO",
    icon: "developer_board",
    tone: "primary" as const,
  },
  {
    board: "raspberry-pi-pico",
    label: "RP2040 Pico",
    icon: "developer_board",
    tone: "secondary" as const,
  },
];

const BOARD_TONE: Record<string, "primary" | "secondary" | "tertiary"> = {
  esp32: "primary",
  "esp32-s3": "secondary",
  "esp32-c3": "tertiary",
  "esp32-c6": "primary",
  "esp32-h2": "secondary",
  "arduino-uno": "tertiary",
  "arduino-mega": "primary",
  "raspberry-pi-pico": "secondary",
};

export default async function SimulatorPage() {
  const user = await requireUser();
  const isMod = user.role === "admin" || user.role === "instructor";

  const [savedProjects, starters] = await Promise.all([
    db.query.savedProject.findMany({
      where: eq(savedProject.ownerId, user.id),
      orderBy: [desc(savedProject.createdAt)],
    }),
    db.query.wokwiStarter.findMany({
      where: eq(wokwiStarter.published, true),
      orderBy: [asc(wokwiStarter.order), asc(wokwiStarter.createdAt)],
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      {/* Hero */}
      <section className="mb-10 grid grid-cols-1 items-center gap-8 md:grid-cols-12">
        <div className="space-y-5 md:col-span-8">
          <div className="rotate-sticker inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
            <span className="material-symbols-outlined text-[16px]">
              memory
            </span>
            <span className="text-xs font-bold tracking-wide">
              Logic & Maker Lab
            </span>
          </div>
          <h1 className="text-headline-lg gradient-text">
            Build circuits without breaking anything.
          </h1>
          <p className="max-w-2xl text-on-surface-variant">
            We use{" "}
            <a
              href="https://wokwi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary hover:underline"
            >
              Wokwi
            </a>{" "}
            as our virtual workbench. Start a fresh project, or fork one of
            our starters below. Every project opens in a new tab.
          </p>
        </div>
        <div className="md:col-span-4">
          <div className="sticker-shadow rounded-3xl border-2 border-outline-variant bg-card p-5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Quick stats
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-on-surface-variant">Components</span>
                <span className="font-bold text-on-surface">
                  {COMPONENT_CATALOG.length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-on-surface-variant">Starters</span>
                <span className="font-bold text-on-surface">
                  {starters.length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-on-surface-variant">Your projects</span>
                <span className="font-bold text-on-surface">
                  {savedProjects.length}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Start a new project — board launchers */}
      <section className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">
              Start a new project
            </h2>
            <p className="text-sm text-on-surface-variant">
              Each button opens Wokwi with a fresh editor for that board.
              Build → click <em>Save</em> in Wokwi → paste the URL into the
              save form below.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {BOARD_LAUNCHERS.map((b) => (
            <a
              key={b.board}
              href={`https://wokwi.com/projects/new/${b.board}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`group flex flex-col items-center gap-2 rounded-2xl border-2 border-outline-variant bg-card p-4 text-center transition-all hover:-translate-y-0.5 ${TONE_BORDER[b.tone]}`}
            >
              <span
                className={`flex h-12 w-12 items-center justify-center rounded-2xl ${TONE_BG[b.tone]}`}
              >
                <span className="material-symbols-outlined text-2xl text-on-surface/60">
                  {b.icon}
                </span>
              </span>
              <span className="text-sm font-bold text-on-surface group-hover:text-primary">
                {b.label}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                Open in Wokwi ↗
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Starter library */}
      <section className="mb-12">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">
              Starter library
            </h2>
            <p className="text-sm text-on-surface-variant">
              Curated by your instructor. Click → opens in Wokwi → use{" "}
              <em>Save a Copy</em> to make it yours → paste back below.
            </p>
          </div>
          {isMod && (
            <Link
              href="/admin/simulator/starters"
              className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
              Manage
            </Link>
          )}
        </div>

        {starters.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6 text-on-surface-variant">
            {isMod
              ? "No starters yet. Add some at /admin/simulator/starters."
              : "Your instructor hasn't published starters yet."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {starters.map((s) => {
              const tone = BOARD_TONE[s.board] ?? "primary";
              return (
                <a
                  key={s.id}
                  href={s.wokwiProjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex h-full flex-col rounded-[24px] border-2 border-outline-variant bg-card p-5 transition-all duration-300 hover:-translate-y-1 ${TONE_BORDER[tone]}`}
                >
                  <div
                    className={`mb-3 flex h-20 items-center justify-between rounded-2xl px-4 ${TONE_BG[tone]}`}
                  >
                    <span className="material-symbols-outlined text-[36px] text-on-surface/50">
                      memory
                    </span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {s.board}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-on-surface group-hover:text-primary">
                    {s.label}
                  </h3>
                  {s.description && (
                    <p className="mt-1 line-clamp-3 text-sm text-on-surface-variant">
                      {s.description}
                    </p>
                  )}
                  <div className="mt-auto flex items-center gap-1 pt-3 text-xs font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open in Wokwi
                    <span className="material-symbols-outlined text-[12px]">
                      open_in_new
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      {/* Saved projects */}
      <section className="mb-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">My projects</h2>
            <p className="text-sm text-on-surface-variant">
              Wokwi URLs you&apos;ve saved here. Paste a new one in the form
              below.
            </p>
          </div>
        </div>

        {savedProjects.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-outline-variant bg-card p-6 text-on-surface-variant">
            Nothing saved yet. Try a starter, save a copy in Wokwi, then
            paste the URL into the save form below.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savedProjects.map((p) => (
              <article
                key={p.id}
                className="group flex flex-col gap-3 rounded-2xl border-2 border-outline-variant bg-card p-5 transition-all hover:-translate-y-1 hover:border-primary"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="line-clamp-2 text-base font-bold text-on-surface">
                    {p.name}
                  </h3>
                  <DeleteSavedProject id={p.id} />
                </div>
                {p.notes && (
                  <p className="line-clamp-3 text-sm text-on-surface-variant">
                    {p.notes}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2">
                  <a
                    href={p.wokwiProjectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-transform active:scale-95"
                  >
                    Open in Wokwi
                    <span className="material-symbols-outlined text-[14px]">
                      open_in_new
                    </span>
                  </a>
                  <span className="text-[11px] text-on-surface-variant">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* The save form */}
        <SaveProjectForm />
      </section>

      {/* Component reference */}
      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-headline-md text-on-surface">
              Component reference
            </h2>
            <p className="text-sm text-on-surface-variant">
              Tap a card to learn what each part does and how to wire it up.
            </p>
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            {COMPONENT_CATALOG.length} components
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {COMPONENT_CATALOG.map((c) => (
            <Link
              key={c.slug}
              href={`/simulator/components/${c.slug}`}
              className={`group flex h-full flex-col rounded-[24px] border-2 border-outline-variant bg-card p-5 transition-all duration-300 hover:-translate-y-1 ${TONE_BORDER[c.tone]}`}
            >
              <div
                className={`relative mb-4 flex h-24 items-center justify-between rounded-2xl px-5 ${TONE_BG[c.tone]}`}
              >
                <span className="material-symbols-outlined text-[44px] text-on-surface/50">
                  {c.icon}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${DIFFICULTY_TONE[c.difficulty]}`}
                >
                  {c.difficulty}
                </span>
              </div>
              <h3 className="text-base font-bold text-on-surface group-hover:text-primary">
                {c.name}
              </h3>
              <p className="mt-1 line-clamp-3 text-sm text-on-surface-variant">
                {c.tagline}
              </p>
              <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Learn
                <span className="material-symbols-outlined text-[14px]">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
