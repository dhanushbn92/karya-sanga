import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedWallImageUrls } from "@/lib/supabase/admin";
import { deleteWallPost } from "@/lib/actions/wall";
import { ReactionBar } from "@/components/wall/reaction-bar";
import { MediaEmbed } from "@/components/gallery/media-embed";
import {
  CommentSection,
  type CommentVM,
} from "@/components/wall/comment-section";
import { WallRealtime } from "@/components/wall/wall-realtime";

export const metadata = { title: "Show & Tell · Yukti AI Labs" };

const REACTION_TYPES = ["clap", "love", "idea"] as const;
type ReactionTypeName = (typeof REACTION_TYPES)[number];

/**
 * Community wall (locked 2026-06-27).
 *
 * Casual feed for snapshots, build-in-progress shots, "team of the week".
 * Light theme. Different from /gallery (polished portfolio) — wall is
 * faster, lower-friction, with reactions + threaded comments + Realtime CDC.
 *
 * Layout:
 *   1. Header — pill + h1 + subtitle + Post button + Moderate (mods only)
 *   2. Stats strip — total posts + your posts + my pending count
 *   3. Pending banner — your posts waiting for review (with thumbs)
 *   4. Filter chips — All / Mine / tag pills
 *   5. Masonry feed — image cards with reactions + comments
 */
type FilterMode = "all" | "mine";
type KindFilter = "all" | "photo" | "update" | "blog";

