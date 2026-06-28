"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addComment, deleteComment } from "@/lib/actions/wall";

export type CommentVM = {
  id: string;
  body: string;
  createdAt: Date;
  author: {
    id: string;
    name: string | null;
    email: string;
  };
};

export function CommentSection({
  postId,
  currentUserId,
  isModerator,
  comments,
}: {
  postId: string;
  currentUserId: string;
  isModerator: boolean;
  comments: CommentVM[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const visible = expanded ? comments : comments.slice(0, 2);
  const hidden = comments.length - visible.length;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("postId", postId);
      fd.set("body", draft.trim());
      try {
        await addComment(fd);
        setDraft("");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this comment?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      try {
        await deleteComment(fd);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((c) => {
            const name = c.author.name ?? c.author.email.split("@")[0];
            const canDelete = isModerator || c.author.id === currentUserId;
            return (
              <li
                key={c.id}
                className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-3 py-2"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-on-surface">
                    {name}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-on-surface-variant">
                  {c.body}
                </p>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="mt-1 text-[10px] font-bold text-on-surface-variant hover:text-destructive"
                  >
                    Delete
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-xs font-bold text-primary hover:underline"
        >
          Show {hidden} more comment{hidden === 1 ? "" : "s"}
        </button>
      )}

      <form onSubmit={handleSubmit} className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          rows={1}
          placeholder="Say something kind…"
          className="min-h-[36px] flex-1 resize-none rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          aria-label="Post comment"
        >
          <span className="material-symbols-outlined text-[18px]">send</span>
        </button>
      </form>
    </div>
  );
}

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString();
}
