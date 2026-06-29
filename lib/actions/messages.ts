"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { and, eq, isNull, ne } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { db, user, conversation, directMessage } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Direct-message server actions.
 *
 *   - sortPair(a, b) — keeps the (userAId, userBId) pair deterministic
 *     so we get exactly one Conversation row per dyad regardless of who
 *     started it. We rely on the @@unique([userAId, userBId]) constraint
 *     for "find or create" semantics via upsert.
 *
 *   - sendDirectMessage(toUserId, body) — used by the inline composer on
 *     any user surface (profile, people list, hackathon, "looking for a
 *     team" card). On success it redirects to /messages/[withId] so the
 *     sender lands inside the thread they just started.
 *
 *   - markConversationRead(conversationId) — sets readAt on every unread
 *     message in the thread where the author is the OTHER party.
 *
 * No "live chat" semantics — these are persisted DMs, polled on page load.
 */

function sortPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const sendSchema = z.object({
  toUserId: z.string().uuid("Pick a recipient"),
  body: z
    .string()
    .min(1, "Type a message")
    .max(4000, "Keep it under 4000 characters"),
  /// Where the form was submitted from (so we can redirect back if we want).
  redirectTo: z.string().optional(),
});

export async function sendDirectMessage(formData: FormData): Promise<void> {
  const me = await requireUser();
  const parsed = sendSchema.safeParse({
    toUserId: formData.get("toUserId"),
    body: formData.get("body"),
    redirectTo: formData.get("redirectTo") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  if (parsed.data.toUserId === me.id) {
    throw new Error("You can't message yourself.");
  }

  // Confirm the recipient actually exists — prevents random UUID spam.
  const recipient = await db.query.user.findFirst({
    where: eq(user.id, parsed.data.toUserId),
    columns: { id: true },
  });
  if (!recipient) throw new Error("Recipient not found");

  const [userAId, userBId] = sortPair(me.id, parsed.data.toUserId);
  const now = new Date();

  // Upsert the dyad → insert the message in one transaction.
  const conversationId = await db.transaction(async (tx) => {
    const [convo] = await tx
      .insert(conversation)
      .values({
        id: createId(),
        userAid: userAId,
        userBid: userBId,
        lastMessageAt: now,
      })
      .onConflictDoUpdate({
        target: [conversation.userAid, conversation.userBid],
        set: { lastMessageAt: now },
      })
      .returning({ id: conversation.id });

    await tx.insert(directMessage).values({
      id: createId(),
      conversationId: convo.id,
      authorId: me.id,
      body: parsed.data.body.trim(),
      createdAt: now,
    });

    return convo.id;
  });

  revalidatePath("/messages");
  revalidatePath(`/messages/${parsed.data.toUserId}`);
  // The recipient won't see fresh content until they reload, but the
  // revalidate keeps stale inboxes from sticking for them too once they
  // navigate back.

  // Redirect the sender into the thread so they see what they sent.
  redirect(`/messages/${parsed.data.toUserId}#m-${conversationId}`);
}

/**
 * Mark every unread message in this conversation as read — but only the
 * ones authored by the OTHER party (you can't read your own message).
 */
export async function markConversationRead(
  conversationId: string,
): Promise<void> {
  const me = await requireUser();
  await db
    .update(directMessage)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(directMessage.conversationId, conversationId),
        isNull(directMessage.readAt),
        ne(directMessage.authorId, me.id),
      ),
    );
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
}
