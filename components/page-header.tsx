import Link from "next/link";

/**
 * Standard page header for participant-facing surfaces.
 *
 * Every kid-facing page renders this at the top — title + one-line subtitle
 * that explains "what this page is" so anyone landing here understands the
 * surface in one read. Optional eyebrow chip for context (cohort, role,
 * section label), optional action slot for primary CTAs.
 */
export function PageHeader({
  eyebrow,
  eyebrowIcon,
  title,
  subtitle,
  backHref,
  backLabel,
  action,
}: {
  eyebrow?: string;
  eyebrowIcon?: string;
  title: string;
  subtitle: string;
  backHref?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">
            arrow_back
          </span>
          {backLabel ?? "Back"}
        </Link>
      )}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          {eyebrow && (
            <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
              {eyebrowIcon && (
                <span className="material-symbols-outlined text-[16px]">
                  {eyebrowIcon}
                </span>
              )}
              <span className="text-xs font-bold tracking-wide">
                {eyebrow}
              </span>
            </div>
          )}
          <h1 className="text-headline-lg text-on-surface">{title}</h1>
          <p className="mt-2 max-w-3xl text-on-surface-variant">{subtitle}</p>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
