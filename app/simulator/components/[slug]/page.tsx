import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  COMPONENT_CATALOG,
  getComponent,
  wokwiNewProjectUrl,
  type ComponentTone,
} from "@/lib/components-catalog";

export const metadata = { title: "Component · Karya Sanga" };

const TONE_BG: Record<ComponentTone, string> = {
  primary: "bg-primary-fixed",
  secondary: "bg-secondary-container",
  tertiary: "bg-tertiary-fixed",
};
const TONE_ACCENT: Record<ComponentTone, string> = {
  primary: "text-on-primary-fixed-variant",
  secondary: "text-on-secondary-container",
  tertiary: "text-on-tertiary-fixed-variant",
};

const CATEGORY_LABEL: Record<string, string> = {
  core: "Core kit",
  sensor: "Sensor",
  actuator: "Actuator",
};

export default async function ComponentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requireUser();
  const { slug } = await params;
  const component = getComponent(slug);
  if (!component) notFound();

  const idx = COMPONENT_CATALOG.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? COMPONENT_CATALOG[idx - 1] : null;
  const next =
    idx >= 0 && idx < COMPONENT_CATALOG.length - 1
      ? COMPONENT_CATALOG[idx + 1]
      : null;

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-12 py-10">
      <Link
        href="/simulator"
        className="mb-6 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        All components
      </Link>

      {/* Hero card */}
      <article className="sticker-shadow grid grid-cols-1 gap-6 rounded-[32px] border-2 border-outline-variant bg-card p-8 md:grid-cols-12">
        <div className="md:col-span-5">
          <div
            className={`flex aspect-square w-full items-center justify-center rounded-3xl ${TONE_BG[component.tone]}`}
          >
            <span
              className={`material-symbols-outlined text-[120px] ${TONE_ACCENT[component.tone]}`}
            >
              {component.icon}
            </span>
          </div>
        </div>

        <div className="space-y-4 md:col-span-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-container px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {CATEGORY_LABEL[component.category]}
            </span>
            <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wider text-on-primary-fixed-variant">
              {component.difficulty}
            </span>
          </div>
          <h1 className="text-headline-lg leading-tight text-on-surface">
            {component.name}
          </h1>
          <p className="text-lg font-medium text-primary">
            {component.tagline}
          </p>
          <p className="leading-7 text-on-surface-variant">
            {component.description}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href={wokwiNewProjectUrl(component.board)}
              target="_blank"
              rel="noopener noreferrer"
              className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
            >
              Open a {component.board === "esp32" ? "fresh ESP32" : "fresh Arduino UNO"} in Wokwi
              <span className="material-symbols-outlined text-[16px]">
                open_in_new
              </span>
            </a>
            <Link
              href="/lessons"
              className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-5 py-2 font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              Find a lesson
              <span className="material-symbols-outlined text-[16px]">
                menu_book
              </span>
            </Link>
          </div>
        </div>
      </article>

      {/* Pins + wiring */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-3xl border-2 border-outline-variant bg-card p-6">
          <h2 className="mb-1 text-base font-bold uppercase tracking-wider text-primary">
            Pins
          </h2>
          <p className="mb-4 text-sm text-on-surface-variant">
            What each connection does.
          </p>
          <dl className="space-y-3">
            {component.pins.map((p) => (
              <div
                key={p.label}
                className="rounded-2xl border-2 border-outline-variant/40 bg-surface-container-low p-4"
              >
                <dt className="font-mono text-sm font-bold text-on-surface">
                  {p.label}
                </dt>
                <dd className="mt-1 text-sm text-on-surface-variant">
                  {p.role}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-3xl border-2 border-outline-variant bg-card p-6">
          <h2 className="mb-1 text-base font-bold uppercase tracking-wider text-primary">
            Wiring it up
          </h2>
          <p className="mb-4 text-sm text-on-surface-variant">
            A safe place to start.
          </p>
          <ol className="space-y-3">
            {component.wiring.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
                  {i + 1}
                </span>
                <span className="leading-6 text-on-surface-variant">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Prev / next */}
      <nav className="mt-8 flex flex-col items-stretch gap-3 md:flex-row">
        {prev ? (
          <Link
            href={`/simulator/components/${prev.slug}`}
            className="group flex-1 rounded-2xl border-2 border-outline-variant bg-card p-4 transition-colors hover:border-primary"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              ← Previous
            </span>
            <div className="text-base font-bold text-on-surface group-hover:text-primary">
              {prev.name}
            </div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
        {next ? (
          <Link
            href={`/simulator/components/${next.slug}`}
            className="group flex-1 rounded-2xl border-2 border-outline-variant bg-card p-4 text-right transition-colors hover:border-primary"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Next →
            </span>
            <div className="text-base font-bold text-on-surface group-hover:text-primary">
              {next.name}
            </div>
          </Link>
        ) : (
          <div className="flex-1" />
        )}
      </nav>
    </main>
  );
}

