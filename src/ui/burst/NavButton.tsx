/**
 * NavButton — BURST hero-design corner navigation button.
 *
 * Chunky chrome rounded square with a gradient fill, toon outline,
 * white inner highlight, multi-layer drop shadow, and a colored halo
 * glow tinted to match the surface. Press state shrinks the shadow,
 * translates the button down 3px, and scales 0.97 — the classic
 * "candy press" feel.
 *
 * Sits absolute in one of the four corners of the stage panel.
 */

import { useState, type ReactNode } from "react";
import { Gloss } from "./Gloss";

type Pos = "tl" | "tr" | "bl" | "br";

interface NavButtonProps {
  /** Preset corner position. Used when the layout fits the four-corner
   *  pattern. Pass `style` instead for custom positioning (e.g. stacked
   *  columns). */
  pos?:      Pos;
  /** Inline-style override for non-corner placements. Wins over `pos`. */
  style?:    React.CSSProperties;
  /** Top color of the gradient. */
  gradFrom:  string;
  /** Bottom color of the gradient. */
  gradTo:    string;
  /** Halo color (alpha-tinted glow around the button). */
  halo:      string;
  label:     string;
  icon:      ReactNode;
  onPress:   () => void;
}

const POS_STYLE: Record<Pos, React.CSSProperties> = {
  tl: { top: 12, left: 12 },
  tr: { top: 12, right: 12 },
  bl: { bottom: 12, left: 12 },
  br: { bottom: 12, right: 12 },
};

export function NavButton({ pos, style, gradFrom, gradTo, label, icon, halo, onPress }: NavButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onPress}
      aria-label={label}
      style={{
        position: "absolute",
        ...(pos ? POS_STYLE[pos] : {}),
        ...(style ?? {}),
        width: 76, height: 76,
        borderRadius: 18,
        border: "2.5px solid #0a0f1c",
        background: `linear-gradient(180deg, ${gradFrom} 0%, ${gradTo} 100%)`,
        boxShadow: pressed
          ? [
              "inset 0 2px 0 rgba(255,255,255,0.4)",
              "inset 0 -2px 0 rgba(0,0,0,0.4)",
              "0 1px 0 rgba(0,0,0,0.5)",
              `0 0 14px ${halo}`,
            ].join(", ")
          : [
              "inset 0 2px 0 rgba(255,255,255,0.5)",
              "inset 0 -3px 0 rgba(0,0,0,0.35)",
              "inset 0 0 0 2px rgba(255,255,255,0.18)",
              "0 5px 0 rgba(0,0,0,0.5)",
              "0 12px 22px rgba(0,0,0,0.5)",
              `0 0 22px ${halo}`,
            ].join(", "),
        transform: pressed ? "translateY(3px) scale(0.97)" : "translateY(0)",
        transition: "transform 0.08s, box-shadow 0.08s",
        cursor: "pointer",
        padding: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 4,
        zIndex: 7,
      }}
    >
      <Gloss radius={18} opacity={0.5} />
      <div style={{ position: "relative", zIndex: 1 }}>{icon}</div>
      <div
        style={{
          position: "relative", zIndex: 1,
          fontFamily: "'Lilita One', system-ui",
          fontSize: 11, letterSpacing: 0.7,
          color: "#fff",
          textShadow: "1.5px 1.5px 0 rgba(0,0,0,0.7)",
        }}
      >
        {label}
      </div>
    </button>
  );
}
