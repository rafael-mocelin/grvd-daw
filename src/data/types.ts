export type LayerKind =
  | "drums"   // full drum loop (file-backed)
  | "kick"    // single kick hit (synth)
  | "snare"
  | "hat"
  | "808"
  | "sample"
  | "melody"
  | "vocal";

/** Human-readable label for each kind shown in the UI */
export const KIND_LABEL: Record<LayerKind, string> = {
  drums:  "drums",
  kick:   "kick",
  snare:  "snare",
  hat:    "hihat",
  "808":  "808",
  sample: "sample",
  melody: "melody",
  vocal:  "vocals",
};

export type Mood = "asleep" | "sleepy" | "chill" | "happy" | "hyped" | "sad" | "lonely";

export interface SoundOption {
  id: string;
  kind: LayerKind;
  /** Short playful name. "boom", "tss", "boooom" — not "Kick_01.wav". */
  name: string;
  /** Visual emoji or short glyph for the card. */
  glyph: string;
  /** Internal synth variant key, matches patternFor in engine.ts. */
  variant: string;
  /** Genre tags this sound reinforces. */
  tags: string[];
  /** Short human-readable vibe. */
  vibe: string;
  /**
   * If present, use this static audio file instead of synthesis.
   * Path is relative to the public/ dir, e.g. "/sounds/drums/drums_150.wav".
   */
  fileUrl?: string;
  /** Original BPM of the audio file, used to compute playbackRate at the template BPM. */
  nativeBpm?: number;
}

export interface Layer {
  id: string; // unique per song
  kind: LayerKind;
  variant: string;
  /** reference back to the SoundOption for UI. */
  soundId: string;
  muted?: boolean;
}

export interface Template {
  id: string;
  name: string;
  subtitle: string;
  bpm: number;
  bars: number;
  keyRoot: string; // e.g. "A"
  tags: string[];
  /** The ordered "recipe" the player walks through — which layer kinds to pick, in order. */
  recipe: LayerKind[];
  /** Optional lyric line for the hook (karaoke prompt). */
  hookLine: string;
  /** Full verse for the karaoke recorder — array of lyric lines. */
  verse?: string[];
  /** Suggested sound IDs per kind (the "curated combo" that's guaranteed to work). */
  suggested: Partial<Record<LayerKind, string[]>>;
}

export interface Song {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  keyRoot: string;
  templateId: string;
  layers: Layer[];
  tags: string[];
  collaborators: string[]; // player names
  createdAt: number;
  vocalBlobUrl?: string; // if they recorded a vocal
  pitchScore?: number; // 0..100 from the karaoke minigame
  /** Per-section mute state from the Arrange view, keyed by "kind:sectionId". */
  arrangeMutes?: Record<string, boolean>;
}

export interface ArtistCard {
  id: string;
  name: string;
  avatar: string; // emoji
  songId: string;
  status: string;
  tags: string[];
  createdAt: number;
}

export type Need = "social" | "creativity" | "energy";

export interface Tamagotchi {
  name: string;
  mood: Mood;
  needs: Record<Need, number>; // 0..100
  lastSeenAt: number; // epoch ms
  streakDays: number;
  songsFinished: number;
  songsAbandoned: number;
}
