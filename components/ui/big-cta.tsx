import Link from "next/link";

/**
 * Duolingo-style giant CTA button. Bold uppercase weight, deep
 * stamped shadow, ~52px tall, spring-y press feedback.
 *
 * Renders as <Link> when href is provided, else <button>. Accepts an
 * optional icon (Material Symbols name) shown to the left.
 *
 * Variants map to the brand palette:
 *   - "saffron" (default, primary action)
 *   - "teal"    (secondary action)
 *   - "purple"  (alt action)
 *   - "ghost"   (text only, for low-priority secondaries)
 */
type Variant = "saffron" | "teal" | "purple" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  saffron:
    "bg-primary text-on-primary [box-shadow:0_6px_0_0_#7a2900,0_18px_36px_-12px_rgba(167,58,0,0.55)] hover:[box-shadow:0_4px_0_0_#7a2900,0_24px_44px_-14px_rgba(167,58,0,0.6)] active:[box-shadow:0_2px_0_0_#7a2900,0_8px_18px_-8px_rgba(167,58,0,0.5)]",
  teal:
    "bg-secondary text-on-secondary [box-shadow:0_6px_0_0_#004842,0_18px_36px_-12px_rgba(0,106,98,0.55)] hover:[box-shadow:0_4px_0_0_#004842,0_24px_44px_-14px_rgba(0,106,98,0.6)] active:[box-shadow:0_2px_0_0_#004842,0_8px_18px_-8px_rgba(0,106,98,0.5)]",
  purple:
    "bg-tertiary text-on-tertiary [box-shadow:0_6px_0_0_#5b1a91,0_18px_36px_-12px_rgba(132,43,210,0.55)] hover:[box-shadow:0_4px_0_0_#5b1a91,0_24px_44px_-14px_rgba(132,43,210,0.6)] active:[box-shadow:0_2px_0_0_#5b1a91,0_8px_18px_-8px_rgba(132,43,210,0.5)]",
  ghost:
    "bg-surface-container-lowest text-on-surface border-2 border-outline-variant [box-shadow:0_4px_0_0_var(--outline-variant)] hover:[box-shadow:0_3px_0_0_var(--outline-variant)] active:[box-shadow:0_2px_0_0_var(--outline-variant)]",
};

type CommonProps = {
  children: React.ReactNode;
  icon?: string;
  trailingIcon?: string;
  variant?: Variant;
  size?: "md" | "lg";
  className?: string;
};

function buildClassName({
  variant = "saffron",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: "md" | "lg";
  className?: string;
}) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-3xl font-bold uppercase tracking-wide",
    "transition-all duration-150 ease-out will-change-transform",
    "active:translate-y-[3px] hover:-translate-y-0.5",
    size === "lg"
      ? "px-7 py-4 text-base md:text-lg"
      : "px-5 py-3 text-sm md:text-base",
    VARIANT_CLASSES[variant],
    className,
  ].join(" ");
}

export function BigCta(
  props: CommonProps & ({ href: string } | { onClick?: () => void; type?: "submit" | "button" }),
) {
  const { children, icon, trailingIcon, variant = "saffron", size = "md", className = "" } = props;
  const classes = buildClassName({ variant, size, className });
  const inner = (
    <>
      {icon && (
        <span className="material-symbols-outlined text-[20px] md:text-[22px]">
          {icon}
        </span>
      )}
      {children}
      {trailingIcon && (
        <span className="material-symbols-outlined text-[18px] md:text-[20px]">
          {trailingIcon}
        </span>
      )}
    </>
  );

  if ("href" in props) {
    return (
      <Link href={props.href} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={"type" in props ? props.type ?? "button" : "button"}
      onClick={"onClick" in props ? props.onClick : undefined}
      className={classes}
    >
      {inner}
    </button>
  );
}
