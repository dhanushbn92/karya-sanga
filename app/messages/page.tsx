import Link from "next/link";
import { and, desc, eq, isNull, ne, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, conversation, directMessage } from "@/lib/db";

export const metadata = { title: "Messages · Karya Sanga" };

/**
 * Inbox — every conversation this user is part of, newest activity first.
 * One row per conversation: other person's name + handle, last-message
 * preview, unread badge, time-ago.
 *
 * Conversations are stored with `userAId < userBId` so we don't care which
 * side this user is on — we just compute "the other one" and read it back.
 */
export default async function MessagesInboxPage() {
  const me = await requireUser();

  const conversationsRaw = await db.query.conversation.findMany({
    where: or(
      eq(conversation.userAid, me.id),
      eq(conversation.userBid, me.id),
    ),
    orderBy: [desc(conversation.lastMessageAt)],
    with: {
      user_userAid: {
        columns: { id: true, name: true, email: true, handle: true },
      },
      user_userBid: {
        columns: { id: true, name: true, email: true, handle: true },
      },
      directMessages: {
        orderBy: (m, { desc }) => [desc(m.createdAt)],
        limit: 1,
        columns: {
          authorId: true,
          body: true,
          createdAt: true,
          readAt: true,
        },
      },
    },
    limit: 100,
  });

  // Map relation names → the keys the JSX reads (userA, userB, messages) and
  // compute the unread count (other party's unread messages) per conversation.
  // _count.messages was a filtered relation count in Prisma.
  const conversations = await Promise.all(
    conversationsRaw.map(async (c) => {
      const unread = await db.$count(
        directMessage,
        and(
          eq(directMessage.conversationId, c.id),
          isNull(directMessage.readAt),
          ne(directMessage.authorId, me.id),
        ),
      );
      return {
        ...c,
        userA: c.user_userAid,
        userB: c.user_userBid,
        messages: c.directMessages,
        _count: { messages: unread },
      };
    }),
  );

  return (
    <main className="mx-auto w-full max-w-[820px] flex-1 px-4 md:px-8 py-10">
      <div className="mb-6">
        <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
          <span className="material-symbols-outlined text-[16px]">
            mail
          </span>
          <span className="text-xs font-black uppercase tracking-widest">
            Messages
          </span>
        </div>
        <h1 className="text-display-md text-on-surface">Your messages</h1>
        <p className="mt-2 text-on-surface-variant">
          Reach out to anyone in the workshops. Send a message and they&apos;ll
          see it next time they open their inbox.
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-[28px] border-2 border-dashed border-outline-variant bg-card p-10 text-center">
          <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
            forum
          </span>
          <h2 className="text-headline-md text-on-surface">
            No conversations yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
            Open someone&apos;s profile from{" "}
            <Link href="/builders" className="font-bold text-primary">
              People
            </Link>{" "}
            or the workshop roster and hit the Message button to start a
            conversation.
          </p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-[24px] border-2 border-outline-variant bg-card divide-y-2 divide-outline-variant">
          {conversations.map((c) => {
            const other = c.userA.id === me.id ? c.userB : c.userA;
            const name = other.name ?? other.email.split("@")[0];
            const initial = name.charAt(0).toUpperCase();
            const last = c.messages[0];
            const lastFromMe = last && last.authorId === me.id;
            const unread = c._count.messages;
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${other.id}`}
                  className="press-soft group flex items-start gap-3 px-5 py-4 transition-colors hover:bg-surface-container-lowest"
                >
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                      unread > 0
                        ? "bg-primary text-on-primary"
                        : "bg-secondary-container text-on-secondary-container"
                    }`}
                  >
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate font-bold text-on-surface group-hover:text-primary ${
                          unread > 0 ? "font-black" : ""
                        }`}
                      >
                        {name}
                        {other.handle ? (
                          <span className="ml-1 text-[11px] font-bold text-on-surface-variant">
                            @{other.handle}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[11px] text-on-surface-variant">
                        {timeAgo(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-sm ${
                          unread > 0 && !lastFromMe
                            ? "font-bold text-on-surface"
                            : "text-on-surface-variant"
                        }`}
                      >
                        {lastFromMe && (
                          <span className="text-on-surface-variant">
                            You:{" "}
                          </span>
                        )}
                        {last?.body ?? "(no messages yet)"}
                      </p>
                      {unread > 0 && (
                        <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-black text-on-primary">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
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
