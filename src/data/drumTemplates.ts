/**
 * drumTemplates — starter drum patterns the DRUMMA station ships
 * with. 9 templates across 3 genres (TRAP / RAP / POP). Each is a
 * 16-step 4/4 pattern across kick / snare / hat rows.
 *
 * Genre conventions (the patterns lean into these):
 *   - TRAP: slow tempo (130–155), kick on 1+9 (sometimes a +11
 *           ghost), snare on 5+13, dense 16th-note hats with
 *           occasional 32nd-note rolls.
 *   - RAP:  boom-bap mid tempo (88–96), kick on 1+8 or 1+11 swing,
 *           snare on 5+13, swung 8th hats.
 *   - POP:  4-on-the-floor (110–128), kick on every quarter (1/5/9/13),
 *           snare on backbeats (5/13), straight 8th hats.
 *
 * Naming is meant to feel like SoundToys / FabFilter presets —
 * short, fun, hint at the character (e.g. "Atlanta Bounce", "Boom
 * Bap Royal", "Sunset Pop").
 */

import type { DrumPattern } from "../audio/drummaEngine";

export type Genre = "trap" | "rap" | "pop";

export interface DrumTemplate {
  id:      string;
  genre:   Genre;
  name:    string;
  bpm:     number;
  pattern: DrumPattern;
}

/* -------------------------------------------------------------------------- */
/* Tiny helpers — write patterns by step indices rather than 16-long arrays.  */
/* -------------------------------------------------------------------------- */

function row(...steps: number[]): boolean[] {
  const out = new Array<boolean>(16).fill(false);
  for (const s of steps) if (s >= 0 && s < 16) out[s] = true;
  return out;
}
function rowEvery(stride: number, start = 0): boolean[] {
  const out = new Array<boolean>(16).fill(false);
  for (let i = start; i < 16; i += stride) out[i] = true;
  return out;
}

/* -------------------------------------------------------------------------- */
/* TRAP — slow, sparse kicks + heavy hats                                      */
/* -------------------------------------------------------------------------- */

const TRAP_HEAVY: DrumTemplate = {
  id:    "trap-heavy",
  genre: "trap",
  name:  "Slow & Heavy",
  bpm:   140,
  pattern: {
    kick:  row(0, 8, 11),
    snare: row(4, 12),
    hat:   rowEvery(2),                 // 8th notes
  },
};

const TRAP_ATL: DrumTemplate = {
  id:    "trap-atl",
  genre: "trap",
  name:  "Atlanta Bounce",
  bpm:   150,
  pattern: {
    kick:  row(0, 6, 10),
    snare: row(4, 12),
    hat:   rowEvery(1),                 // 16th notes
  },
};

const TRAP_DRILL: DrumTemplate = {
  id:    "trap-drill",
  genre: "trap",
  name:  "Drill 808",
  bpm:   144,
  pattern: {
    kick:  row(0, 3, 8, 11, 14),
    snare: row(4, 12),
    hat:   row(0, 2, 4, 6, 7, 8, 10, 12, 14, 15),  // sparse + a 32nd-note pinch
  },
};

/* -------------------------------------------------------------------------- */
/* RAP — boom-bap mid tempo                                                    */
/* -------------------------------------------------------------------------- */

const RAP_BOOM: DrumTemplate = {
  id:    "rap-boom",
  genre: "rap",
  name:  "Boom Bap Royal",
  bpm:   92,
  pattern: {
    kick:  row(0, 6, 10),
    snare: row(4, 12),
    hat:   rowEvery(2),
  },
};

const RAP_LAID: DrumTemplate = {
  id:    "rap-laid",
  genre: "rap",
  name:  "Laid Back",
  bpm:   88,
  pattern: {
    kick:  row(0, 8),
    snare: row(4, 12),
    hat:   rowEvery(2, 1),              // off-beat 8ths — gives the swing
  },
};

const RAP_POSSE: DrumTemplate = {
  id:    "rap-posse",
  genre: "rap",
  name:  "Posse Cut",
  bpm:   96,
  pattern: {
    kick:  row(0, 7, 10),
    snare: row(4, 12),
    hat:   row(0, 2, 4, 6, 8, 10, 12, 14),
  },
};

/* -------------------------------------------------------------------------- */
/* POP — 4-on-the-floor, danceable                                             */
/* -------------------------------------------------------------------------- */

const POP_FLOOR: DrumTemplate = {
  id:    "pop-floor",
  genre: "pop",
  name:  "Dance Floor",
  bpm:   124,
  pattern: {
    kick:  rowEvery(4),                 // 4-on-floor
    snare: row(4, 12),
    hat:   rowEvery(2, 1),              // off-beat hats
  },
};

const POP_SUNSET: DrumTemplate = {
  id:    "pop-sunset",
  genre: "pop",
  name:  "Sunset Pop",
  bpm:   118,
  pattern: {
    kick:  row(0, 4, 8, 12, 14),
    snare: row(4, 12),
    hat:   rowEvery(2),
  },
};

const POP_ANTHEM: DrumTemplate = {
  id:    "pop-anthem",
  genre: "pop",
  name:  "Stadium Anthem",
  bpm:   128,
  pattern: {
    kick:  row(0, 4, 8, 12),
    snare: row(4, 12),
    hat:   rowEvery(1),                 // 16th hats
  },
};

/* -------------------------------------------------------------------------- */
/* Export                                                                      */
/* -------------------------------------------------------------------------- */

export const DRUM_TEMPLATES: DrumTemplate[] = [
  TRAP_HEAVY, TRAP_ATL,   TRAP_DRILL,
  RAP_BOOM,   RAP_LAID,   RAP_POSSE,
  POP_FLOOR,  POP_SUNSET, POP_ANTHEM,
];

export function templatesByGenre(genre: Genre): DrumTemplate[] {
  return DRUM_TEMPLATES.filter((t) => t.genre === genre);
}

/** Helper for the station's BAKE flow: produce an empty 16-step
 *  pattern. Used when the player picks "Custom" (no template) and
 *  starts from scratch. */
export function emptyDrumPattern(): DrumPattern {
  return {
    kick:  new Array<boolean>(16).fill(false),
    snare: new Array<boolean>(16).fill(false),
    hat:   new Array<boolean>(16).fill(false),
  };
}
