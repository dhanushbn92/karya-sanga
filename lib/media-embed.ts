/**
 * Detect which kind of media a URL is, so the gallery detail page can render
 * a proper inline embed instead of a plain link.
 *
 * Recognized:
 *   - YouTube  (youtube.com/watch, youtu.be/, youtube.com/shorts)
 *   - Vimeo    (vimeo.com/<id>)
 *   - SoundCloud (player-iframe)
 *   - Direct audio files (.mp3 / .wav / .ogg / .m4a)
 *   - Direct video files (.mp4 / .webm / .mov)
 *
 * Anything else falls through to `kind: "link"` — the caller renders it as a
 * plain external link.
 */

export type EmbedKind =
  | "youtube"
  | "vimeo"
  | "soundcloud"
  | "audio"
  | "video"
  | "image"
  | "pdf"
  | "link";

export type Embed =
  | { kind: "youtube"; videoId: string; original: string }
  | { kind: "vimeo"; videoId: string; original: string }
  | { kind: "soundcloud"; original: string }
  | { kind: "audio"; original: string }
  | { kind: "video"; original: string }
  | { kind: "image"; original: string }
  | { kind: "pdf"; original: string }
  | { kind: "link"; original: string };

const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov)(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)(\?|#|$)/i;
const PDF_EXT = /\.pdf(\?|#|$)/i;

export function classifyEmbed(input: string): Embed {
  const url = input.trim();
  if (!url) return { kind: "link", original: url };

  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtube.com" || host === "m.youtube.com") {
      // /watch?v=ID or /shorts/ID
      const v = u.searchParams.get("v");
      if (v) return { kind: "youtube", videoId: v, original: url };
      const shorts = u.pathname.match(/^\/shorts\/([\w-]{6,})/);
      if (shorts) {
        return { kind: "youtube", videoId: shorts[1], original: url };
      }
    }
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\/+/, "").split("/")[0];
      if (id) return { kind: "youtube", videoId: id, original: url };
    }
    if (host === "vimeo.com") {
      const id = u.pathname.replace(/^\/+/, "").split("/")[0];
      if (/^\d+$/.test(id)) {
        return { kind: "vimeo", videoId: id, original: url };
      }
    }
    if (host === "soundcloud.com") {
      return { kind: "soundcloud", original: url };
    }
    if (AUDIO_EXT.test(u.pathname)) {
      return { kind: "audio", original: url };
    }
    if (VIDEO_EXT.test(u.pathname)) {
      return { kind: "video", original: url };
    }
    if (IMAGE_EXT.test(u.pathname)) {
      return { kind: "image", original: url };
    }
    if (PDF_EXT.test(u.pathname)) {
      return { kind: "pdf", original: url };
    }
  } catch {
    // Bad URL — fall through to link.
  }
  return { kind: "link", original: url };
}

/** Pretty label for a link card when we can't embed (e.g. SoundCloud). */
export function labelFor(embed: Embed): string {
  switch (embed.kind) {
    case "youtube":
      return "YouTube video";
    case "vimeo":
      return "Vimeo video";
    case "soundcloud":
      return "SoundCloud audio";
    case "audio":
      return "Audio file";
    case "video":
      return "Video file";
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    default:
      try {
        return new URL(embed.original).hostname.replace(/^www\./, "");
      } catch {
        return embed.original;
      }
  }
}
