"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleReaction } from "@/lib/actions/wall";

const TYPES = [
  { type: "clap", emoji: "👏", label: "Clap" },
  { type: "love", emoji: "❤️", label: "Love" },
  { type: "idea", emoji: "💡", label: "Idea" },
] as const;

type ReactionType = (typeof TYPES)[number]["type"];

export function ReactionBar({
  postId,
  counts,
  mine,
}: {
  postId: string;
  counts: Record<ReactionType, number>;
  mine: Record<ReactionType, boolean>;
}) {
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic<
    { counts: Record<ReactionType, number>; mine: Record<ReactionType, boolean> },
    ReactionType
  >({ counts, mine }, (state, type) => {
    const had = state.mine[type];
    return {
      counts: {
        ...state.counts,
        [type]: state.counts[type] + (had ? -1 : 1),
      },
      mine: { ...state.mine, [type]: !had },
    };
  });

  function handleToggle(type: ReactionType) {
    startTransition(async () => {
      setOptimistic(type);
      const fd = new FormData();
      fd.set("postId", postId);
      fd.set("type", type);
      try {
        await toggleReaction(fd);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {TYPES.map(({ type, emoji, label }) => {
        const count = optimistic.counts[type];
        const active = optimistic.mine[type];
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleToggle(type)}
            aria-pressed={active}
            aria-label={`${label}${count > 0 ? `, ${count}` : ""}`}
            className={`inline-flex items-center gap-1 rounded-full border-2 px-3 py-1 text-xs font-bold transition-all ${
              active
                ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
                : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary hover:text-primary"
            }`}
          >
            <span className="text-[14px] leading-none">{emoji}</span>
            {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
