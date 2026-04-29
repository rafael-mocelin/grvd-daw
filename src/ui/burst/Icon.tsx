/**
 * BURST icon set — chunky SVG icons ported from the Claude Design handoff.
 *
 * All icons share:
 *   - 24×24 viewBox
 *   - Toon-style black outlines (1.4–1.6 stroke)
 *   - Solid fills, no gradients (the chrome treatment is on the host
 *     button, not the icon)
 *
 * Pass `size` (px) to scale; default 22-24 depending on icon. `color`
 * overrides the fill on icons that have a default fill (mostly white
 * for use on coral/purple/cyan button backgrounds).
 */

interface IconProps {
  size?:  number;
  color?: string;
}

export const Icon = {
  Headphones: ({ size = 22, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M4 14V12a8 8 0 0 1 16 0v2" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="2.5"  y="13" width="5" height="8" rx="1.5" fill={color} stroke="#000" strokeWidth="1.5" />
      <rect x="16.5" y="13" width="5" height="8" rx="1.5" fill={color} stroke="#000" strokeWidth="1.5" />
    </svg>
  ),

  Coin: ({ size = 20 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#f3c44a" stroke="#7a5a08" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7"  fill="none"    stroke="#7a5a08" strokeWidth="1.4" />
      <text x="12" y="16" textAnchor="middle" fontFamily="'Lilita One'" fontSize="10" fill="#7a5a08">$</text>
    </svg>
  ),

  Gem: ({ size = 18 }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M5 9 L12 3 L19 9 L12 21 Z" fill="#b673ff" stroke="#3a1466" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 9 L19 9"                                     stroke="#3a1466" strokeWidth="1.2" />
      <path d="M9 9 L12 21 L15 9"          fill="none"        stroke="#3a1466" strokeWidth="1.2" />
      <path d="M7 5.5 L9 8"                                    stroke="#fff"    strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    </svg>
  ),

  Bolt: ({ size = 18, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M13 2 L4 14 L11 14 L9 22 L20 9 L13 9 Z" fill={color} stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),

  Handshake: ({ size = 24, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 12 L8 8 L12 11 L16 8 L21 12 L17 17 L12 14 L8 17 Z"
        fill={color}
        stroke="#000"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 12 L13 14" stroke="#000" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),

  Sliders: ({ size = 24, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="4"    y="4" width="3" height="16" rx="1" fill={color} stroke="#000" strokeWidth="1.4" />
      <rect x="10.5" y="4" width="3" height="16" rx="1" fill={color} stroke="#000" strokeWidth="1.4" />
      <rect x="17"   y="4" width="3" height="16" rx="1" fill={color} stroke="#000" strokeWidth="1.4" />
      <circle cx="5.5"  cy="9"  r="2.4" fill="#000" />
      <circle cx="12"   cy="15" r="2.4" fill="#000" />
      <circle cx="18.5" cy="11" r="2.4" fill="#000" />
    </svg>
  ),

  Trophy: ({ size = 24, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M7 4 H17 V10 a5 5 0 0 1 -10 0 Z"                fill={color}       stroke="#000" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 5 H4 V8 a3 3 0 0 0 3 3"                       fill="none"        stroke="#000" strokeWidth="1.6" />
      <path d="M17 5 H20 V8 a3 3 0 0 1 -3 3"                    fill="none"        stroke="#000" strokeWidth="1.6" />
      <rect x="9" y="14" width="6"  height="2.5"               fill={color}       stroke="#000" strokeWidth="1.4" />
      <rect x="7" y="17" width="10" height="3"   rx="0.6"      fill={color}       stroke="#000" strokeWidth="1.6" />
    </svg>
  ),

  Pad: ({ size = 22, color = "#fff" }: IconProps) => (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2.5" fill={color} stroke="#000" strokeWidth="1.6" />
      {[0, 1, 2].flatMap((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={5 + c * 5}
            y={5 + r * 5}
            width="3.6"
            height="3.6"
            rx="0.6"
            fill="#000"
            opacity="0.85"
          />
        )),
      )}
    </svg>
  ),
};
