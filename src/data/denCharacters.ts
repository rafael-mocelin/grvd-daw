/**
 * DEN — character roster.
 *
 * Each entry is a personality + a musical specialty + the "kind" of
 * mini-game it runs. Three starter characters are unlocked from the
 * jump (MOCHI / NEEMA / ROYAL — porting the existing chibi rig); a
 * fourth (MIXX) is unlocked but its mini-game is a stub in the
 * prototype. The remaining roster slots show as silhouettes.
 *
 * For the prototype only DRUMMA (alias of MOCHI's specialty) has a
 * real, playable mini-game; the rest say "coming soon" when entered.
 */

export type Specialty = "drums" | "melody" | "vocals" | "mix";
export type MiniGame  = "tap-pattern" | "pick-phrase" | "fill-blank" | "fix-mix";
export type Rarity    = "common" | "rare" | "epic" | "legendary";

export interface DenCharacter {
  id:           string;
  displayName:  string;
  specialty:    Specialty;
  miniGame:     MiniGame;
  /** Visual config — same primitives as feature/jam-stage's character rig.
   *  Used by the chibi renderer in this branch (we ported a tiny version
   *  of the rig — see src/components/den/Chibi.tsx). */
  jacket:       string;
  skin:         string;
  hairColor:    string;
  /** Hair style — round head w/ tufts (curls), oval w/ braids, square w/
   *  slick. v1 prototype only renders one variant inline (curls). */
  hair:         "curls" | "braids" | "slick" | "cap";
  expression:   "grin" | "smirk" | "cool";
  rarity:       Rarity;
  /** Backstory + a tagline shown on the lore card. */
  lore:         string;
  hypeLines:    string[];
  /** Whether this character is unlocked from the jump (true) or appears
   *  as a silhouette in the codex (false). */
  unlocked:     boolean;
}

export const DEN_ROSTER: DenCharacter[] = [
  {
    id:          "mochi",
    displayName: "MOCHI",
    specialty:   "drums",
    miniGame:    "tap-pattern",
    jacket:      "#E94560",      // coral
    skin:        "#c08a5a",
    hairColor:   "#1a1a22",
    hair:        "curls",
    expression:  "grin",
    rarity:      "common",
    lore:        "Drum kid. Bedroom basement, 5 AM. Counts time even when the lights are off.",
    hypeLines:   ["AYY", "let's go", "AGAIN", "yoooo", "drums up", "ON GOD"],
    unlocked:    true,
  },
  {
    id:          "neema",
    displayName: "NEEMA",
    specialty:   "melody",
    miniGame:    "pick-phrase",
    jacket:      "#22d3ee",      // cyan
    skin:        "#a07050",
    hairColor:   "#1a1a22",
    hair:        "braids",
    expression:  "smirk",
    rarity:      "common",
    lore:        "Melody whisperer. Hums in elevators. Every bus ride is a beat sketchpad.",
    hypeLines:   ["vibe.", "yes...", "thats it", "smooth", "right there", "easy"],
    unlocked:    true,
  },
  {
    id:          "royal",
    displayName: "ROYAL",
    specialty:   "vocals",
    miniGame:    "fill-blank",
    jacket:      "#D4A017",      // gold
    skin:        "#d4a988",
    hairColor:   "#0a0a14",
    hair:        "slick",
    expression:  "cool",
    rarity:      "common",
    lore:        "Lyric architect. Writes hooks on napkins, uses commas like a knife.",
    hypeLines:   ["respect.", "we move", "star.", "presence", "facts", "no skips"],
    unlocked:    true,
  },
  {
    id:          "mixx",
    displayName: "MIXX",
    specialty:   "mix",
    miniGame:    "fix-mix",
    jacket:      "#a78bfa",      // purple
    skin:        "#b08266",
    hairColor:   "#1a1a22",
    hair:        "cap",
    expression:  "cool",
    rarity:      "rare",
    lore:        "Engineer. Lives behind the console. Hears every sin in the low-mids.",
    hypeLines:   ["wait", "dial it back", "there it is", "clean.", "nice glue"],
    unlocked:    true,
  },
  // Locked / silhouette characters — show in the codex as undiscovered.
  {
    id:          "vybz",
    displayName: "VYBZ",
    specialty:   "melody",
    miniGame:    "pick-phrase",
    jacket:      "#fb923c",
    skin:        "#9c6a4a",
    hairColor:   "#0a0a14",
    hair:        "curls",
    expression:  "grin",
    rarity:      "rare",
    lore:        "Sample hunter. Crate-digger. Knows where the broken records live.",
    hypeLines:   ["that's a chop", "vault sound", "rare drop", "bin dive"],
    unlocked:    false,
  },
  {
    id:          "blu",
    displayName: "BLU",
    specialty:   "melody",
    miniGame:    "pick-phrase",
    jacket:      "#3b82f6",
    skin:        "#b89880",
    hairColor:   "#1a1a22",
    hair:        "braids",
    expression:  "smirk",
    rarity:      "epic",
    lore:        "F# specialist. Shows up when the song's already in the right key.",
    hypeLines:   ["sharp", "F# kid", "raised four", "out the box"],
    unlocked:    false,
  },
];

export function getCharacter(id: string): DenCharacter | undefined {
  return DEN_ROSTER.find((c) => c.id === id);
}
