/**
 * BURST design tokens — ported from the Claude Design handoff.
 *
 * Single source of truth for the navy + coral + gold palette plus the
 * "chunky chrome" surface helper. Used by every BURST UI piece (HUD,
 * NavButton, CookCTA, mascot, etc.) so the look stays consistent.
 */

export const C = {
  navy:      "#1a2540",
  navyDeep:  "#0f1828",
  navyLight: "#243358",
  coral:     "#E94560",
  coralDeep: "#b8253a",
  gold:      "#D4A017",
  goldLight: "#f3c44a",
  cream:     "#F8F8FF",
  ash:       "#4A4A4A",
  pink:      "#ff4d9c",
  green:     "#4ade80",
  greenLcd:  "#5cffae",
} as const;

/**
 * Apply the BURST chunky-chrome surface treatment to a CSS style object:
 * 2px white inner border, multi-layer drop shadow, optional outer halo.
 *
 * Returns a CSSProperties-compatible object — spread it onto your element.
 */
export function chrome(
  fill:    string,
  outline: string = "#0a0f1c",
  halo:    string | null = null,
): React.CSSProperties {
  return {
    background: fill,
    border:     `2px solid ${outline}`,
    boxShadow: [
      "inset 0 2px 0 rgba(255,255,255,0.55)",
      "inset 0 -3px 0 rgba(0,0,0,0.35)",
      "inset 0 0 0 2px rgba(255,255,255,0.18)",
      "0 4px 0 rgba(0,0,0,0.5)",
      "0 12px 32px rgba(0,0,0,0.55)",
      halo ? `0 0 28px ${halo}` : "",
    ].filter(Boolean).join(", "),
  };
}

/**
 * BURST display readout style — Lilita-One numerals on a dark surface,
 * with a hard drop shadow for readability against gradient fills.
 */
export function readout(): React.CSSProperties {
  return {
    fontFamily:    "'Lilita One', system-ui",
    fontSize:      18,
    color:         "#fff",
    letterSpacing: 0.5,
    textShadow:    "0 2px 0 rgba(0,0,0,0.55)",
    lineHeight:    1,
  };
}

/* ---- color helpers — used by Mascot.tsx for skin tone variations ---- */

export function lighten(hex: string, amt: number): string {
  const c = parseHex(hex);
  return `rgb(${Math.min(255, c[0] + 255 * amt) | 0}, ${Math.min(255, c[1] + 255 * amt) | 0}, ${Math.min(255, c[2] + 255 * amt) | 0})`;
}

export function darken(hex: string, amt: number): string {
  const c = parseHex(hex);
  return `rgb(${Math.max(0, c[0] - 255 * amt) | 0}, ${Math.max(0, c[1] - 255 * amt) | 0}, ${Math.max(0, c[2] - 255 * amt) | 0})`;
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace("#", "");
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}
