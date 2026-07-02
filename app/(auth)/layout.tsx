import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      {/* Atmospheric blobs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute right-10 top-10 h-72 w-72 rounded-full bg-[#8c5cff]/25 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-72 w-72 rounded-full bg-[#26d0c2]/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 rounded-full bg-[#b14dff]/15 blur-3xl" />
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
            <div className="text-headline-md font-black gradient-text">
              Karya Sanga
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
