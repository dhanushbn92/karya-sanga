import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, user, conversation } from "@/lib/db";
import {
  markConversationRead,
  sendDirectMessage,
} from "@/lib/actions/messages";
import { SubmitButton } from "@/components/ui/submit-button";

export const metadata = { title: "Message · Karya Sanga" };

/**
 * One-on-one DM thread.
 *
 * `withUserId` is the OTHER party's id. We look up (or note absence of) the
 * conversation between (me, them), render every message in chronological
 * order, and mark anything they sent as read on the way in.
 *
 * The compose form sits at the bottom — the page reloads on submit and lands
 * back here scrolled near the new message.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ withUserId: string }>;
}) {
  const me = await requireUser();
  const { withUserId } = await params;
  if (withUserId === me.id) notFound();

  const other = await db.query.user.findFirst({
    where: eq(user.id, withUserId),
    columns: {
      id: true,
      name: true,
      email: true,
      handle: true,
    },
  });
  if (!other) notFound();

  const [userAId, userBId] =
    me.id < other.id ? [me.id, other.id] : [other.id, me.id];

  const convoRaw = await db.query.conversation.findFirst({
    where: and(
      eq(conversation.userAid, userAId),
      eq(conversation.userBid, userBId),
    ),
    with: {
      directMessages: {
        orderBy: (m, { asc }) => [asc(m.createdAt)],
        with: {
          user: {
            columns: { id: true, name: true, email: true, handle: true },
          },
        },
      },
    },
  });

  // Map relation names → JSX keys (directMessages → messages, message.user →
  // message.author).
  const convo = convoRaw
    ? {
        ...convoRaw,
        messages: convoRaw.directMessages.map((m) => ({
          ...m,
          author: m.user,
        })),
      }
    : null;

  // Best-effort: mark anything they sent as read when we render the page.
  if (convo) {
    await markConversationRead(convo.id).catch(() => {});
  }

  const messages = convo?.messages ?? [];
  const otherName = other.name ?? other.email.split("@")[0];

  return (
    <main className="mx-auto flex w-full max-w-[760px] flex-1 flex-col px-4 md:px-8 py-10">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="mb-4">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest text-on-surface-variant hover:text-primary"
        >
          <span className="material-symbols-outlined text-[14px]">
            arrow_back
          </span>
          All messages
        </Link>
      </div>

      <div className="press-soft mb-6 flex items-center justify-between gap-3 rounded-[24px] border-2 border-outline-variant bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary-container text-base font-black text-on-secondary-container">
            {otherName.charAt(0).toUpperCase()}
          </span>
          <div>
            <div className="flex items-center gap-2">
              {other.handle ? (
                <Link
                  href={`/builders/${other.handle}`}
                  className="text-base font-black text-on-surface hover:text-primary"
                >
                  {otherName}
                </Link>
              ) : (
                <span className="text-base font-black text-on-surface">
                  {otherName}
                </span>
              )}
              {other.handle && (
                <span className="rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                  @{other.handle}
                </span>
              )}
            </div>
            <div className="text-[11px] text-on-surface-variant">
              Direct message
            </div>
          </div>
        </div>
        {other.handle && (
          <Link
            href={`/builders/${other.handle}`}
            className="press-soft hidden items-center gap-1.5 rounded-full border-2 border-outline-variant bg-card px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-on-surface-variant hover:border-primary hover:text-primary md:inline-flex"
          >
            <span className="material-symbols-outlined text-[14px]">
              person
            </span>
            Profile
          </Link>
        )}
      </div>

      {/* ── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 space-y-3">
        {messages.length === 0 ? (
          <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-8 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant">
              waving_hand
            </span>
            <p className="text-sm text-on-surface-variant">
              No messages yet. Say hi below.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => {
              const mine = m.authorId === me.id;
              return (
                <li
                  key={m.id}
                  id={`m-${convo?.id}`}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[80%]">
                    <div
                      className={`whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm leading-relaxed ${
                        mine
                          ? "bg-primary text-on-primary"
                          : "border-2 border-outline-variant bg-card text-on-surface"
                      }`}
                      style={
                        mine
                          ? {
                              boxShadow: "0 3px 0 0 #531800",
                              borderBottomRightRadius: 8,
                            }
                          : {
                              borderBottomLeftRadius: 8,
                            }
                      }
                    >
                      {m.body}
                    </div>
                    <div
                      className={`mt-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant ${
                        mine ? "text-right" : "text-left"
                      }`}
                    >
                      {new Date(m.createdAt).toLocaleString()}
                      {mine && m.readAt && " · read"}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Compose ────────────────────────────────────────────── */}
      <form
        action={sendDirectMessage}
        className="press-soft mt-6 rounded-[24px] border-2 border-outline-variant bg-card p-3"
      >
        <input type="hidden" name="toUserId" value={other.id} />
        <label className="block">
          <span className="sr-only">Message {otherName}</span>
          <textarea
            name="body"
            required
            rows={3}
            maxLength={4000}
            placeholder={`Say hi to ${otherName}…`}
            className="block w-full resize-y rounded-2xl bg-transparent px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none"
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold text-on-surface-variant">
            Press send — they&apos;ll see it next time they open their inbox.
          </span>
          <SubmitButton
            className="press-soft inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-black uppercase tracking-wide text-on-primary"
            style={{ boxShadow: "0 4px 0 0 #531800" }}
          >
            <span className="material-symbols-outlined text-[18px]">
              send
            </span>
            Send
          </SubmitButton>
        </div>
      </form>
    </main>
  );
}
