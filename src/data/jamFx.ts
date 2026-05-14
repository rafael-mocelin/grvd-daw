/**
 * jamFx — per-character effect pool definitions for the DEN training
 * unlocks.
 *
 * Each effect = one knob the player can twist on a placed character.
 * Effects start LOCKED behind an XP gate (earned by completing
 * training sessions like DRUMMA's BAKE). Once unlocked, the effect
 * appears as a slider in that character's controls popover.
 *
 * Branding follows the boutique-plugin pattern (SoundToys /
 * FabFilter / Goodhertz): short, characterful names that hint at
 * what the effect does without being literal. Real plugin reference
 * the player asked for: Fresh Air → top-end excitement; Decapitator
 * → saturation/grit; Crystallizer → pitch-echo shimmer.
 *
 * Today only DRUM_FX is wired. 808 / SAMPLE / VOCAL pools are
 * defined as stubs so the data file scales for future stations
 * without a schema migration.
 */

import type { CharacterKind } from "./characterSkins";

export interface FxDef {
  /** Stable id used by the audio chain to route the amount knob to
   *  the right Tone node. */
  id:         string;
  /** Player-facing single-word brand name shown on the tile. */
  name:       string;
  /** Big icon glyph shown above the name on the tile (image-first
   *  layout — same vibe as the character tiles in the palette). */
  icon:       string;
  /** Short blurb shown under the slider when the tile expands.
   *  Hints at the sound character. */
  blurb:      string;
  /** Which character kind this effect belongs to. */
  kind:       CharacterKind | "vocal";
  /** XP threshold to unlock. Below this the tile shows the same
   *  lock chip style the JamArrange section locks use. */
  xpRequired: number;
  /** Initial wet/amount value (0..1) when the effect first unlocks
   *  so the player hears something on first appearance instead of
   *  having to twist a dead knob. */
  defaultWet: number;
}

/* -------------------------------------------------------------------------- */
/* DRUM_FX — 8 effects for drum-guy (the only station with audio wired today) */
/* -------------------------------------------------------------------------- */

export const DRUM_FX: FxDef[] = [
  // Tier 1 — first BAKE unlocks something.
  // Keep the engine id stable ("fresh-air") so audio routing doesn't
  // need to change; only the player-facing name + icon update.
  {
    id: "fresh-air",
    name:  "SHIMMER",
    icon:  "✨",
    blurb: "top-end sparkle on the hats",
    kind:  "drum-guy",
    xpRequired: 100,
    defaultWet: 0.35,
  },
  {
    id: "boom-room",
    name:  "CAVERN",
    icon:  "🕳",
    blurb: "tight trap-room reverb",
    kind:  "drum-guy",
    xpRequired: 250,
    defaultWet: 0.30,
  },

  // Tier 2 — couple more BAKEs.
  {
    id: "decapitator",
    name:  "GRIT",
    icon:  "🪓",
    blurb: "saturation drive · 808 bite",
    kind:  "drum-guy",
    xpRequired: 500,
    defaultWet: 0.25,
  },
  {
    id: "head-kick",
    name:  "THUMP",
    icon:  "👊",
    blurb: "transient punch · slap face",
    kind:  "drum-guy",
    xpRequired: 800,
    defaultWet: 0.45,
  },

  // Tier 3 — committed grind.
  {
    id: "wide-load",
    name:  "SPREAD",
    icon:  "↔️",
    blurb: "stereo wide · hats fan out",
    kind:  "drum-guy",
    xpRequired: 1200,
    defaultWet: 0.45,
  },
  {
    id: "ghost-rider",
    name:  "PHANTOM",
    icon:  "👻",
    blurb: "spectral ghost-note layer",
    kind:  "drum-guy",
    xpRequired: 1700,
    defaultWet: 0.30,
  },

  // Tier 4 — endgame for now.
  {
    id: "sub-crusher",
    name:  "CRUSH",
    icon:  "💥",
    blurb: "smashed parallel compression",
    kind:  "drum-guy",
    xpRequired: 2300,
    defaultWet: 0.40,
  },
  {
    id: "tape-warm",
    name:  "TAPE",
    icon:  "📼",
    blurb: "vintage tape glue · lo-fi",
    kind:  "drum-guy",
    xpRequired: 3000,
    defaultWet: 0.35,
  },
];

/* -------------------------------------------------------------------------- */
/* Stub pools for future stations — not wired audio-wise yet.                  */
/* -------------------------------------------------------------------------- */

export const EIGHT08_FX: FxDef[] = [];
export const SAMPLE_FX:  FxDef[] = [];
export const VOCAL_FX:   FxDef[] = [];

/** Look up the FX pool for a given character kind. */
export function fxPoolFor(kind: CharacterKind | "vocal"): FxDef[] {
  switch (kind) {
    case "drum-guy":   return DRUM_FX;
    case "beat-guy":   return EIGHT08_FX;
    case "guitar-guy": return SAMPLE_FX;
    case "vocal":      return VOCAL_FX;
  }
}
