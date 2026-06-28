/**
 * Friendly platform mascot — pure inline SVG so it stays crisp at any size,
 * ships zero asset bytes, and can be tinted via currentColor / props.
 *
 * Poses:
 *   - "wave"    (default) — greeting, friendly
 *   - "build"   — holding a tiny circuit board, used in lesson empty states
 *   - "cheer"   — celebrating, used after submissions / completions
 *   - "think"   — tilted head, used on error / empty / 404 surfaces
 *
 * Animations:
 *   - LED on the head pulses (1.8s)
 *   - eyes blink every ~5s
 *   - hand on `wave` does a friendly waggle
 *   - whole body has a gentle idle bob
 *
 * All animations respect prefers-reduced-motion.
 */
export function Mascot({
  pose = "wave",
  size = 160,
  className = "",
}: {
  pose?: "wave" | "build" | "cheer" | "think";
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="m-body" cx="40%" cy="35%" r="75%">
            <stop offset="0%" stopColor="#ff8a3d" />
            <stop offset="55%" stopColor="#ff5c00" />
            <stop offset="100%" stopColor="#a73a00" />
          </radialGradient>
          <radialGradient id="m-shine" cx="35%" cy="25%" r="35%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="m-eye" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#dffaff" />
          </radialGradient>
          <radialGradient id="m-led" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#ffd60a" />
            <stop offset="100%" stopColor="#ff6b35" />
          </radialGradient>
          <radialGradient id="m-led-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffd60a" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffd60a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="m-chip" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1ec9b8" />
            <stop offset="100%" stopColor="#006a62" />
          </linearGradient>
        </defs>

        {/* Soft drop shadow under body */}
        <ellipse cx="100" cy="178" rx="60" ry="6" fill="#000" opacity="0.18" />

        {/* Idle bob group */}
        <g className="m-idle">
          {/* Antenna halo */}
          <circle cx="100" cy="36" r="18" fill="url(#m-led-halo)" className="m-halo" />
          {/* Antenna stem */}
          <line
            x1="100"
            y1="44"
            x2="100"
            y2="62"
            stroke="#a73a00"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* LED */}
          <circle cx="100" cy="38" r="7" fill="url(#m-led)" className="m-led" />

          {/* Body — rounded blob */}
          <ellipse cx="100" cy="115" rx="58" ry="56" fill="url(#m-body)" />
          {/* Top shine */}
          <ellipse cx="86" cy="86" rx="44" ry="24" fill="url(#m-shine)" />

          {/* Side accents */}
          <circle cx="44" cy="118" r="6" fill="#ffd60a" />
          <circle cx="44" cy="118" r="2.5" fill="#a73a00" />
          <circle cx="156" cy="118" r="6" fill="#ffd60a" />
          <circle cx="156" cy="118" r="2.5" fill="#a73a00" />

          {/* Eyes */}
          {pose === "think" ? (
            <>
              {/* Thinking eyes — sideways look */}
              <ellipse cx="78" cy="108" rx="13" ry="14" fill="#1a0b2e" />
              <ellipse cx="122" cy="108" rx="13" ry="14" fill="#1a0b2e" />
              <circle cx="83" cy="105" r="10" fill="url(#m-eye)" />
              <circle cx="127" cy="105" r="10" fill="url(#m-eye)" />
              <circle cx="86" cy="105" r="4" fill="#1a0b2e" />
              <circle cx="130" cy="105" r="4" fill="#1a0b2e" />
            </>
          ) : (
            <>
              <g className="m-eye">
                <ellipse cx="78" cy="108" rx="13" ry="14" fill="#1a0b2e" />
                <circle cx="78" cy="108" r="10" fill="url(#m-eye)" />
                <circle cx="76" cy="105" r="4" fill="#1a0b2e" />
                <circle cx="82" cy="113" r="2" fill="#ffffff" />
              </g>
              <g className="m-eye" style={{ animationDelay: "0.4s" }}>
                <ellipse cx="122" cy="108" rx="13" ry="14" fill="#1a0b2e" />
                <circle cx="122" cy="108" r="10" fill="url(#m-eye)" />
                <circle cx="120" cy="105" r="4" fill="#1a0b2e" />
                <circle cx="126" cy="113" r="2" fill="#ffffff" />
              </g>
            </>
          )}

          {/* Blush */}
          <ellipse cx="62" cy="130" rx="10" ry="5" fill="#ff4d8d" opacity="0.45" />
          <ellipse cx="138" cy="130" rx="10" ry="5" fill="#ff4d8d" opacity="0.45" />

          {/* Mouth */}
          {pose === "cheer" ? (
            <g>
              {/* Open mouth = cheering */}
              <ellipse cx="100" cy="146" rx="14" ry="10" fill="#1a0b2e" />
              <ellipse cx="100" cy="150" rx="9" ry="5" fill="#ff4d8d" />
            </g>
          ) : pose === "think" ? (
            <line
              x1="92"
              y1="146"
              x2="108"
              y2="146"
              stroke="#1a0b2e"
              strokeWidth="4"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M 86 140 Q 100 158 114 140"
              stroke="#1a0b2e"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* Pose extras */}
          {pose === "build" && (
            <g>
              {/* Tiny circuit board the mascot is holding */}
              <rect
                x="78"
                y="148"
                width="44"
                height="24"
                rx="4"
                fill="url(#m-chip)"
              />
              <circle cx="86" cy="160" r="2" fill="#ffd60a" />
              <circle cx="94" cy="160" r="2" fill="#ffd60a" />
              <circle cx="102" cy="160" r="2" fill="#ffd60a" />
              <circle cx="110" cy="160" r="2" fill="#ffd60a" />
              <rect
                x="92"
                y="153"
                width="16"
                height="6"
                rx="1"
                fill="#1a0b2e"
                opacity="0.8"
              />
            </g>
          )}
          {pose === "wave" && (
            <g className="m-wave" style={{ transformOrigin: "150px 120px" }}>
              <circle cx="158" cy="100" r="10" fill="url(#m-body)" />
              <rect
                x="152"
                y="100"
                width="12"
                height="22"
                rx="6"
                fill="url(#m-body)"
              />
            </g>
          )}
          {pose === "cheer" && (
            <>
              {/* Arms up */}
              <g style={{ transformOrigin: "44px 110px" }}>
                <rect
                  x="30"
                  y="70"
                  width="14"
                  height="32"
                  rx="7"
                  fill="url(#m-body)"
                  transform="rotate(-15 37 86)"
                />
                <circle cx="32" cy="68" r="9" fill="url(#m-body)" />
              </g>
              <g style={{ transformOrigin: "156px 110px" }}>
                <rect
                  x="156"
                  y="70"
                  width="14"
                  height="32"
                  rx="7"
                  fill="url(#m-body)"
                  transform="rotate(15 163 86)"
                />
                <circle cx="168" cy="68" r="9" fill="url(#m-body)" />
              </g>
            </>
          )}

          {/* Sparkle accents around cheer */}
          {pose === "cheer" && (
            <g fill="#ffd60a" className="m-sparkles">
              <circle cx="30" cy="40" r="2.5" />
              <circle cx="170" cy="50" r="2" />
              <circle cx="20" cy="120" r="2" />
              <circle cx="180" cy="130" r="2.5" />
            </g>
          )}
        </g>
      </svg>

      <style>{`
        @keyframes m-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes m-blink { 0%,92%,100%{transform:scaleY(1)} 96%{transform:scaleY(0.1)} }
        @keyframes m-pulse { 0%,100%{transform-origin:100px 38px;transform:scale(1)} 50%{transform-origin:100px 38px;transform:scale(1.2)} }
        @keyframes m-halo  { 0%,100%{transform-origin:100px 36px;transform:scale(1);opacity:0.9} 50%{transform-origin:100px 36px;transform:scale(1.45);opacity:1} }
        @keyframes m-wave  { 0%,100%{transform:rotate(0)} 30%{transform:rotate(18deg)} 60%{transform:rotate(-12deg)} }
        @keyframes m-spark { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(0.5);opacity:0.4} }
        .m-idle   { animation: m-bob 3.4s ease-in-out infinite; transform-origin: center; }
        .m-eye    { transform-box: fill-box; transform-origin: center; animation: m-blink 5s ease-in-out infinite; }
        .m-led    { animation: m-pulse 1.8s ease-in-out infinite; }
        .m-halo   { animation: m-halo 1.8s ease-in-out infinite; }
        .m-wave   { transform-box: fill-box; animation: m-wave 2.4s ease-in-out infinite; }
        .m-sparkles { transform-box: fill-box; transform-origin: center; animation: m-spark 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .m-idle, .m-eye, .m-led, .m-halo, .m-wave, .m-sparkles { animation: none; }
        }
      `}</style>
    </div>
  );
}
