"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSavedProject } from "@/lib/actions/saved-projects";

export function DeleteSavedProject({ id }: { id: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Remove this saved project? You can always add it back later.")) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      try {
        await deleteSavedProject(fd);
        toast.success("Removed");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-label="Delete saved project"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-outline-variant bg-card text-on-surface-variant transition-colors hover:border-destructive hover:text-destructive disabled:opacity-60"
    >
      <span className="material-symbols-outlined text-[18px]">
        {isPending ? "hourglass_top" : "delete"}
      </span>
    </button>
  );
}
