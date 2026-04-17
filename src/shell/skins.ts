/**
 * GRVD Shell — skin system.
 *
 * Each skin is a complete visual profile for the physical shell.
 * The screen area, buttons, LEDs, and accent stripes all derive from this.
 *
 * Shell dimensions are exported so other components (CanvasBoard portal,
 * etc.) can position themselves inside the screen area.
 */

/* -------------------------------------------------------------------------- */
/* Shell dimensions                                                             */
/* -------------------------------------------------------------------------- */

export const SHELL = {
  TOP: 62,      // height of top shell section (px)
  BOTTOM: 118,  // height of bottom shell section (px)
  LEFT: 46,     // width of left shell side (px)
  RIGHT: 46,    // width of right shell side (px)
  SCREEN_RADIUS: 6, // border-radius of the screen inset
} as const;

/* -------------------------------------------------------------------------- */
/* Skin definitions                                                             */
/* -------------------------------------------------------------------------- */

export type SkinId = "void" | "sakura" | "chrome" | "forest" | "gold";

export interface Skin {
  id: SkinId;
  name: string;
  /** CSS gradient for the shell body surface */
  shellGrad: string;
  /** Flat base color (used for buttons and solid areas) */
  shellBase: string;
  shellLight: string;    // highlight / raised face
  shellDark: string;     // shadow / recessed
  /** Button face color */
  btnFace: string;
  btnHighlight: string;
  /** LED / accent glow color */
  accent: string;
  /** Inner ring color around the screen */
  screenRing: string;
  /** Decorative stripe color for left/right side panels */
  stripe: string;
}

export const SKINS: Record<SkinId, Skin> = {
  void: {
    id: "void",
    name: "VOID",
    shellGrad:
      "linear-gradient(150deg, #26203a 0%, #1c1828 35%, #16121f 70%, #0f0c18 100%)",
    shellBase: "#1c1828",
    shellLight: "#2f2845",
    shellDark: "#0f0c18",
    btnFace: "#252033",
    btnHighlight: "#342d4f",
    accent: "#7c3aed",
    screenRing: "#07060d",
    stripe: "#7c3aed",
  },
  sakura: {
    id: "sakura",
    name: "SAKURA",
    shellGrad:
      "linear-gradient(150deg, #f9a8c9 0%, #e879a0 35%, #d4628c 70%, #b44874 100%)",
    shellBase: "#e879a0",
    shellLight: "#f9a8c9",
    shellDark: "#a33868",
    btnFace: "#d4628c",
    btnHighlight: "#f090b8",
    accent: "#ff6b9d",
    screenRing: "#1a0a10",
    stripe: "#ff6b9d",
  },
  chrome: {
    id: "chrome",
    name: "CHROME",
    shellGrad:
      "linear-gradient(150deg, #3d4d62 0%, #2c3a4e 35%, #1e2a3c 70%, #141e2c 100%)",
    shellBase: "#2c3a4e",
    shellLight: "#3d4d62",
    shellDark: "#141e2c",
    btnFace: "#2a3848",
    btnHighlight: "#3d4d62",
    accent: "#06b6d4",
    screenRing: "#08101a",
    stripe: "#06b6d4",
  },
  forest: {
    id: "forest",
    name: "FOREST",
    shellGrad:
      "linear-gradient(150deg, #2d4a2e 0%, #1e3320 35%, #172819 70%, #0f1c10 100%)",
    shellBase: "#1e3320",
    shellLight: "#2d4a2e",
    shellDark: "#0f1c10",
    btnFace: "#1c3020",
    btnHighlight: "#2d4a2e",
    accent: "#22c55e",
    screenRing: "#060e07",
    stripe: "#22c55e",
  },
  gold: {
    id: "gold",
    name: "GOLD",
    shellGrad:
      "linear-gradient(150deg, #c9973a 0%, #b07d28 35%, #8c6318 70%, #6a4c10 100%)",
    shellBase: "#b07d28",
    shellLight: "#c9973a",
    shellDark: "#6a4c10",
    btnFace: "#9a6e22",
    btnHighlight: "#c9973a",
    accent: "#fbbf24",
    screenRing: "#1a1008",
    stripe: "#fbbf24",
  },
};

export const SKIN_ORDER: SkinId[] = ["void", "sakura", "chrome", "forest", "gold"];

export function nextSkin(current: SkinId): SkinId {
  const idx = SKIN_ORDER.indexOf(current);
  return SKIN_ORDER[(idx + 1) % SKIN_ORDER.length];
}
