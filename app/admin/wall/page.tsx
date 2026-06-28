import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signedWallImageUrls } from "@/lib/supabase/admin";
import {
  approveWallPost,
  deleteWallPost,
  rejectWallPost,
  updateWallConfig,
} from "@/lib/actions/wall";

export const metadata = { title: "Wall moderation · Admin" };

export default async function WallAdminPage() {
  await requireRole(["admin", "instructor"]);

  const [config, pending, recent] = await Promise.all([
    prisma.hackathonConfig.upsert({
      where: { id: "default" },
      create: { id: "default" },
      update: {},
      select: { wallRequireApproval: true },
    }),
    prisma.wallPost.findMany({
      where: { approved: false, rejected: false },
      orderBy: { createdAt: "asc" },
      take: 30,
      include: { author: { select: { name: true, email: true } } },
    }),
    prisma.wallPost.findMany({
      where: { approved: true },
      orderBy: { approvedAt: "desc" },
      take: 12,
      include: { author: { select: { name: true, email: true } } },
    }),
  ]);

  const urls = await signedWallImageUrls(
    [...pending, ...recent]
      .map((p) => p.imagePath)
      .filter((p): p is string => !!p),
    60 * 30,
  );

  return (
    <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 md:px-16 py-12">
      <Link
        href="/admin"
        className="mono-label mb-3 inline-flex items-center gap-1 text-on-surface-variant hover:text-primary"
      >
        ← Admin home
      </Link>
      <span className="mono-label mb-3 block text-primary">
        Modern Ashram · Wall moderation
      </span>
      <h1 className="text-headline-lg text-on-surface">Photo wall</h1>
      <p className="mt-2 text-on-surface-variant">
        Approve, reject, or delete posts. With approval on, no post is visible
        to participants until you stamp it.
      </p>

      {/* Config */}
      <section className="glass-card mt-8 rounded-3xl p-6">
        <form
          action={updateWallConfig}
          className="flex flex-wrap items-center gap-4"
        >
          <label
            htmlFor="wallRequireApproval"
            className="flex items-center gap-3"
          >
            <input
              id="wallRequireApproval"
              type="checkbox"
              name="wallRequireApproval"
              defaultChecked={config.wallRequireApproval}
              className="h-5 w-5 rounded border border-white/20 bg-surface-container-low text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium text-on-surface">
              Require instructor approval before posts go live
            </span>
          </label>
          <button
            type="submit"
            className="mono-label inline-flex items-center gap-1 rounded-full border border-primary/40 px-3 py-1 text-primary hover:bg-primary/10"
          >
            Save
          </button>
        </form>
      </section>

      {/* Pending queue */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-headline-md text-on-surface">
            Awaiting review
          </h2>
          <span className="mono-label text-on-surface-variant">
            {pending.length} post{pending.length === 1 ? "" : "s"}
          </span>
        </div>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            Inbox zero. Nice.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {pending.map((p) => {
              const url = p.imagePath ? urls.get(p.imagePath) : undefined;
              const name = p.author.name ?? p.author.email.split("@")[0];
              return (
                <article
                  key={p.id}
                  className="glass-card flex gap-4 rounded-2xl p-4"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      className="h-32 w-32 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-32 w-32 shrink-0 rounded-xl bg-surface-container" />
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="text-sm font-medium text-on-surface">
                        {name}
                      </div>
                      <div className="mono-label text-on-surface-variant">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                    {p.caption && (
                      <p className="line-clamp-3 text-sm text-on-surface-variant">
                        {p.caption}
                      </p>
                    )}
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <form action={approveWallPost}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-on-primary hover:brightness-110"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            check
                          </span>
                          Approve
                        </button>
                      </form>
                      <details className="relative">
                        <summary className="mono-label inline-flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive">
                          <span className="material-symbols-outlined text-[12px]">
                            block
                          </span>
                          Reject
                        </summary>
                        <form
                          action={rejectWallPost}
                          className="absolute z-10 mt-2 w-72 space-y-2 rounded-2xl border border-white/10 bg-surface-container p-3"
                        >
                          <input type="hidden" name="id" value={p.id} />
                          <input
                            name="reason"
                            placeholder="Reason (visible to author)"
                            maxLength={280}
                            className="w-full rounded-lg border border-white/10 bg-surface-container-low px-3 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                          />
                          <button
                            type="submit"
                            className="mono-label w-full rounded-full bg-destructive/10 px-3 py-1.5 text-destructive hover:bg-destructive/20"
                          >
                            Reject post
                          </button>
                        </form>
                      </details>
                      <form action={deleteWallPost}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive"
                        >
                          <span className="material-symbols-outlined text-[12px]">
                            delete
                          </span>
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Recently approved */}
      <section className="mt-12">
        <h2 className="text-headline-md mb-4 text-on-surface">
          Recently approved
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-surface-container-low p-6 text-on-surface-variant">
            Nothing approved yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {recent.map((p) => {
              const url = p.imagePath ? urls.get(p.imagePath) : undefined;
              return (
                <div
                  key={p.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-surface-container-low"
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full bg-surface-container" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
