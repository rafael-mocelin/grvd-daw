/**
 * Jam Characters — the cast.
 *
 * Three distinct performers (not three hoodie-recolors of one chibi).
 * Each character is parameterized HTML/CSS, so adding a new performer
 * is an entry in this table + the corresponding render branches in
 * CharacterArt.
 *
 * Personality fields are forward-looking: hypeLines feed the speech-
 * bubble system, signatureKind is a hint we can use later to drive a
 * "this character specializes in X" visual cue when their slot holds
 * a sound of that kind.
 */

import type { LayerKind } from "./types";
import { C } from "../ui/burst/tokens";

export type HeadShape  = "round" | "oval" | "square";
export type HairStyle  = "curls" | "braids" | "slick" | "cap" | "buzz";
export type Expression = "grin"  | "smirk"  | "cool";
export type Personality = "hype" | "chill" | "icon";

export interface JamCharacter {
  id:           string;       // stable id for keys + future save state
  displayName:  string;       // shown in roster / popover header
  jacket:       string;       // hoodie color (CSS color string)
  skin:         string;       // base skin color
  hair:         HairStyle;
  hairColor:    string;       // hair fill color
  headShape:    HeadShape;
  expression:   Expression;
  personality:  Personality;
  /** Kind this character "specializes" in — drives a future visual hint
   *  when their assigned sound matches. Cosmetic-only; no gameplay
   *  restriction yet. */
  signatureKind?: LayerKind;
  /** Pool of one-liners used by the speech-bubble system. */
  hypeLines:    string[];
}

export const JAM_CHARACTERS: JamCharacter[] = [
  {
    id:          "mochi",
    displayName: "MOCHI",
    jacket:      C.coral,
    skin:        "#c08a5a",
    hair:        "curls",
    hairColor:   "#1a1a22",
    headShape:   "round",
    expression:  "grin",
    personality: "hype",
    signatureKind: "drums",
    hypeLines: [
      "AYY",
      "LET'S GO",
      "AGAIN",
      "YOOO",
      "DRUMS UP",
      "TURN IT UP",
      "ON GOD",
      "BIG ENERGY",
    ],
  },
  {
    id:          "neema",
    displayName: "NEEMA",
    jacket:      "#22d3ee",
    skin:        "#a07050",
    hair:        "braids",
    hairColor:   "#1a1a22",
    headShape:   "oval",
    expression:  "smirk",
    personality: "chill",
    signatureKind: "sample",
    hypeLines: [
      "vibe.",
      "yes...",
      "thats it",
      "smooth",
      "feel that?",
      "easy",
      "mhm",
      "right there",
    ],
  },
  {
    id:          "royal",
    displayName: "ROYAL",
    jacket:      C.gold,
    skin:        "#d4a988",
    hair:        "slick",
    hairColor:   "#0a0a14",
    headShape:   "square",
    expression:  "cool",
    personality: "icon",
    signatureKind: "808",
    hypeLines: [
      "respect.",
      "we move",
      "star.",
      "presence.",
      "bow.",
      "facts",
      "the wave",
      "no skips",
    ],
  },
];
