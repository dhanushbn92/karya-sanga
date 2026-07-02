import Link from "next/link";
import Image from "next/image";
import { getCurrentUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

/**
 * Top nav — kept deliberately small.
 *
 * Design (locked with user 2026-05-30): 4 items for participants, 5 with
 * admin. The labels are nouns kids can scan in one second — "Home",
 * "Lessons", "Projects", "Show & Tell".
 *
 * Everything finer-grained (simulator, hackathon submission, cohort
 * roster, badges, etc.) is reachable from Home. The nav is the way back
 * to one of the four homes — not the navigation tree for every feature.
 */
const COHORT_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/workshops", label: "Workshops" },
  { href: "/gallery", label: "Projects" },
  { href: "/wall", label: "Show & Tell" },
  { href: "/messages", label: "Messages" },
];

const SIGNED_OUT_LINKS = [
  { href: "/workshops", label: "Workshops" },
  { href: "/gallery", label: "Projects" },
  { href: "/wall", label: "Show & Tell" },
];

export async function TopNav() {
  const user = await getCurrentUser();
  const showAdmin = user && (user.role === "admin" || user.role === "instructor");
  const showJudging =
    user &&
    (user.role === "admin" ||
      user.role === "instructor" ||
      user.role === "judge");

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0b0a1a]/80 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0b0a1a]/60">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-6 px-4 md:px-12">
        <Link
          href={user ? "/dashboard" : "/"}
          className="press-soft flex shrink-0 items-center gap-3 whitespace-nowrap rounded-2xl"
        >
          <Image
            src="/anaadi-logo-mark.png"
            alt="Anaadi Foundation"
            width={40}
            height={40}
            className="h-10 w-auto shrink-0 object-contain"
            priority
          />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-headline-md font-black text-primary">
              Karya Sanga
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              An initiative of Anaadi Foundation
            </span>
          </div>
        </Link>

        {user ? (
          <>
            <ul className="hidden items-center gap-1 md:flex">
              {COHORT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="press-soft rounded-full px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              {showJudging && !showAdmin && (
                <li>
                  <Link
                    href="/admin/hackathon/judge"
                    className="press-soft rounded-full px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Judging
                  </Link>
                </li>
              )}
              {showAdmin && (
                <li>
                  <Link
                    href="/admin"
                    className="press-soft rounded-full px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white"
                  >
                    Admin
                  </Link>
                </li>
              )}
            </ul>
            <div className="flex items-center gap-3">
              <Link
                href="/settings/profile"
                className="hidden text-sm font-medium text-on-surface-variant transition-colors hover:text-primary sm:inline"
                title="Edit your profile"
              >
                {user.name ?? user.email.split("@")[0]}
              </Link>
              <SignOutButton />
            </div>
          </>
        ) : (
          <>
            <ul className="hidden items-center gap-1 md:flex">
              {SIGNED_OUT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="press-soft rounded-full px-3.5 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="press-soft hidden rounded-full px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white/10 hover:text-white md:inline-block"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="press-soft btn-gradient inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-semibold text-white"
              >
                <span className="material-symbols-outlined text-[16px]">
                  rocket_launch
                </span>
                Sign up
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
