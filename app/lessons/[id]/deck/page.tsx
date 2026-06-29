import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, lesson as lessonTable } from "@/lib/db";
import { signedLessonSlideUrl } from "@/lib/supabase/admin";

export const metadata = { title: "Slides · Karya Sanga" };

const PDF_MIME = "application/pdf";
const PPT_MIMES = new Set([
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export default async function DeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const lesson = await db.query.lesson.findFirst({
    where: eq(lessonTable.id, id),
    with: { module: { columns: { title: true } } },
  });
  if (!lesson) notFound();

  // Mint the signed URL once, server-side. It's good for 2 hours (long
  // enough for a workshop session). Browser PDF viewer + Office Online
  // viewer both happily consume signed URLs.
  const signedUrl = lesson.slideFilePath
    ? await signedLessonSlideUrl(lesson.slideFilePath, 60 * 60 * 2)
    : null;

  const isPdf = lesson.slideFileType === PDF_MIME;
  const isPpt = lesson.slideFileType
    ? PPT_MIMES.has(lesson.slideFileType)
    : false;

  return (
    <main className="flex h-full flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/anaadi-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-auto object-contain"
          />
          <div className="leading-tight">
            <div className="text-base font-bold text-primary">
              {lesson.title}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
              {lesson.module.title} · slide deck
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {signedUrl && (
            <a
              href={signedUrl}
              download={lesson.slideFileName ?? undefined}
              className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-on-surface-variant hover:border-primary/40 hover:text-primary"
            >
              <span className="material-symbols-outlined text-[14px]">
                download
              </span>
              Download
            </a>
          )}
          <Link
            href={`/lessons/${lesson.id}`}
            className="mono-label inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-on-surface-variant hover:border-primary/40 hover:text-primary"
          >
            <span className="material-symbols-outlined text-[14px]">
              close
            </span>
            Close
          </Link>
        </div>
      </header>

      {/* Viewer */}
      {!signedUrl || !lesson.slideFileType ? (
        <EmptyState lessonId={lesson.id} />
      ) : isPdf ? (
        <PdfViewer src={signedUrl} />
      ) : isPpt ? (
        <PptViewer src={signedUrl} fileName={lesson.slideFileName} />
      ) : (
        <UnsupportedState
          mime={lesson.slideFileType}
          downloadUrl={signedUrl}
          fileName={lesson.slideFileName}
        />
      )}
    </main>
  );
}

function PdfViewer({ src }: { src: string }) {
  // Browsers render PDFs natively in an iframe. We pass #toolbar=1&view=FitH
  // hints so Chrome / Firefox start with sensible defaults.
  return (
    <iframe
      title="Slide deck"
      src={`${src}#toolbar=1&navpanes=0&view=FitH`}
      className="flex-1 border-0 bg-surface-container-lowest"
    />
  );
}

function PptViewer({
  src,
  fileName,
}: {
  src: string;
  fileName: string | null;
}) {
  // Microsoft Office Online viewer fetches the file from its servers, so
  // the signed URL must be reachable from the public internet. Won't work
  // on localhost — surface that to the user instead of showing a broken
  // iframe forever.
  const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(src)}`;

  return (
    <>
      <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-2 text-xs text-on-surface-variant">
        <span className="font-bold text-amber-300">Note:</span> PPT previews
        use Microsoft&apos;s Office Online viewer, which fetches the file
        from its servers. It works on a deployed site but not on{" "}
        <code className="font-mono">localhost</code>. Use{" "}
        <span className="font-bold">Download</span> to open locally, or
        upload a PDF for inline preview that works everywhere.{" "}
        {fileName && (
          <span className="text-on-surface-variant">({fileName})</span>
        )}
      </div>
      <iframe
        title="Slide deck"
        src={officeUrl}
        className="flex-1 border-0 bg-surface-container-lowest"
      />
    </>
  );
}

function UnsupportedState({
  mime,
  downloadUrl,
  fileName,
}: {
  mime: string;
  downloadUrl: string;
  fileName: string | null;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-3xl border border-white/10 bg-surface-container-low p-8 text-center">
        <span className="material-symbols-outlined mb-3 text-3xl text-primary">
          help
        </span>
        <h2 className="text-headline-md mb-2 text-on-surface">
          Unsupported file type
        </h2>
        <p className="text-on-surface-variant">
          The attached file is <code className="font-mono">{mime}</code>,
          which we don&apos;t preview inline.
        </p>
        <a
          href={downloadUrl}
          download={fileName ?? undefined}
          className="mono-label mt-6 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-on-primary hover:brightness-110"
        >
          <span className="material-symbols-outlined text-[14px]">
            download
          </span>
          Download {fileName ?? "the file"}
        </a>
      </div>
    </div>
  );
}

function EmptyState({ lessonId }: { lessonId: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-md rounded-3xl border border-dashed border-white/10 bg-surface-container-low p-8 text-center">
        <span className="material-symbols-outlined mb-3 text-3xl text-primary">
          slideshow
        </span>
        <h2 className="text-headline-md mb-2 text-on-surface">
          No deck attached yet
        </h2>
        <p className="text-on-surface-variant">
          Your instructor hasn&apos;t uploaded a PDF or PPT for this lesson.
        </p>
        <Link
          href={`/lessons/${lessonId}`}
          className="mono-label mt-6 inline-flex items-center gap-1 rounded-full border border-white/20 px-4 py-2 text-on-surface-variant hover:border-primary/40 hover:text-primary"
        >
          ← Back to lesson
        </Link>
      </div>
    </div>
  );
}
