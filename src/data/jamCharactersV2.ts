/**
 * jamCharactersV2 — character/sound roster for the jam-stage-v2 layout.
 *
 * In v2 the model collapsed: a character IS the sound. There's no
 * "drum-guy + 3 drum kits" anymore — each entry below is one performer
 * tied to one REAL_SOUNDS entry, with their own animation frame stack.
 *
 * Drag a character from the palette → land them on any free slot →
 * they show up and start looping their sound. Drop on an occupied
 * slot to swap. No kind restriction in v2 — any character can stand
 * in any slot, like Incredibox / Sprunki.
 *
 * Frame conventions:
 *   - "idle" frame is the still pose shown when the slot is paused /
 *     muted / first lands. If the asset set has no explicit idle file,
 *     we fall back to the first frame in the cycle.
 *   - "vibe1..N" / "left" / "right" are the cycling frames. We swap
 *     them at one frame per beat (via JAM_BPM in JamView).
 *
 * Asset path: /characters-jamstagev2/<filename>
 *
 * Filename quirks:
 *   - vanessa's idle file is "vanessa-Drum-idle.png" (capital D); the
 *     vibe files use lowercase "drum". URL paths are case-sensitive
 *     on the deploy host so we hardcode the exact case.
 *   - vinylcut has no idle frame — the cycle starts at vibe1.
 */

export interface JamCharV2 {
  /** Stable id; doubles as the dataTransfer payload during drag. */
  id:        string;
  /** REAL_SOUNDS id this character plays. Same string that the audio
   *  engine uses (assignSlot etc), so wiring is one assignment. */
  soundId:   string;
  /** Creative name shown in the palette + popover. Distinct from the
   *  underlying file's name so the player doesn't see filenames. */
  name:      string;
  /** What the character "is" — a one-line vibe blurb shown in the
   *  palette tile. Pure flavor. */
  blurb:     string;
  /** Ordered list of frame paths. Cycle index 0 → 1 → … → N–1 → 0.
   *  Index 0 doubles as the idle frame when the slot isn't animating. */
  frames:    string[];
}

const ROOT = "/characters-jamstagev2";

export const JAM_CHARS_V2: JamCharV2[] = [
  // ── Drums ─────────────────────────────────────────────────────────
  {
    id: "char-vanni",
    soundId: "r-drums-150",        // vanessa @ 150 bpm
    name:  "VANNI",
    blurb: "punchy 150 bpm",
    frames: [
      `${ROOT}/vanessa-Drum-idle.png`,   // capital D, hardcoded
      `${ROOT}/vanessa-drum-vibe1.png`,
      `${ROOT}/vanessa-drum-vibe2.png`,
      `${ROOT}/vanessa-drum-vibe3.png`,
    ],
  },
  {
    id: "char-zippy",
    soundId: "r-drums-160",        // magic @ 160 bpm
    name:  "ZIPPY",
    blurb: "snappy 160 trap kit",
    frames: [
      `${ROOT}/magic-drum-left.png`,     // no idle — left is the rest pose
      `${ROOT}/magic-drum-right.png`,
    ],
  },
  {
    id: "char-truth",
    soundId: "r-drums-165-Fm",     // told u so @ 165 bpm Fm
    name:  "TRUTH",
    blurb: "165 hard, 808 baked in",
    frames: [
      `${ROOT}/tolduso-drum-left.png`,
      `${ROOT}/tolduso-drum-right.png`,
    ],
  },

  // ── 808s ──────────────────────────────────────────────────────────
  {
    id: "char-bunz",
    soundId: "r-808-150-Dsm",      // jump @ 150 D#m
    name:  "BUNZ",
    blurb: "hop-bass · D#m",
    frames: [
      `${ROOT}/jump-808-idle.png`,
      `${ROOT}/jump-808-vibe1.png`,
      `${ROOT}/jump-808-vibe2.png`,
      `${ROOT}/jump-808-vibe3.png`,
    ],
  },
  {
    id: "char-woofy",
    soundId: "r-808-144-Em",       // hound @ 144 Em
    name:  "WOOFY",
    blurb: "low-end stalker · Em",
    frames: [
      `${ROOT}/hound-808-left.png`,
      `${ROOT}/hound-808-right.png`,
    ],
  },
  {
    id: "char-groovi",
    soundId: "r-808-144-Fm",       // werk @ 144 Fm
    name:  "GROOVI",
    blurb: "warm 808 walk · Fm",
    frames: [
      `${ROOT}/werk-808-left.png`,
      `${ROOT}/werk-808-right.png`,
    ],
  },

  // ── Samples ───────────────────────────────────────────────────────
  {
    id: "char-dreamy",
    soundId: "r-melodic-Gm",       // melodic @ 140 Gm
    name:  "DREAMY",
    blurb: "soft melodic keys · Gm",
    frames: [
      `${ROOT}/melodic-sample-idle.png`,
      `${ROOT}/melodic-sample-vibe1.png`,
      `${ROOT}/melodic-sample-vibe2.png`,
      `${ROOT}/melodic-sample-vibe3.png`,
    ],
  },
  {
    id: "char-ghost",
    soundId: "r-sample-Bm",        // without @ 85 Bm
    name:  "GHOST",
    blurb: "dark keys · 85 Bm",
    frames: [
      `${ROOT}/without-sample-left.png`,
      `${ROOT}/without-sample-right.png`,
    ],
  },
  {
    id: "char-wax",
    soundId: "r-vinyl-Em",         // vinyl cut @ 90 Em
    name:  "WAX",
    blurb: "vinyl chop · 90 Em",
    frames: [
      // No idle file — cycle is just the three vibes. The first one
      // doubles as the rest pose when the slot isn't animating.
      `${ROOT}/vinylcut-sample-vibe1.png`,
      `${ROOT}/vinylcut-sample-vibe2.png`,
      `${ROOT}/vinylcut-sample-vibe3.png`,
    ],
  },
];

/** Look up a character by id. Returns undefined for invalid ids. */
export function getCharV2(id: string): JamCharV2 | undefined {
  return JAM_CHARS_V2.find((c) => c.id === id);
}

/** Look up a character by the sound id they play. Used by JamView when
 *  a slot's state has a soundId and we need the character config. */
export function getCharV2BySoundId(soundId: string): JamCharV2 | undefined {
  return JAM_CHARS_V2.find((c) => c.soundId === soundId);
}
