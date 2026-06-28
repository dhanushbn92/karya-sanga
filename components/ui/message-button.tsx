import Link from "next/link";

/**
 * "Message" button — links to /messages/<userId>. Renders nothing if the
 * target is the signed-in user themselves (no point messaging yourself).
 *
 * Two visual sizes:
 *   - "icon": square, 36×36, just the chat icon (for compact list rows)
 *   - "pill": rounded pill with icon + "Message" label (for profile hero)
 */
export function MessageButton({
  toUserId,
  currentUserId,
  size = "pill",
  className = "",
}: {
  toUserId: string;
  currentUserId: string | null | undefined;
  size?: "icon" | "pill";
  className?: string;
}) {
  if (currentUserId && currentUserId === toUserId) return null;
  if (size === "icon") {
    return (
      <Link
        href={`/messages/${toUserId}`}
        className={`press-soft inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-outline-variant bg-card text-on-surface-variant transition-colors hover:border-primary hover:text-primary ${className}`}
        title="Message"
        aria-label="Send a message"
      >
        <span className="material-symbols-outlined text-[16px]">
          mail
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={`/messages/${toUserId}`}
      className={`press-soft inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-black uppercase tracking-wide text-on-primary ${className}`}
      style={{ boxShadow: "0 4px 0 0 #531800" }}
    >
      <span className="material-symbols-outlined text-[16px]">mail</span>
      Message
    </Link>
  );
}
