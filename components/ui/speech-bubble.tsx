/**
 * Mascot speech bubble — soft cloud-shaped container with a little tail
 * pointing toward the speaker. Used to make instructions / greetings /
 * encouragements feel like they come from the mascot.
 *
 * Direction:
 *   - "left"  — tail on the left side (mascot is to the LEFT)
 *   - "right" — tail on the right side (mascot is to the RIGHT)
 *   - "bottom" — tail underneath (mascot is BELOW)
 */
export function SpeechBubble({
  children,
  direction = "left",
  tone = "primary",
  className = "",
}: {
  children: React.ReactNode;
  direction?: "left" | "right" | "bottom";
  tone?: "primary" | "secondary" | "tertiary" | "neutral";
  className?: string;
}) {
  const TONE: Record<string, { bg: string; border: string; text: string }> = {
    primary: {
      bg: "bg-primary-fixed",
      border: "border-primary",
      text: "text-on-primary-fixed",
    },
    secondary: {
      bg: "bg-secondary-container",
      border: "border-secondary",
      text: "text-on-secondary-container",
    },
    tertiary: {
      bg: "bg-tertiary-fixed",
      border: "border-tertiary",
      text: "text-on-tertiary-fixed",
    },
    neutral: {
      bg: "bg-card",
      border: "border-outline-variant",
      text: "text-on-surface",
    },
  };
  const t = TONE[tone];

  return (
    <div
      className={`relative rounded-[28px] border-2 ${t.bg} ${t.border} ${t.text} px-5 py-4 ${className}`}
      style={{
        boxShadow:
          "0 6px 0 0 var(--outline-variant), 0 18px 36px -16px rgba(19,27,46,0.18)",
      }}
    >
      <div className="font-bold leading-snug">{children}</div>

      {/* Tail */}
      {direction === "left" && (
        <span
          aria-hidden="true"
          className={`absolute -left-3 top-6 h-5 w-5 rotate-45 border-l-2 border-b-2 ${t.bg} ${t.border}`}
        />
      )}
      {direction === "right" && (
        <span
          aria-hidden="true"
          className={`absolute -right-3 top-6 h-5 w-5 rotate-45 border-t-2 border-r-2 ${t.bg} ${t.border}`}
        />
      )}
      {direction === "bottom" && (
        <span
          aria-hidden="true"
          className={`absolute -bottom-3 left-8 h-5 w-5 rotate-45 border-r-2 border-b-2 ${t.bg} ${t.border}`}
        />
      )}
    </div>
  );
}
