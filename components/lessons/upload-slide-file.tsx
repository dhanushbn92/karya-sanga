"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  attachSlideFile,
  removeSlideFile,
} from "@/lib/actions/admin-lessons";

/**
 * Per-lesson PDF/PPT upload widget for the admin module edit page.
 *
 * Two states:
 *   - No file attached → file picker + Upload button
 *   - File attached    → filename + "Replace" + "Remove"
 *
 * The upload itself goes browser → Supabase Storage (RLS enforces the
 * <userId>/ prefix), then we POST the resulting path to attachSlideFile
 * which records it on the Lesson row.
 */
const ALLOWED_EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
};

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export function UploadSlideFile({
  lessonId,
  userId,
  currentFileName,
  currentFileType,
}: {
  lessonId: string;
  userId: string;
  currentFileName: string | null;
  currentFileType: string | null;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePick(picked: File | undefined) {
    if (!picked) {
      setFile(null);
      return;
    }
    if (!ALLOWED_EXT_BY_MIME[picked.type]) {
      toast.error("Use a PDF, PPT, or PPTX.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (picked.size > MAX_BYTES) {
      toast.error("File is over 50 MB. Slim it down or split it up.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setFile(picked);
  }

  async function handleUpload() {
    if (!file) {
      toast.error("Pick a file first.");
      return;
    }
    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = ALLOWED_EXT_BY_MIME[file.type];
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("lesson-slides")
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (upErr) {
        toast.error(`Upload failed: ${upErr.message}`);
        return;
      }

      const fd = new FormData();
      fd.set("lessonId", lessonId);
      fd.set("slideFilePath", path);
      fd.set("slideFileType", file.type);
      fd.set("slideFileName", file.name);

      startTransition(async () => {
        try {
          await attachSlideFile(fd);
          toast.success("Slides attached.");
          setFile(null);
          if (fileInput.current) fileInput.current.value = "";
          router.refresh();
        } catch (err) {
          // Clean up the orphaned upload if the DB write fails.
          await supabase.storage
            .from("lesson-slides")
            .remove([path])
            .catch(() => {});
          toast.error(err instanceof Error ? err.message : "Failed");
        }
      });
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemove() {
    if (!confirm("Remove the attached slides file?")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("lessonId", lessonId);
      try {
        await removeSlideFile(fd);
        toast.success("Removed.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const busy = isUploading || isPending;

  if (currentFileName) {
    const isPdf = currentFileType === "application/pdf";
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-surface-container-low p-3">
        <span className="material-symbols-outlined text-primary">
          {isPdf ? "picture_as_pdf" : "slideshow"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-on-surface">
          {currentFileName}
        </span>
        <span className="mono-label rounded-full bg-primary/10 px-2 py-0.5 text-primary">
          {isPdf ? "PDF" : "PPT"}
        </span>
        <label className="mono-label inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-primary/40 hover:text-primary">
          <span className="material-symbols-outlined text-[12px]">
            swap_horiz
          </span>
          Replace
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            onChange={(e) => {
              handlePick(e.target.files?.[0]);
              // Auto-upload on replacement pick.
              if (e.target.files?.[0]) {
                setTimeout(() => handleUpload(), 0);
              }
            }}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={handleRemove}
          disabled={busy}
          className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-on-surface-variant hover:border-destructive hover:text-destructive disabled:opacity-60"
        >
          <span className="material-symbols-outlined text-[12px]">delete</span>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-white/10 bg-surface-container-low p-3">
      <label className="mono-label inline-flex cursor-pointer items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-on-surface-variant hover:border-primary/40 hover:text-primary">
        <span className="material-symbols-outlined text-[14px]">
          attach_file
        </span>
        {file ? file.name : "Pick a PDF / PPT / PPTX"}
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={(e) => handlePick(e.target.files?.[0])}
          className="hidden"
        />
      </label>
      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || busy}
        className="mono-label inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-on-primary transition-transform hover:brightness-110 disabled:opacity-40"
      >
        <span className="material-symbols-outlined text-[14px]">
          cloud_upload
        </span>
        {busy ? "Uploading…" : "Upload slides"}
      </button>
      <span className="mono-label text-on-surface-variant">
        Max 50 MB. PPT renders only on the deployed site (not localhost).
      </span>
    </div>
  );
}
