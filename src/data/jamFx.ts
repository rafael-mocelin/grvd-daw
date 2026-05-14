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
  /** Player-facing branded name shown on the knob row. */
  name:       string;
  /** Short blurb under the name, hinting at the sound character. */
  blurb:      string;
  /** Which character kind this effect belongs to. */
  kind:       CharacterKind | "vocal";
  /** XP threshold to unlock. Below this the slider is hidden behind
   *  a 🔒 + 'NEED N XP' chip. */
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
  {
    id: "fresh-air",
    name:  "FRESH AIR",
    blurb: "top-end shimmer · hat sparkle",
    kind:  "drum-guy",
    xpRequired: 100,
    defaultWet: 0.35,
  },
  {
    id: "boom-room",
    name:  "BOOM ROOM",
    blurb: "tight trap-room reverb",
    kind:  "drum-guy",
    xpRequired: 250,
    defaultWet: 0.30,
  },

  // Tier 2 — couple more BAKEs.
  {
    id: "decapitator",
    name:  "DECAPITATOR",
    blurb: "saturation grit · 808 bite",
    kind:  "drum-guy",
    xpRequired: 500,
    defaultWet: 0.25,
  },
  {
    id: "head-kick",
    name:  "HEAD KICK",
    blurb: "transient punch · slap face",
    kind:  "drum-guy",
    xpRequired: 800,
    defaultWet: 0.45,
  },

  // Tier 3 — committed grind.
  {
    id: "wide-load",
    name:  "WIDE LOAD",
    blurb: "stereo widener · hats fan out",
    kind:  "drum-guy",
    xpRequired: 1200,
    defaultWet: 0.45,
  },
  {
    id: "ghost-rider",
    name:  "GHOST RIDER",
    blurb: "spectral ghost-note layer",
    kind:  "drum-guy",
    xpRequired: 1700,
    defaultWet: 0.30,
  },

  // Tier 4 — endgame for now.
  {
    id: "sub-crusher",
    name:  "SUB CRUSHER",
    blurb: "smashed parallel compression",
    kind:  "drum-guy",
    xpRequired: 2300,
    defaultWet: 0.40,
  },
  {
    id: "tape-warm",
    name:  "TAPE WARM",
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
