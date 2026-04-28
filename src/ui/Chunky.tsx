/**
 * Chunky.tsx — UI v1 primitives.
 *
 * Two interactive shapes used everywhere going forward:
 *   <ChunkyButton>  — the fat hero CTA: gradient fill, multi-layer drop
 *                     shadow, glossy top highlight, press-bounce on tap.
 *   <ChunkyPill>    — smaller secondary action: same depth language, less
 *                     mass, used for inline actions / chips that ARE
 *                     interactive (skip, back, claim-coming-soon, etc.).
 *
 * Both share the "chunky candy" depth recipe defined in tailwind.config.js
 * (boxShadow.chunky → chunky-press swap during :active).
 *
 * Variants map to the GRVD palette gradient tokens. Add new ones in
 * tailwind.config.js's backgroundImage and they auto-flow here.
 */

import { type ButtonHTMLAttributes, forwardRef } from "react";

type ChunkyVariant =
  | "hero"     // primary action — purple → magenta gradient (most common)
  | "claim"    // success / claim — lime → cyan gradient
  | "ghost"    // dim translucent — subtle secondary
  | "purple"   // solid purple
  | "magenta"  // solid magenta
  | "cyan"     // solid cyan
  | "gold";    // solid gold (level / xp / currency)

type ChunkySize = "sm" | "md" | "lg";

interface ChunkyButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ChunkyVariant;
  size?:    ChunkySize;
  /** Optional emoji/icon prepended to the label. Inline + bigger than label. */
  icon?:    string;
}

const VARIANT_BG: Record<ChunkyVariant, string> = {
  hero:    "bg-btn-hero",
  claim:   "bg-btn-claim",
  ghost:   "bg-btn-ghost border border-grvd-line",
  purple:  "bg-grvd-purple",
  magenta: "bg-grvd-magenta",
  cyan:    "bg-grvd-cyan",
  gold:    "bg-grvd-gold",
};

const VARIANT_TEXT: Record<ChunkyVariant, string> = {
  hero:    "text-white",
  claim:   "text-grvd-base",
  ghost:   "text-white/85",
  purple:  "text-white",
  magenta: "text-white",
  cyan:    "text-grvd-base",
  gold:    "text-grvd-base",
};

const SIZE_BUTTON: Record<ChunkySize, string> = {
  sm: "px-4 py-2  text-sm  rounded-2xl",
  md: "px-6 py-3  text-base rounded-2xl",
  lg: "px-8 py-4  text-lg  rounded-3xl",
};

const SIZE_PILL: Record<ChunkySize, string> = {
  sm: "px-3 py-1   text-xs  rounded-full",
  md: "px-4 py-1.5 text-sm  rounded-full",
  lg: "px-5 py-2   text-base rounded-full",
};

const BASE_INTERACTIVE =
  "inline-flex items-center justify-center gap-2 " +
  "font-display tracking-wide " +
  "shadow-chunky active:shadow-chunky-press " +
  "active:translate-y-[2px] active:scale-[0.98] " +
  "transition-all duration-150 " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 " +
  "select-none cursor-pointer " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grvd-purple/60 focus-visible:ring-offset-2 focus-visible:ring-offset-grvd-base";

/**
 * The big chunky candy button. Use for primary actions on every screen.
 * Defaults: variant="hero", size="md".
 */
export const ChunkyButton = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  function ChunkyButton(
    { variant = "hero", size = "md", icon, className = "", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={[
          BASE_INTERACTIVE,
          VARIANT_BG[variant],
          VARIANT_TEXT[variant],
          SIZE_BUTTON[size],
          className,
        ].join(" ")}
        {...rest}
      >
        {icon && <span className="text-[1.2em] leading-none">{icon}</span>}
        <span className="leading-none whitespace-nowrap">{children}</span>
      </button>
    );
  },
);

/**
 * Smaller pill-shaped variant. Use for inline secondary actions: back,
 * skip, "load more", chip-shaped CTAs. Same depth, less mass.
 * Defaults: variant="ghost", size="sm".
 */
export const ChunkyPill = forwardRef<HTMLButtonElement, ChunkyButtonProps>(
  function ChunkyPill(
    { variant = "ghost", size = "sm", icon, className = "", children, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={[
          BASE_INTERACTIVE,
          VARIANT_BG[variant],
          VARIANT_TEXT[variant],
          SIZE_PILL[size],
          className,
        ].join(" ")}
        {...rest}
      >
        {icon && <span className="text-[1.1em] leading-none">{icon}</span>}
        <span className="leading-none whitespace-nowrap">{children}</span>
      </button>
    );
  },
);

/**
 * Static badge — visual-only, not interactive. For "OWNED" / "EARLY EAR" /
 * "GROUP" type chips. Same depth language as ChunkyPill but without the
 * press-bounce + cursor.
 */
export function ChunkyBadge({
  variant = "ghost",
  size = "sm",
  icon,
  className = "",
  children,
}: {
  variant?: ChunkyVariant;
  size?:    ChunkySize;
  icon?:    string;
  className?: string;
  children:  React.ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-1.5",
        "font-display tracking-wide leading-none",
        "shadow-chunky-press select-none",
        VARIANT_BG[variant],
        VARIANT_TEXT[variant],
        SIZE_PILL[size],
        className,
      ].join(" ")}
    >
      {icon && <span className="text-[1.05em]">{icon}</span>}
      <span>{children}</span>
    </span>
  );
}
