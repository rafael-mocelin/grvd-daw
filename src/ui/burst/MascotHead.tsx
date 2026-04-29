/**
 * MascotHead — pocket-sized version of the BURST chibi for HUD/avatar use.
 *
 * Just the head (no body): skin-toned dome, two round black O eyes
 * with white specular dot, tiny round mouth, DJ headphones overlay
 * with coral cans. Designed to render inside a 36-44px circle.
 *
 * Used by the LevelBadge so the HUD anchor shows the actual character
 * instead of a generic headphones icon.
 */

import { C } from "./tokens";

interface MascotHeadProps {
  /** Diameter in px. Default 40 — fits inside a 52px disc. */
  size?: number;
}

export function MascotHead({ size = 40 }: MascotHeadProps) {
  // The head SVG uses a 24×24 viewBox so the same pieces scale cleanly.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block" }}
      aria-hidden
    >
      <defs>
        <radialGradient id="mascotSkin" cx="35%" cy="30%">
          <stop offset="0%"   stopColor="#d8a373" />
          <stop offset="60%"  stopColor="#c08a5a" />
          <stop offset="100%" stopColor="#8a5a36" />
        </radialGradient>
        <radialGradient id="mascotCan" cx="30%" cy="30%">
          <stop offset="0%"   stopColor="#ff7a8e" />
          <stop offset="100%" stopColor={C.coralDeep} />
        </radialGradient>
      </defs>

      {/* Head shape — round, slightly oversized so a Funko 1:1 head ratio
       *  reads inside the small viewBox. */}
      <ellipse
        cx="12" cy="13" rx="9.2" ry="9.6"
        fill="url(#mascotSkin)"
        stroke="#0a0f1c"
        strokeWidth="1"
      />

      {/* Soft hat-shadow under the headphone band */}
      <ellipse
        cx="12" cy="9" rx="6" ry="1.6"
        fill="rgba(0,0,0,0.18)"
      />

      {/* Eyes: round black O with a tiny white specular highlight */}
      <circle cx="9.4"  cy="13.2" r="1.7" fill="#0a0f1c" />
      <circle cx="14.6" cy="13.2" r="1.7" fill="#0a0f1c" />
      <circle cx="9.0"  cy="12.6" r="0.55" fill="#fff" />
      <circle cx="14.2" cy="12.6" r="0.55" fill="#fff" />

      {/* Mouth — tiny round open */}
      <circle
        cx="12" cy="16.6" r="1.0"
        fill="#3a1818"
        stroke="#0a0f1c"
        strokeWidth="0.5"
      />

      {/* Headphones — band arc + two cans */}
      <path
        d="M 4 10 A 8 7 0 0 1 20 10"
        stroke="#1a1a22"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      {/* Highlight on the band */}
      <path
        d="M 5 10 A 7 6 0 0 1 19 10"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Left can */}
      <rect x="2.4" y="10.5" width="3.6" height="5" rx="1.2" fill="#1a1a22" stroke="#0a0f1c" strokeWidth="0.5" />
      <rect x="3.0" y="11"   width="2.4" height="4" rx="0.8" fill="url(#mascotCan)" />
      {/* Right can */}
      <rect x="18"  y="10.5" width="3.6" height="5" rx="1.2" fill="#1a1a22" stroke="#0a0f1c" strokeWidth="0.5" />
      <rect x="18.6" y="11" width="2.4" height="4" rx="0.8" fill="url(#mascotCan)" />
    </svg>
  );
}
