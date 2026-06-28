import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedWallImageUrls } from "@/lib/supabase/admin";
import { deleteWallPost } from "@/lib/actions/wall";
import { ReactionBar } from "@/components/wall/reaction-bar";
import {
  CommentSection,
  type CommentVM,
} from "@/components/wall/comment-section";
import { LessonBody } from "@/components/lessons/lesson-body";
import { MediaEmbed } from "@/components/gallery/media-embed";
import { WallRealtime } from "@/components/wall/wall-realtime";

export const metadata = { title: "Post · Show & Tell · Yukti AI Labs" };

const REACTION_TYPES = ["clap", "love", "idea"] as const;
type ReactionTypeName = (typeof REACTION_TYPES)[number];

/**
 * Wall post detail — same data as the feed card, but full content:
 *   - Blog: title + cover (if any) + full markdown body
 *   - Update: full body text (no truncation)
 *   - Photo: large image + caption
 *
 * Pulls live reactions + comments. The Realtime CDC subscription on /wall
 * isn't running here — comments/reactions still POST through their existing
 * server actions so the page revalidates on interaction.
 *
 * Pending posts are visible to their author and to moderators. Others get a
 * 404 (so links don't leak unapproved content).
 */
export default async function WallPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const isMod = user.role === "admin" || user.role === "instructor";
  const { id } = await params;

  const post = await prisma.wallPost.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, email: true, handle: true } },
      reactions: { select: { type: true, userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  if (!post) notFound();

  // Visibility: approved → anyone; otherwise author + mods only.
  const canSee = post.approved || post.authorId === user.id || isMod;
  if (!canSee) notFound();

  const urls = post.imagePath
    ? await signedWallImageUrls([post.imagePath], 60 * 30)
    : null;
  const imageUrl = post.imagePath ? urls?.get(post.imagePath) : undefined;

  // Reactions: counts + which ones I have
  const counts: Record<ReactionTypeName, number> = {
    clap: 0,
    love: 0,
    idea: 0,
  };
  const mine: Record<ReactionTypeName, boolean> = {
    clap: false,
    love: false,
    idea: false,
  };
  for (const r of post.reactions) {
    const k = r.type as ReactionTypeName;
    counts[k] += 1;
    if (r.userId === user.id) mine[k] = true;
  }

  const commentsVM: CommentVM[] = post.comments.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    author: c.author,
  }));

  const displayName = post.author.name ?? post.author.email.split("@")[0];
  const isMine = post.authorId === user.id;
  const canDelete = isMod || isMine;

  const KIND_META = {
    photo: { label: "Photo", icon: "photo_camera" },
    update: { label: "Update", icon: "chat" },
    blog: { label: "Blog", icon: "edit_note" },
  } as const;
  const meta = KIND_META[post.kind];

  return (
    <main className="mx-auto w-full max-w-[860px] flex-1 px-4 md:px-12 py-12">
      {/* Realtime for reactions/comments — same as /wall */}
      <WallRealtime />

      <Link
        href="/wall"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        Show &amp; Tell
      </Link>

      {/* Status banners for non-approved posts */}
      {!post.approved && (
        <div className="mb-6 rounded-2xl border-2 border-dashed border-primary bg-primary-fixed p-4 text-sm text-on-primary-fixed">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[18px]">
              hourglass_top
            </span>
            {post.rejected ? "Rejected" : "Waiting for review"}
          </div>
          {post.rejected && post.rejectionReason && (
            <p className="mt-1 text-on-primary-fixed-variant">
              Reason: {post.rejectionReason}
            </p>
          )}
        </div>
      )}

      <article className="overflow-hidden rounded-[28px] border-2 border-outline-variant bg-card">
        {/* Hero image — photo/blog cover */}
        {imageUrl && (post.kind === "photo" || post.kind === "blog") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={post.title ?? post.caption ?? "Wall post"}
            className="block w-full"
          />
        )}

        <div className="p-6 md:p-10">
          {/* Kind + author + time strip */}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2.5 py-0.5 font-bold uppercase tracking-wider text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[12px]">
                {meta.icon}
              </span>
              {meta.label}
            </span>
            <span className="text-on-surface-variant">·</span>
            <Link
              href={
                post.author.handle
                  ? `/builders/${post.author.handle}`
                  : "/builders"
              }
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-2.5 py-0.5 font-bold text-on-surface hover:text-primary"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary-container text-[10px] text-on-secondary-container">
                {displayName.charAt(0).toUpperCase()}
              </span>
              {displayName}
            </Link>
            {isMine && (
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                you
              </span>
            )}
            <span className="text-on-surface-variant">
              {new Date(post.createdAt).toLocaleString()}
            </span>
          </div>

          {/* Title — blog only */}
          {post.kind === "blog" && post.title && (
            <h1 className="text-headline-lg mb-4 leading-tight text-on-surface">
              {post.title}
            </h1>
          )}

          {/* Caption — photo */}
          {post.kind === "photo" && post.caption && (
            <p className="mb-4 text-base text-on-surface-variant">
              {post.caption}
            </p>
          )}

          {/* Body — update + blog */}
          {(post.kind === "update" || post.kind === "blog") && post.body && (
            <div className="mb-6">
              {post.kind === "blog" ? (
                <LessonBody markdown={post.body} />
              ) : (
                <p className="whitespace-pre-line text-base leading-7 text-on-surface">
                  {post.body}
                </p>
              )}
            </div>
          )}

          {/* Media embeds — full list */}
          {post.mediaUrls.length > 0 && (
            <div className="mb-6 space-y-3">
              {post.mediaUrls.map((url) => (
                <MediaEmbed key={url} url={url} />
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {post.tags.map((t) => (
                <Link
                  key={t}
                  href={`/wall?tag=${encodeURIComponent(t)}`}
                  className="rounded-full bg-tertiary-fixed px-2.5 py-1 text-[11px] font-bold text-on-tertiary-fixed transition-colors hover:bg-tertiary hover:text-on-tertiary"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {/* Reactions */}
          <div className="mb-6 border-t border-outline-variant pt-5">
            <ReactionBar postId={post.id} counts={counts} mine={mine} />
          </div>

          {/* Comments */}
          <div className="border-t border-outline-variant pt-5">
            <CommentSection
              postId={post.id}
              currentUserId={user.id}
              isModerator={isMod}
              comments={commentsVM}
            />
          </div>

          {/* Delete */}
          {canDelete && (
            <form
              action={deleteWallPost}
              className="mt-6 border-t border-outline-variant pt-4"
            >
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="redirectTo" value="/wall" />
              <button
                type="submit"
                className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant transition-colors hover:text-destructive"
              >
                <span className="material-symbols-outlined text-[14px]">
                  delete
                </span>
                Remove this post
              </button>
            </form>
          )}
        </div>
      </article>
    </main>
  );
}
