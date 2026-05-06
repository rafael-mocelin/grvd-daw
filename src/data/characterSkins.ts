/**
 * Character skin map — for the new sprite-based band slots.
 *
 * Each band character (drum-guy / beat-guy / guitar-guy) has 3 skins,
 * one per sound the character can play. Each skin is a pair of images
 * (left + right) that the BandSlot alternates between to animate the
 * character flipping side-to-side on the beat.
 *
 * Filename conventions in public/characters/<kind>/:
 *   <kind>-{left,right}-<soundLabel>.png
 *
 * Two filename quirks to be aware of:
 *  - beat-guy uses "houng" in the filename for the sound the in-app
 *    catalog names "hound" (id r-808-144-Em). The sound id is the
 *    source of truth — the typo only lives in the asset path.
 *  - guitar-guy uses "vinyl cut" with a literal space, which we
 *    URL-encode as %20 below.
 */

import type { LayerKind } from "./types";

export type CharacterKind = "drum-guy" | "beat-guy" | "guitar-guy";

interface Skin {
  left:  string;
  right: string;
}

/** soundId → skin pair, per character kind. */
export const CHARACTER_SKINS: Record<CharacterKind, Record<string, Skin>> = {
  "drum-guy": {
    "r-drums-150": {       // vanessa
      left:  "/characters/drum-guy/drum-guy-left-vanessa.png",
      right: "/characters/drum-guy/drum-guy-right-vanessa.png",
    },
    "r-drums-160": {       // magic
      left:  "/characters/drum-guy/drum-guy-left-magic.png",
      right: "/characters/drum-guy/drum-guy-right-magic.png",
    },
    "r-drums-165-Fm": {    // told u so
      left:  "/characters/drum-guy/drum-guy-left-tolduso.png",
      right: "/characters/drum-guy/drum-guy-right-tolduso.png",
    },
  },
  "beat-guy": {
    "r-808-150-Dsm": {     // jump
      left:  "/characters/beat-guy/beat-guy-left-jump.png",
      right: "/characters/beat-guy/beat-guy-right-jump.png",
    },
    // Filename quirk — houng vs hound. Sound id is the source of truth.
    "r-808-144-Em": {      // hound
      left:  "/characters/beat-guy/beat-guy-left-houng.png",
      right: "/characters/beat-guy/beat-guy-right-houng.png",
    },
    "r-808-144-Fm": {      // werk
      left:  "/characters/beat-guy/beat-guy-left-werk.png",
      right: "/characters/beat-guy/beat-guy-right-werk.png",
    },
  },
  "guitar-guy": {
    "r-melodic-Gm": {      // melodic
      left:  "/characters/guitar-guy/guitar-guy-left-melodic.png",
      right: "/characters/guitar-guy/guitar-guy-right-melodic.png",
    },
    "r-sample-Bm": {       // without
      left:  "/characters/guitar-guy/guitar-guy-left-without.png",
      right: "/characters/guitar-guy/guitar-guy-right-without.png",
    },
    // Filename has a space — URL-encoded as %20.
    "r-vinyl-Em": {        // vinyl cut
      left:  "/characters/guitar-guy/guitar-guy-left-vinyl%20cut.png",
      right: "/characters/guitar-guy/guitar-guy-right-vinyl%20cut.png",
    },
  },
};

/** Default skin shown when the slot is empty — first key in the
 *  character's skin map. Renders at reduced opacity so the player
 *  reads the slot as "ready, waiting for a sound." */
export function defaultSkinFor(kind: CharacterKind): Skin {
  const map = CHARACTER_SKINS[kind];
  const firstId = Object.keys(map)[0];
  return map[firstId];
}

/** Resolve the skin for a character + currently-assigned sound. Falls
 *  back to defaultSkinFor for unmatched soundIds (e.g., a sound from a
 *  kind the character doesn't accept — shouldn't happen if drop
 *  validation is correct, but defensive). */
export function resolveSkin(kind: CharacterKind, soundId: string | null): Skin {
  if (!soundId) return defaultSkinFor(kind);
  return CHARACTER_SKINS[kind][soundId] ?? defaultSkinFor(kind);
}

/** What LayerKind a given character accepts as drop targets. The
 *  BandSlot rejects any other kind on drop. */
export const ACCEPTED_KIND: Record<CharacterKind, LayerKind> = {
  "drum-guy":   "drums",
  "beat-guy":   "808",
  "guitar-guy": "sample",
};

/** Per-character display label, used in popovers / labels. */
export const CHARACTER_LABEL: Record<CharacterKind, string> = {
  "drum-guy":   "DRUMS",
  "beat-guy":   "808",
  "guitar-guy": "SAMPLE",
};

/** Hype-line pool, per character — the periodic speech-bubble lines
 *  JamView fires while audio plays. Replaces the per-chibi hype
 *  arrays in jamCharacters.ts (those characters are no longer used in
 *  the band rotation but the speech-bubble flavor is worth keeping). */
export const HYPE_POOL: Record<CharacterKind, string[]> = {
  "drum-guy": [
    "AYY",
    "let's go",
    "AGAIN",
    "drums up",
    "ON GOD",
    "lock in",
    "ride it",
  ],
  "beat-guy": [
    "WOOF",
    "low end",
    "shake it",
    "boom",
    "rumble",
    "bass walk",
    "go up",
  ],
  "guitar-guy": [
    "vibe.",
    "yes...",
    "smooth",
    "right there",
    "easy",
    "slick",
    "feel that?",
  ],
};
