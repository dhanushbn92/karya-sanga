import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db, hackathonConfig } from "@/lib/db";
import { UploadPostForm } from "@/components/wall/upload-post-form";

export const metadata = { title: "New post · Karya Sanga" };

export default async function NewWallPostPage() {
  const user = await requireUser();
  const [config] = await db
    .insert(hackathonConfig)
    .values({ id: "default", updatedAt: new Date() })
    .onConflictDoUpdate({ target: hackathonConfig.id, set: {} })
    .returning({ wallRequireApproval: hackathonConfig.wallRequireApproval });

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 md:px-12 py-12">
      <Link
        href="/wall"
        className="mb-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:text-primary"
      >
        <span className="material-symbols-outlined text-[14px]">
          arrow_back
        </span>
        Back to the wall
      </Link>

      <div className="rotate-sticker mb-4 inline-flex items-center gap-2 rounded-full border-2 border-white bg-tertiary-fixed px-3 py-1 text-on-tertiary-fixed shadow-sm">
        <span className="material-symbols-outlined text-[16px]">
          add_photo_alternate
        </span>
        <span className="text-xs font-bold tracking-wide">
          Share something
        </span>
      </div>
      <h1 className="text-headline-lg text-on-surface">New post</h1>
      <p className="mt-2 max-w-2xl text-on-surface-variant">
        Pick a kind: <strong>Photo</strong> for a quick snap,{" "}
        <strong>Update</strong> for a short text post, or{" "}
        <strong>Blog</strong> for a longer write-up.
        {config.wallRequireApproval
          ? " Posts go to an instructor for review before they show up on the wall."
          : " Posts go live straight away."}
      </p>

      <div className="mt-8">
        <UploadPostForm userId={user.id} />
      </div>
    </main>
  );
}
