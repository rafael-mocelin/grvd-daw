/**
 * Studio Run — draw pools for each stage.
 *
 * Each "card" is a real musical asset (vibe / drums / melody) plus
 * metadata used for the run's score formula. The pool here is small
 * enough that the v1 prototype fits on one screen of code; in
 * production these grow with player unlocks.
 *
 * Stage flow: VIBE → DRUMS → MELODY → POLISH → BOSS.
 *  - VIBE  cards set BPM + key (no audio of their own)
 *  - DRUMS / MELODY cards reference REAL_SOUNDS by id; the run engine
 *    plays them back at the run's BPM.
 *  - POLISH cards are visual-only effect tags in v1 (real Tone.js inserts
 *    are a Phase 2 build).
 */

export interface VibeCard {
  id:     string;
  name:   string;       // shown on the card
  flavor: string;       // 1-line vibe brief
  bpm:    number;
  key:    string;       // "Fm" / "Em" / etc.
  glyph:  string;
  accent: string;       // CSS color for card glow
}

export interface SoundCard {
  id:        string;
  name:      string;
  flavor:    string;
  glyph:     string;
  /** REAL_SOUNDS id — used by the runEngine to look up the file. */
  soundId:   string;
  /** What the card was authored at — used for compatibility scoring. */
  nativeBpm: number;
  /** Key, if applicable. Null for kind-agnostic content like raw drums. */
  key:       string | null;
}

export interface PolishCard {
  id:     string;
  name:   string;
  flavor: string;
  glyph:  string;
  accent: string;
}

/* -------------------------------------------------------------------------- */
/* Pools                                                                       */
/* -------------------------------------------------------------------------- */

export const VIBE_POOL: VibeCard[] = [
  {
    id: "v-after-hours",  name: "AFTER-HOURS",  flavor: "Fm 145 — train, eyes half shut, head nod.",
    bpm: 145, key: "Fm", glyph: "🌃", accent: "#a78bfa",
  },
  {
    id: "v-sunset-cruise", name: "SUNSET CRUISE", flavor: "Fm 144 — top down, golden hour, no notifications.",
    bpm: 144, key: "Fm", glyph: "🌅", accent: "#fb923c",
  },
  {
    id: "v-drill-season",  name: "DRILL SEASON",  flavor: "Bm 160 — hard, dark, no smiling allowed.",
    bpm: 160, key: "Bm", glyph: "🔥", accent: "#E94560",
  },
  {
    id: "v-cloud-room",    name: "CLOUD ROOM",    flavor: "Fm 100 — pillow palace, drift.",
    bpm: 100, key: "Fm", glyph: "☁️", accent: "#22d3ee",
  },
  {
    id: "v-vinyl-cellar",  name: "VINYL CELLAR",  flavor: "Em 90 — basement, dust, an old drum break.",
    bpm: 90, key: "Em", glyph: "🎙️", accent: "#facc15",
  },
];

export const DRUMS_POOL: SoundCard[] = [
  {
    id: "dc-vanessa",   name: "vanessa",   flavor: "punchy full loop · 150 bpm",
    glyph: "🥁", soundId: "r-drums-150",    nativeBpm: 150, key: null,
  },
  {
    id: "dc-magic",     name: "magic",     flavor: "crisp + snappy · 160 bpm",
    glyph: "✨", soundId: "r-drums-160",    nativeBpm: 160, key: null,
  },
  {
    id: "dc-told-u-so", name: "told u so", flavor: "hard + 808 baked in · 165 bpm Fm",
    glyph: "🔥", soundId: "r-drums-165-Fm", nativeBpm: 165, key: "Fm",
  },
];

export const HAT_POOL: SoundCard[] = [
  {
    id: "hc-organic", name: "organic", flavor: "natural eighths · 150 bpm",
    glyph: "🌿", soundId: "r-hat-150", nativeBpm: 150, key: null,
  },
  {
    id: "hc-monitor", name: "monitor", flavor: "sixteenths · 160 bpm",
    glyph: "📡", soundId: "r-hat-160", nativeBpm: 160, key: null,
  },
  {
    id: "hc-segway",  name: "segway",  flavor: "swing skip · 128 bpm",
    glyph: "🛴", soundId: "r-hat-128", nativeBpm: 128, key: null,
  },
];

export const MELODY_POOL: SoundCard[] = [
  {
    id: "mc-paradise", name: "paradise", flavor: "ethereal bells · 100 bpm Fm",
    glyph: "☁️", soundId: "r-bells-Fm",     nativeBpm: 100, key: "Fm",
  },
  {
    id: "mc-melodic",  name: "melodic",  flavor: "dreamy keys · 140 bpm Gm",
    glyph: "🎹", soundId: "r-melodic-Gm",   nativeBpm: 140, key: "Gm",
  },
  {
    id: "mc-without",  name: "without",  flavor: "dark keys · 85 bpm Bm",
    glyph: "🖤", soundId: "r-sample-Bm",    nativeBpm: 85,  key: "Bm",
  },
  {
    id: "mc-vinyl",    name: "vinyl cut", flavor: "vinyl chop · 90 bpm Em",
    glyph: "💿", soundId: "r-vinyl-Em",     nativeBpm: 90,  key: "Em",
  },
  {
    id: "mc-werk",     name: "werk",      flavor: "warm 808 melody · 144 bpm Fm",
    glyph: "💜", soundId: "r-808-144-Fm",  nativeBpm: 144, key: "Fm",
  },
  {
    id: "mc-hound",    name: "hound",     flavor: "moving 808 · 144 bpm Em",
    glyph: "🐺", soundId: "r-808-144-Em",  nativeBpm: 144, key: "Em",
  },
];

export const POLISH_POOL: PolishCard[] = [
  { id: "pc-autotune",    name: "AUTO-TUNE",      flavor: "snap pitch, chart sound.", glyph: "🎚", accent: "#22d3ee" },
  { id: "pc-vinyl",       name: "VINYL CRACKLE",  flavor: "warmth + a touch of dust.", glyph: "💿", accent: "#facc15" },
  { id: "pc-sidechain",   name: "SIDECHAIN PUMP", flavor: "bass ducks under the kick.", glyph: "💢", accent: "#fb923c" },
  { id: "pc-hall",        name: "HALL REVERB",    flavor: "huge ambient space.",       glyph: "🌫", accent: "#a78bfa" },
  { id: "pc-tape",        name: "TAPE SAT",       flavor: "glue and warmth.",          glyph: "📼", accent: "#E94560" },
  { id: "pc-chorus",      name: "80s CHORUS",     flavor: "thick width.",              glyph: "✨", accent: "#4ade80" },
];

/* -------------------------------------------------------------------------- */
/* Stage definitions — what runs through them                                  */
/* -------------------------------------------------------------------------- */

export type StageId = "vibe" | "drums" | "hat" | "melody" | "polish" | "boss";

export const STAGE_ORDER: StageId[] = ["vibe", "drums", "hat", "melody", "polish", "boss"];

export const STAGE_LABEL: Record<StageId, string> = {
  vibe:   "VIBE",
  drums:  "DRUMS",
  hat:    "HATS",
  melody: "MELODY",
  polish: "POLISH",
  boss:   "BOSS",
};

/* -------------------------------------------------------------------------- */
/* Draw helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Pick `count` distinct cards from a pool. If the pool has fewer cards
 * than requested, returns the whole pool.
 */
export function drawCards<T>(pool: T[], count: number): T[] {
  if (pool.length <= count) return [...pool];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
