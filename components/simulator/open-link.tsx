"use client";

import type { ReactNode } from "react";

/**
 * External link that stops click propagation so it doesn't toggle a parent
 * <details>/<summary>. Event handlers can't live in a server component, so
 * this small client wrapper carries the onClick.
 */
export function OpenLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </a>
  );
}
