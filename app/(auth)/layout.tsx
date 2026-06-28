import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      {/* Atmospheric blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-50">
        <div className="absolute right-10 top-10 h-72 w-72 rounded-full bg-tertiary-container/20 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-secondary-container/30 blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {/* Anaadi trust signal above the auth card */}
        <Link
          href="/"
          className="mb-6 flex flex-col items-center gap-2 text-center"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/anaadi-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="h-14 w-auto object-contain"
          />
          <div>
            <div className="text-headline-md font-black text-primary">
              Yukti AI Labs
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
              An initiative of Anaadi Foundation
            </div>
          </div>
        </Link>
        {children}
      </div>
    </main>
  );
}
