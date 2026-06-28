"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { scoreSubmission } from "@/lib/actions/submissions";

type Criterion = {
  key: "innovation" | "technical" | "aiUse" | "presentation";
  label: string;
  desc: string;
};

const CRITERIA: Criterion[] = [
  {
    key: "innovation",
    label: "Innovation",
    desc: "Originality of the idea and approach.",
  },
  {
    key: "technical",
    label: "Technical execution",
    desc: "Quality of the build, working circuits, sensible code.",
  },
  {
    key: "aiUse",
    label: "Use of AI",
    desc: "How meaningfully AI is integrated — not just badge-wearing.",
  },
  {
    key: "presentation",
    label: "Presentation",
    desc: "Clarity of description, demo, and storytelling.",
  },
];

export function ScoreForm({
  submissionId,
  initial,
  lastUpdated,
}: {
  submissionId: string;
  initial: Partial<Record<Criterion["key"], number>> & { comment?: string | null };
  lastUpdated: Date | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState({
    innovation: initial.innovation ?? 5,
    technical: initial.technical ?? 5,
    aiUse: initial.aiUse ?? 5,
    presentation: initial.presentation ?? 5,
  });

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await scoreSubmission(formData);
        toast.success("Scores saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="submissionId" value={submissionId} />

      {CRITERIA.map((c) => (
        <div
          key={c.key}
          className="rounded-2xl border border-white/5 bg-surface-container-low p-5"
        >
          <label
            htmlFor={c.key}
            className="flex items-baseline justify-between"
          >
            <span>
              <span className="text-base font-medium text-on-surface">
                {c.label}
              </span>
              <span className="mono-label ml-2 text-on-surface-variant">
                1–10
              </span>
            </span>
            <span className="text-headline-md text-primary">
              {values[c.key]}
            </span>
          </label>
          <p className="mt-1 text-sm text-on-surface-variant">{c.desc}</p>
          <input
            id={c.key}
            type="range"
            name={c.key}
            min={1}
            max={10}
            step={1}
            value={values[c.key]}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                [c.key]: Number(e.target.value),
              }))
            }
            className="mt-3 w-full accent-primary"
          />
        </div>
      ))}

      <label className="block space-y-2">
        <span className="mono-label block text-on-surface-variant">
          Comment (optional, visible only to admins)
        </span>
        <textarea
          name="comment"
          rows={4}
          maxLength={2000}
          defaultValue={initial.comment ?? ""}
          placeholder="What stood out? What could be sharper?"
          className="w-full rounded-xl border border-white/10 bg-surface-container-low px-4 py-3 text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="saffron-glow inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-on-primary transition-colors hover:bg-primary-container hover:text-on-primary-container disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">
            {lastUpdated ? "save" : "gavel"}
          </span>
          {isPending
            ? "Saving…"
            : lastUpdated
              ? "Update scores"
              : "Submit scores"}
        </button>
        {lastUpdated && (
          <span className="mono-label text-on-surface-variant">
            Last updated {new Date(lastUpdated).toLocaleString()}
          </span>
        )}
      </div>
    </form>
  );
}
