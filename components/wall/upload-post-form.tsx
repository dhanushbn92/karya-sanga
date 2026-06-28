"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { createWallPost } from "@/lib/actions/wall";

/**
 * Wall composer — supports three post kinds:
 *   • photo  — image required, optional caption + tags
 *   • update — short text-only post (≤ 1000 chars) + tags
 *   • blog   — title + body (markdown) + optional cover image + tags
 *
 * The Photo flow has not changed: browser uploads to Supabase Storage then
 * POSTs the storage path. Update + Blog skip the upload (unless Blog has a
 * cover image), so they go straight to the server action.
 */

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_BYTES = 5 * 1024 * 1024;
const BUCKET = "wall-images";

type Kind = "photo" | "update" | "blog";

const KINDS: Array<{ id: Kind; label: string; icon: string; copy: string }> = [
  {
    id: "photo",
    label: "Photo",
    icon: "photo_camera",
    copy: "A snapshot of what you're building right now.",
  },
  {
    id: "update",
    label: "Update",
    icon: "chat",
    copy: "Quick text — a thought, question, or shout-out.",
  },
  {
    id: "blog",
    label: "Blog",
    icon: "edit_note",
    copy: "Long-form write-up with a title and an optional cover image.",
  },
];

export function UploadPostForm({ userId }: { userId: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [media, setMedia] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFile(picked: File | undefined) {
    if (!picked) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!ALLOWED_MIME.has(picked.type)) {
      toast.error("Use a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error("Image is over 5 MB. Pick a smaller one.");
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  function clearPreview() {
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Per-kind front-end gates (server validates again).
    if (kind === "photo" && !file) {
      toast.error("Pick an image first.");
      return;
    }
    if (kind === "update" && !body.trim()) {
      toast.error("Write your update.");
      return;
    }
    if (kind === "blog" && (!title.trim() || !body.trim())) {
      toast.error("Blog posts need a title and a body.");
      return;
    }

    let path: string | null = null;

    // Upload the image (if any) to Supabase Storage.
    if (file) {
      setIsUploading(true);
      try {
        const supabase = createClient();
        const ext =
          file.name
            .split(".")
            .pop()
            ?.toLowerCase()
            .replace(/[^a-z0-9]/g, "") || "jpg";
        path = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            contentType: file.type,
            cacheControl: "3600",
            upsert: false,
          });
        if (upErr) {
          toast.error(`Upload failed: ${upErr.message}`);
          setIsUploading(false);
          return;
        }
      } finally {
        setIsUploading(false);
      }
    }

    const fd = new FormData();
    fd.set("kind", kind);
    if (path) fd.set("imagePath", path);
    if (kind === "photo" && caption.trim()) fd.set("caption", caption.trim());
    if (kind === "blog" && title.trim()) fd.set("title", title.trim());
    if ((kind === "update" || kind === "blog") && body.trim())
      fd.set("body", body.trim());
    if (tags.trim()) fd.set("tags", tags.trim());
    if (media.trim()) fd.set("media", media.trim());

    startTransition(async () => {
      try {
        await createWallPost(fd);
        toast.success("Posted!");
        router.push("/wall");
        router.refresh();
      } catch (err) {
        // Clean up orphaned upload if the DB insert failed.
        if (path) {
          const supabase = createClient();
          await supabase.storage
            .from(BUCKET)
            .remove([path])
            .catch(() => {});
        }
        toast.error(err instanceof Error ? err.message : "Failed to post");
      }
    });
  }

  const busy = isUploading || isPending;
  const activeKind = KINDS.find((k) => k.id === kind)!;
  const showImagePicker = kind === "photo" || kind === "blog";
  const imageRequired = kind === "photo";

  return (
    <form
      onSubmit={handleSubmit}
      className="sticker-shadow rounded-[32px] border-2 border-outline-variant bg-card p-6 md:p-8"
    >
      {/* Kind switcher */}
      <div
        role="tablist"
        aria-label="Post type"
        className="mb-6 inline-flex rounded-full border-2 border-outline-variant bg-surface-container-lowest p-1"
      >
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => setKind(k.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              kind === k.id
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {k.icon}
            </span>
            {k.label}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm text-on-surface-variant">{activeKind.copy}</p>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Image picker — photo (required) or blog cover (optional) */}
        {showImagePicker && (
          <div className="md:col-span-5">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              {imageRequired ? "Image" : "Cover image (optional)"}
            </span>
            {preview ? (
              <div className="group relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="aspect-square w-full rounded-2xl object-cover"
                />
                <button
                  type="button"
                  onClick={clearPreview}
                  className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card text-on-surface shadow-md transition-colors hover:text-destructive"
                  aria-label="Remove image"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    close
                  </span>
                </button>
              </div>
            ) : (
              <label
                htmlFor="wall-file"
                className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-container-low transition-colors hover:border-primary hover:bg-surface-container"
              >
                <span className="material-symbols-outlined text-[40px] text-primary">
                  add_photo_alternate
                </span>
                <span className="text-sm font-bold text-on-surface">
                  {imageRequired ? "Pick an image" : "Add a cover (optional)"}
                </span>
                <span className="text-xs text-on-surface-variant">
                  JPG · PNG · WebP · GIF · up to 5 MB
                </span>
              </label>
            )}
            <input
              ref={fileInput}
              id="wall-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
        )}

        {/* Right column — kind-specific text fields */}
        <div
          className={`space-y-4 ${showImagePicker ? "md:col-span-7" : "md:col-span-12"}`}
        >
          {/* Blog title */}
          {kind === "blog" && (
            <label className="block space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Title
              </span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={140}
                placeholder="The week we got the soil sensor talking"
                className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              <span className="text-[11px] text-on-surface-variant">
                {title.length}/140
              </span>
            </label>
          )}

          {/* Photo caption */}
          {kind === "photo" && (
            <label className="block space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Caption (optional)
              </span>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="What's happening in this picture?"
                className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              <span className="text-[11px] text-on-surface-variant">
                {caption.length}/500
              </span>
            </label>
          )}

          {/* Body — update + blog */}
          {(kind === "update" || kind === "blog") && (
            <label className="block space-y-1">
              <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                {kind === "update" ? "Your update" : "Body (markdown ok)"}
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={kind === "update" ? 1000 : 10_000}
                rows={kind === "update" ? 4 : 12}
                placeholder={
                  kind === "update"
                    ? "Shipped the line-follower today!"
                    : "Tell the story — what you tried, what worked, what didn't."
                }
                className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
              />
              <span className="text-[11px] text-on-surface-variant">
                {body.length}/{kind === "update" ? 1000 : 10_000}
              </span>
            </label>
          )}

          <label className="block space-y-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Media (optional — paste YouTube, Vimeo, SoundCloud, image, PDF
              URLs; one per line)
            </span>
            <textarea
              value={media}
              onChange={(e) => setMedia(e.target.value)}
              maxLength={4000}
              rows={3}
              placeholder={"https://www.youtube.com/watch?v=…\nhttps://example.com/diagram.png"}
              className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
            <span className="text-[11px] text-on-surface-variant">
              Up to 8 URLs. Embeds render below the post.
            </span>
          </label>

          <label className="block space-y-1">
            <span className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Tags (comma-separated, optional)
            </span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              maxLength={200}
              placeholder="esp32, robot, demo-day"
              className="w-full rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={busy}
              className="sticker-shadow inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[18px]">
                send
              </span>
              {isUploading
                ? "Uploading…"
                : isPending
                  ? "Posting…"
                  : "Post"}
            </button>
            <button
              type="button"
              onClick={() => router.push("/wall")}
              className="inline-flex items-center gap-2 rounded-full border-2 border-outline-variant px-5 py-2 font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
