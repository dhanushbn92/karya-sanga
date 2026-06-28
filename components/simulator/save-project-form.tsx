"use client";

import { useState } from "react";
import { saveProject } from "@/lib/actions/saved-projects";

/**
 * Smart save-project form.
 *
 * - When the kid pastes a Wokwi URL, we detect it and (a) extract the
 *   project ID for use as a placeholder/fallback name, (b) leave the name
 *   field empty for them to fill with something memorable.
 * - Validates URL shape client-side before submitting, so errors surface
 *   immediately instead of via the server-action error path.
 */
export function SaveProjectForm() {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function detectedId(u: string) {
    const m = u.match(/^https?:\/\/wokwi\.com\/projects\/([^/?#]+)/i);
    return m?.[1] ?? null;
  }
  const id = detectedId(url);

  return (
    <form
      action={(fd) => {
        if (!detectedId(url)) {
          setError("Paste a https://wokwi.com/projects/… URL.");
          return;
        }
        setError(null);
        fd.set("name", name || `Wokwi project ${id ?? ""}`.trim());
        fd.set("wokwiProjectUrl", url);
        if (notes) fd.set("notes", notes);
        return saveProject(fd);
      }}
      className="mt-6 rounded-[28px] border-2 border-outline-variant bg-card p-6"
    >
      <h3 className="text-base font-bold text-on-surface">
        Save a Wokwi project
      </h3>
      <p className="mb-4 text-sm text-on-surface-variant">
        Build something in Wokwi, click <em>Share</em> → copy the URL, paste
        it here.
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <label className="md:col-span-4 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Name
          </span>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={id ? `Wokwi project ${id}` : "LED blink with delay"}
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <label className="md:col-span-8 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Wokwi URL
          </span>
          <input
            type="url"
            name="wokwiProjectUrl"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            required
            placeholder="https://wokwi.com/projects/..."
            className={`w-full rounded-xl border-2 px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-4 ${
              url && !id
                ? "border-destructive bg-surface-container-lowest focus:border-destructive focus:ring-destructive/15"
                : "border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-primary/15"
            }`}
          />
          {url && !id && (
            <span className="block text-xs font-bold text-destructive">
              Doesn&apos;t look like a Wokwi project URL.
            </span>
          )}
          {id && (
            <span className="block text-xs text-on-surface-variant">
              ✓ Wokwi project <code className="font-mono">{id}</code>
            </span>
          )}
        </label>
        <label className="md:col-span-12 space-y-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            Notes (optional)
          </span>
          <input
            type="text"
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What does this project do?"
            className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <div className="md:col-span-12 flex items-center gap-3">
          <button
            type="submit"
            disabled={!url || !id}
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Save project
          </button>
          {error && (
            <span className="text-xs font-bold text-destructive">{error}</span>
          )}
        </div>
      </div>
    </form>
  );
}
