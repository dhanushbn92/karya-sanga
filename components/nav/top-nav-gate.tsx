"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Hides the global TopNav on the public landing page ("/"), which renders its
 * own dark/vibrant nav. Everywhere else the shared nav shows as normal.
 */
export function TopNavGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <>{children}</>;
}