export default async function WallPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tag?: string; kind?: string }>;
}) {
  const user = await requireUser();
  const isMod = user.role === "admin" || user.role === "instructor";
  const { filter, tag, kind } = await searchParams;
  const mode: FilterMode = filter === "mine" ? "mine" : "all";
  const kindFilter: KindFilter =
    kind === "photo" || kind === "update" || kind === "blog" ? kind : "all";

  // Build feed filter
  const feedWhere: {
    approved: boolean;
    authorId?: string;
    tags?: { has: string };
    kind?: "photo" | "update" | "blog";
  } = { approved: true };
  if (mode === "mine") feedWhere.authorId = user.id;
  if (tag) feedWhere.tags = { has: tag.toLowerCase() };
  if (kindFilter !== "all") feedWhere.kind = kindFilter;

  const [approvedPosts, myPending, totalCount, myCount, allTagsRaw] =
    await Promise.all([
      prisma.wallPost.findMany({
        where: feedWhere,
        orderBy: { createdAt: "desc" },
        take: 60,
        include: {
          author: { select: { id: true, name: true, email: true } },
          reactions: { select: { type: true, userId: true } },
          comments: {
            orderBy: { createdAt: "asc" },
            include: {
              author: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.wallPost.findMany({
        where: { authorId: user.id, approved: false },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      prisma.wallPost.count({ where: { approved: true } }),
      prisma.wallPost.count({
        where: { approved: true, authorId: user.id },
      }),
      // Cheap distinct-tag sampling — pull recent posts' tags, dedupe in JS.
      prisma.wallPost.findMany({
        where: { approved: true },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { tags: true },
      }),
    ]);

  // Image paths only — nullable for update / cover-less blog rows.
  const allPaths = [
    ...approvedPosts.map((p) => p.imagePath).filter((p): p is string => !!p),
    ...myPending.map((p) => p.imagePath).filter((p): p is string => !!p),
  ];
  const urls = await signedWallImageUrls(allPaths, 60 * 30);

  // Distinct tag set across recent posts
  const tagCounts = new Map<string, number>();
  for (const p of allTagsRaw) {
    for (const t of p.tags) {
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }
  const popularTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-12 py-12">
      <WallRealtime />

      {/* ──────────────────────────────────────────────────────────
       * Header
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="rotate-sticker mb-3 inline-flex items-center gap-2 rounded-full border-2 border-white bg-secondary-container px-3 py-1 text-on-secondary-container shadow-sm">
            <span className="material-symbols-outlined text-[16px]">
              photo_library
            </span>
            <span className="text-xs font-bold tracking-wide">Show &amp; Tell</span>
          </div>
          <h1 className="text-headline-lg text-on-surface">
            Show what you&apos;re making
          </h1>
          <p className="mt-2 max-w-2xl text-on-surface-variant">
            Snap a photo of what you&apos;re building right now. Clap,
            love, and comment show up for everyone in real time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isMod && (
            <Link
              href="/admin/wall"
              className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant bg-card px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[16px]">
                gavel
              </span>
              Moderate
            </Link>
          )}
          <Link
            href="/wall/new"
            className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[16px]">
              edit_square
            </span>
            New post
          </Link>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────
       * Stats strip
       * ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Stat icon="photo_library" label={`${totalCount} total`} />
        <Stat icon="person" label={`${myCount} by you`} />
        {myPending.length > 0 && (
          <Stat
            icon="pending"
            label={`${myPending.length} pending`}
            tone="warn"
          />
        )}
      </div>

      {/* ──────────────────────────────────────────────────────────
       * Pending banner (compact, only if any)
       * ────────────────────────────────────────────────────────── */}
      {myPending.length > 0 && (
        <section className="mb-8 rounded-[24px] border-2 border-primary bg-primary-fixed p-5 text-on-primary-fixed">
          <div className="mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              hourglass_top
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Your posts waiting for review ({myPending.length})
            </h2>
          </div>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {myPending.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border-2 border-white/30 bg-card p-2 text-on-surface"
              >
                {p.imagePath && urls.get(p.imagePath) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls.get(p.imagePath)}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-surface-container">
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
                      {p.kind === "blog"
                        ? "edit_note"
                        : p.kind === "update"
                          ? "chat"
                          : "image"}
                    </span>
                  </div>
                )}
                <div className="min-w-0 text-xs">
                  <div
                    className={`font-bold ${p.rejected ? "text-destructive" : "text-on-surface-variant"}`}
                  >
                    {p.rejected ? "Rejected" : "Pending"}
                  </div>
                  {p.rejected && p.rejectionReason && (
                    <div className="line-clamp-2 text-on-surface-variant">
                      {p.rejectionReason}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────
       * Filter chips
       * ────────────────────────────────────────────────────────── */}
      <nav className="mb-3 flex flex-wrap items-center gap-2">
        <FilterPill
          href={buildHref({ filter: undefined, tag, kind: kindFilter })}
          label="All"
          active={mode === "all"}
        />
        <FilterPill
          href={buildHref({ filter: "mine", tag, kind: kindFilter })}
          label="Mine"
          active={mode === "mine"}
          icon="person"
        />
        <span className="mx-2 text-xs text-on-surface-variant">·</span>
        <FilterPill
          href={buildHref({ filter: mode === "mine" ? "mine" : undefined, tag })}
          label="Any kind"
          active={kindFilter === "all"}
        />
        <FilterPill
          href={buildHref({
            filter: mode === "mine" ? "mine" : undefined,
            tag,
            kind: "photo",
          })}
          label="Photos"
          icon="photo_camera"
          active={kindFilter === "photo"}
        />
        <FilterPill
          href={buildHref({
            filter: mode === "mine" ? "mine" : undefined,
            tag,
            kind: "update",
          })}
          label="Updates"
          icon="chat"
          active={kindFilter === "update"}
        />
        <FilterPill
          href={buildHref({
            filter: mode === "mine" ? "mine" : undefined,
            tag,
            kind: "blog",
          })}
          label="Blogs"
          icon="edit_note"
          active={kindFilter === "blog"}
        />
      </nav>
      {popularTags.length > 0 && (
        <nav className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
            Tags
          </span>
          {popularTags.map(([t, count]) => (
            <FilterPill
              key={t}
              href={buildHref({
                filter: mode === "mine" ? "mine" : undefined,
                tag: tag === t ? undefined : t,
                kind: kindFilter,
              })}
              label={`#${t}`}
              count={count}
              active={tag === t}
            />
          ))}
        </nav>
      )}

      {/* ──────────────────────────────────────────────────────────
       * Feed (masonry)
       * ────────────────────────────────────────────────────────── */}
      {approvedPosts.length === 0 ? (
        <EmptyState mode={mode} tag={tag} totalCount={totalCount} />
      ) : (
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {approvedPosts.map((p) => {
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
            for (const r of p.reactions) {
              const k = r.type as ReactionTypeName;
              counts[k] += 1;
              if (r.userId === user.id) mine[k] = true;
            }
            const commentsVM: CommentVM[] = p.comments.map((c) => ({
              id: c.id,
              body: c.body,
              createdAt: c.createdAt,
              author: c.author,
            }));
            return (
              <WallCard
                key={p.id}
                post={{
                  id: p.id,
                  kind: p.kind,
                  title: p.title,
                  body: p.body,
                  caption: p.caption,
                  tags: p.tags,
                  mediaUrls: p.mediaUrls,
                  createdAt: p.createdAt,
                  imagePath: p.imagePath,
                  authorId: p.authorId,
                  author: p.author,
                }}
                url={p.imagePath ? urls.get(p.imagePath) : undefined}
                canDelete={isMod || p.authorId === user.id}
                currentUserId={user.id}
                isMod={isMod}
                counts={counts}
                mine={mine}
                comments={commentsVM}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}

// ─── helpers ─────────────────────────────────────────────────────

function buildHref(params: {
  filter?: string;
  tag?: string;
  kind?: KindFilter;
}): string {
  const qs = new URLSearchParams();
  if (params.filter) qs.set("filter", params.filter);
  if (params.tag) qs.set("tag", params.tag);
  if (params.kind && params.kind !== "all") qs.set("kind", params.kind);
  const str = qs.toString();
  return str ? `/wall?${str}` : "/wall";
}

function Stat({
  icon,
  label,
  tone = "default",
}: {
  icon: string;
  label: string;
  tone?: "default" | "warn";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        tone === "warn"
          ? "bg-primary-fixed text-on-primary-fixed-variant"
          : "bg-surface-container text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[14px]">{icon}</span>
      {label}
    </span>
  );
}

function FilterPill({
  href,
  label,
  count,
  active,
  icon,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
  icon?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors ${
        active
          ? "border-primary bg-primary-fixed text-on-primary-fixed-variant"
          : "border-outline-variant bg-card text-on-surface-variant hover:border-primary hover:text-primary"
      }`}
    >
      {icon && (
        <span className="material-symbols-outlined text-[12px]">{icon}</span>
      )}
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0 text-[10px] ${
            active
              ? "bg-on-primary-fixed-variant text-primary-fixed"
              : "bg-surface-container text-on-surface-variant"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function EmptyState({
  mode,
  tag,
  totalCount,
}: {
  mode: FilterMode;
  tag: string | undefined;
  totalCount: number;
}) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-outline-variant bg-card p-12 text-center">
      <span className="material-symbols-outlined mb-3 text-5xl text-on-surface-variant">
        photo_camera
      </span>
      <h2 className="text-headline-md text-on-surface">
        {mode === "mine" ? (
          totalCount === 0 ? (
            "Be the first to post."
          ) : (
            "You haven't posted yet."
          )
        ) : tag ? (
          <>No posts tagged #{tag} yet.</>
        ) : (
          "The wall is empty."
        )}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-on-surface-variant">
        {mode === "mine"
          ? "Show off your build. Even half-wired breadboards count."
          : "Snap something you're building and share it with everyone."}
      </p>
      <Link
        href="/wall/new"
        className="sticker-shadow mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary"
      >
        <span className="material-symbols-outlined text-[16px]">
          edit_square
        </span>
        New post
      </Link>
    </div>
  );
}

function WallCard({
  post,
  url,
  canDelete,
  currentUserId,
  isMod,
  counts,
  mine,
  comments,
}: {
  post: {
    id: string;
    kind: "photo" | "update" | "blog";
    title: string | null;
    body: string | null;
    caption: string | null;
    tags: string[];
    mediaUrls: string[];
    createdAt: Date;
    imagePath: string | null;
    authorId: string;
    author: { name: string | null; email: string };
  };
  url: string | undefined;
  canDelete: boolean;
  currentUserId: string;
  isMod: boolean;
  counts: Record<ReactionTypeName, number>;
  mine: Record<ReactionTypeName, boolean>;
  comments: CommentVM[];
}) {
  const displayName = post.author.name ?? post.author.email.split("@")[0];
  const isMine = post.authorId === currentUserId;

  const KIND_META = {
    photo: { label: "Photo", icon: "photo_camera" },
    update: { label: "Update", icon: "chat" },
    blog: { label: "Blog", icon: "edit_note" },
  } as const;
  const meta = KIND_META[post.kind];

  return (
    <article
      className={`mb-4 break-inside-avoid overflow-hidden rounded-[24px] border-2 bg-card transition-colors ${
        isMine
          ? "border-secondary/40 ring-2 ring-secondary/10"
          : "border-outline-variant"
      }`}
    >
      {/* Cover image — photo always, blog if a cover was uploaded */}
      {url && (post.kind === "photo" || post.kind === "blog") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={post.title ?? post.caption ?? "Wall post"}
          className="block w-full"
          loading="lazy"
        />
      )}
      {/* Photo with broken url */}
      {post.kind === "photo" && !url && (
        <div className="aspect-square w-full bg-surface-container text-center text-on-surface-variant">
          <span className="block py-12 text-sm">image unavailable</span>
        </div>
      )}

      <div className="p-4">
        {/* Header — kind chip + author + time */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-on-secondary-container">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-bold text-on-surface">
              {displayName}
            </span>
            {isMine && (
              <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
                you
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {post.kind !== "photo" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed">
                <span className="material-symbols-outlined text-[12px]">
                  {meta.icon}
                </span>
                {meta.label}
              </span>
            )}
            <Link
              href={`/wall/${post.id}`}
              className="text-[11px] text-on-surface-variant hover:text-primary"
              title="Open this post"
            >
              {timeAgo(post.createdAt)}
            </Link>
          </div>
        </div>

        {/* Body — varies by kind */}
        {post.kind === "blog" && post.title && (
          <h3 className="mb-1 text-base font-black leading-tight text-on-surface">
            {post.title}
          </h3>
        )}
        {post.kind === "photo" && post.caption && (
          <p className="mb-2 text-sm text-on-surface-variant">
            {post.caption}
          </p>
        )}
        {(post.kind === "update" || post.kind === "blog") && post.body && (
          <p
            className={`mb-2 whitespace-pre-line text-sm text-on-surface-variant ${
              post.kind === "blog" ? "line-clamp-6" : ""
            }`}
          >
            {post.body}
          </p>
        )}
        {post.kind === "blog" && (
          <Link
            href={`/wall/${post.id}`}
            className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            Read full post
            <span className="material-symbols-outlined text-[12px]">
              arrow_forward
            </span>
          </Link>
        )}

        {/* Media embeds — show up to first 2 in the feed; full list on detail */}
        {post.mediaUrls.length > 0 && (
          <div className="mb-3 space-y-2">
            {post.mediaUrls.slice(0, 2).map((url) => (
              <MediaEmbed key={url} url={url} />
            ))}
            {post.mediaUrls.length > 2 && (
              <Link
                href={`/wall/${post.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                +{post.mediaUrls.length - 2} more attachment
                {post.mediaUrls.length - 2 === 1 ? "" : "s"} →
              </Link>
            )}
          </div>
        )}

        {post.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {post.tags.map((t) => (
              <Link
                key={t}
                href={`/wall?tag=${encodeURIComponent(t)}`}
                className="rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold text-on-tertiary-fixed transition-colors hover:bg-tertiary hover:text-on-tertiary"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {/* Reactions */}
        <div className="mb-3">
          <ReactionBar postId={post.id} counts={counts} mine={mine} />
        </div>

        {/* Comments */}
        <CommentSection
          postId={post.id}
          currentUserId={currentUserId}
          isModerator={isMod}
          comments={comments}
        />

        {canDelete && (
          <form action={deleteWallPost} className="mt-3">
            <input type="hidden" name="id" value={post.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant transition-colors hover:text-destructive"
            >
              <span className="material-symbols-outlined text-[12px]">
                delete
              </span>
              Remove
            </button>
          </form>
        )}
      </div>
    </article>
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
