import { classifyEmbed, labelFor } from "@/lib/media-embed";

/**
 * Inline media renderer for project URLs.
 *
 * YouTube + Vimeo render as 16:9 iframes. SoundCloud renders as the official
 * 166px-tall player iframe. Direct audio/video files use native HTML5
 * players. Anything else is shown as a styled outbound link card.
 *
 * Embedded iframes use lazy loading + a referrerpolicy that lets the host
 * site count plays without exposing the workshop URL.
 */
export function MediaEmbed({ url }: { url: string }) {
  const embed = classifyEmbed(url);

  if (embed.kind === "youtube") {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border-2 border-outline-variant bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${embed.videoId}`}
          title="YouTube video"
          className="h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (embed.kind === "vimeo") {
    return (
      <div className="aspect-video overflow-hidden rounded-2xl border-2 border-outline-variant bg-black">
        <iframe
          src={`https://player.vimeo.com/video/${embed.videoId}`}
          title="Vimeo video"
          className="h-full w-full"
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (embed.kind === "soundcloud") {
    const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(embed.original)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-outline-variant">
        <iframe
          src={src}
          title="SoundCloud audio"
          className="block h-[166px] w-full"
          loading="lazy"
          allow="autoplay"
        />
      </div>
    );
  }

  if (embed.kind === "audio") {
    return (
      <div className="rounded-2xl border-2 border-outline-variant bg-surface-container-lowest p-3">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio src={embed.original} controls preload="none" className="w-full" />
      </div>
    );
  }

  if (embed.kind === "video") {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-outline-variant bg-black">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={embed.original}
          controls
          preload="none"
          className="block aspect-video w-full"
        />
      </div>
    );
  }

  if (embed.kind === "image") {
    return (
      <a
        href={embed.original}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-2xl border-2 border-outline-variant bg-surface-container-lowest"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={embed.original}
          alt="Attachment"
          className="block w-full"
          loading="lazy"
        />
      </a>
    );
  }

  if (embed.kind === "pdf") {
    return (
      <div className="overflow-hidden rounded-2xl border-2 border-outline-variant bg-surface-container-lowest">
        <iframe
          src={embed.original}
          title="PDF"
          className="block h-[640px] w-full"
          loading="lazy"
        />
        <div className="flex items-center justify-between border-t-2 border-outline-variant px-3 py-2 text-xs">
          <span className="font-bold text-on-surface-variant">PDF</span>
          <a
            href={embed.original}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
          >
            Open in new tab
            <span className="material-symbols-outlined text-[12px]">
              open_in_new
            </span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <a
      href={embed.original}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 rounded-xl border-2 border-outline-variant bg-surface-container-lowest px-3 py-2 transition-colors hover:border-primary"
    >
      <span className="material-symbols-outlined text-[16px] text-primary">
        link
      </span>
      <span className="font-bold text-on-surface group-hover:text-primary">
        {labelFor(embed)}
      </span>
      <span className="material-symbols-outlined ml-auto text-[14px] text-on-surface-variant">
        open_in_new
      </span>
    </a>
  );
}
