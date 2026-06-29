"use client";

import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Submit button for server-action forms (`<form action={...}>`). Reads the
 * parent form's pending state via useFormStatus and, while the action runs,
 * disables itself (preventing double-submits) and shows a spinner — so the
 * user gets immediate feedback that something is processing.
 *
 * Drop-in replacement for `<button type="submit" className=...>...</button>`.
 * Pass `pendingText` to swap the label while submitting.
 */
export function SubmitButton({
  children,
  className = "",
  pendingText,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:cursor-progress disabled:opacity-70`}
      {...rest}
    >
      {pending && (
        <span
          className="material-symbols-outlined animate-spin text-[18px]"
          aria-hidden="true"
        >
          progress_activity
        </span>
      )}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
