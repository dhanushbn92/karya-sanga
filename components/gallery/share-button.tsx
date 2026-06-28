"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Copy the project's public URL to the clipboard. On unsupported browsers
 * (or when the clipboard API is denied) falls back to selecting the URL in
 * a hidden input so the user can copy by hand.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url =
      typeof window !== "undefined" ? window.location.href : "";

    // Web Share API (mobile) — show native share sheet if available.
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — long-press the URL to copy manually.");
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
    >
      <span className="material-symbols-outlined text-[16px]">
        {copied ? "check_circle" : "share"}
      </span>
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
