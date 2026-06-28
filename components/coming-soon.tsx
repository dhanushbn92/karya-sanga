export function ComingSoon({
  title,
  description,
  icon = "construction",
}: {
  title: string;
  description: string;
  icon?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-16">
      <div className="sticker-shadow mx-auto max-w-3xl rounded-[32px] border-2 border-outline-variant bg-card p-12 text-center">
        <div className="rotate-sticker mb-6 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            schedule
          </span>
          <span className="text-xs font-bold tracking-wide">In the works</span>
        </div>
        <span className="material-symbols-outlined mb-5 inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-primary-fixed text-3xl text-on-primary-fixed-variant">
          {icon}
        </span>
        <h1 className="text-headline-lg mb-3 text-on-surface">{title}</h1>
        <p className="text-on-surface-variant">{description}</p>
        <p className="mt-6 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Check back soon
        </p>
      </div>
    </main>
  );
}
