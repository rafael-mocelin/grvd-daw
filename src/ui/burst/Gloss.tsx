/**
 * Gloss — glossy top-highlight overlay used by chunky chrome surfaces.
 * Sits as a thin pseudo-layer at the top of any element (button, capsule)
 * to give the BURST plastic-toy depth.
 */

interface GlossProps {
  /** Border-radius of the parent surface — keeps the gloss flush with corners. */
  radius?:  number;
  /** Top-edge opacity. Default 0.35; 0.5+ for primary CTAs. */
  opacity?: number;
}

export function Gloss({ radius = 14, opacity = 0.35 }: GlossProps) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: "2px 2px auto 2px",
        height: "38%",
        borderRadius: `${radius}px ${radius}px 40% 40% / ${radius}px ${radius}px 22% 22%`,
        background: `linear-gradient(180deg, rgba(255,255,255,${opacity}) 0%, rgba(255,255,255,0) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}
