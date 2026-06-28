"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  markLessonComplete,
  unmarkLessonComplete,
} from "@/lib/actions/lessons";

export function MarkCompleteButton({
  lessonId,
  isComplete,
}: {
  lessonId: string;
  isComplete: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("lessonId", lessonId);
      const result = isComplete
        ? await unmarkLessonComplete(fd)
        : await markLessonComplete(fd);
      if (!result.ok) {
        toast.error(result.error ?? "Something went wrong");
        return;
      }
      toast.success(isComplete ? "Marked as not done" : "Lesson complete!");
      router.refresh();
    });
  }

  if (isComplete) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-full border-2 border-secondary bg-secondary-container px-5 py-2 font-bold text-on-secondary-container transition-colors hover:bg-secondary-fixed-dim disabled:opacity-60"
      >
        <span className="material-symbols-outlined text-[18px]">
          check_circle
        </span>
        {isPending ? "Updating…" : "Completed — undo?"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2 font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[18px]">
        task_alt
      </span>
      {isPending ? "Saving…" : "Mark complete"}
    </button>
  );
}
