/**
 * Colorful big-number stat tile, Duolingo / Khan Academy Kids vibe.
 * Used in the dashboard for streaks, XP, badges, etc.
 *
 * Each tile is a vivid color-block with a soft inner shadow on top, deep
 * stamped shadow on the bottom — feels like a stamped enamel pin.
 */
type Tone = "saffron" | "teal" | "purple" | "gold" | "rose" | "mint";

const TONES: Record<
  Tone,
  { bg: string; ink: string; stamp: string; ring: string }
> = {
  saffron: {
    bg: "linear-gradient(160deg, #ff8a3d 0%, #ff5c00 100%)",
    ink: "#ffffff",
    stamp: "#7a2900",
    ring: "rgba(167, 58, 0, 0.45)",
  },
  teal: {
    bg: "linear-gradient(160deg, #57fae9 0%, #006a62 100%)",
    ink: "#ffffff",
    stamp: "#003330",
    ring: "rgba(0, 106, 98, 0.45)",
  },
  purple: {
    bg: "linear-gradient(160deg, #c084fc 0%, #842bd2 100%)",
    ink: "#ffffff",
    stamp: "#5b1a91",
    ring: "rgba(132, 43, 210, 0.45)",
  },
  gold: {
    bg: "linear-gradient(160deg, #ffe066 0%, #f59e0b 100%)",
    ink: "#5b2a00",
    stamp: "#a86200",
    ring: "rgba(245, 158, 11, 0.45)",
  },
  rose: {
    bg: "linear-gradient(160deg, #fb7185 0%, #be123c 100%)",
    ink: "#ffffff",
    stamp: "#7a0a25",
    ring: "rgba(190, 18, 60, 0.45)",
  },
  mint: {
    bg: "linear-gradient(160deg, #6ee7b7 0%, #047857 100%)",
    ink: "#ffffff",
    stamp: "#024033",
    ring: "rgba(4, 120, 87, 0.45)",
  },
};

export function StatCard({
  icon,
  n,
  label,
  tone = "saffron",
  caption,
}: {
  icon: string;
  n: number | string;
  label: string;
  tone?: Tone;
  caption?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className="press-soft relative overflow-hidden rounded-[24px] p-4 transition-transform"
      style={{
        background: t.bg,
        color: t.ink,
        boxShadow: `0 5px 0 0 ${t.stamp}, 0 14px 32px -12px ${t.ring}`,
      }}
    >
      {/* Inner top highlight — gives a glossy enamel feel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-3 top-3 h-6 rounded-full"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div className="relative flex items-center gap-2">
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-widest">
          {label}
        </span>
      </div>
      <div className="relative mt-2 text-[40px] font-black leading-none tabular-nums">
        {n}
      </div>
      {caption && (
        <div className="relative mt-1 text-[11px] font-semibold opacity-80">
          {caption}
        </div>
      )}
    </div>
  );
}
