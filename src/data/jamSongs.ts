/**
 * JamSong — the "cassette tape" save shape for the jam stage.
 *
 * A jam is config-only / replayable: we save every piece of state
 * needed to reconstruct the jam stage as it was, but we do NOT bake
 * the audio to a file. Reopening a saved jam re-instantiates the
 * audio engine (assignSlot / assignVocalSlot) from the snapshot so
 * the player can keep tweaking.
 *
 * Vocal AudioBuffer: stored in-memory only for this first pass.
 * On page reload, vocal jams keep their config but lose their vocal
 * track. A future commit will move the vocal to an IndexedDB +
 * base64-encoded WAV so cassettes are fully resilient.
 */

import type { CharacterKind } from "./characterSkins";

/** Snapshot of a single band slot at save time. Matches the runtime
 *  SlotState shape in JamView but as plain JSON-serializable data. */
export interface JamSlotSnapshot {
  /** The audio bus assigned: a soundId from REAL_SOUNDS, the
   *  "__vocal__" sentinel for the player slot, or null when empty. */
  soundId:         string | null;
  muted:           boolean;
  volume:          number;
  /** Vocal-only — whether the recording rate-stretches with master
   *  BPM (true) or stays at its recorded tempo (false). */
  syncToBpm:       boolean;
  /** Vocal-only — semitone offset on the pitch shifter. */
  autotunePitch?:  number;
  /** Vocal-only — autotune wet amount (0–1). */
  autotuneEffect?: number;
}

/** Position + character placement for a band slot. */
export interface JamPlacementSnapshot {
  characterKind: CharacterKind;
  soundId:       string;
  pos:           { x: number; y: number };
}

/** A saved jam — one "cassette". */
export interface JamSong {
  id:        string;
  /** Player-facing name. Empty string is allowed; UI substitutes a
   *  placeholder ("UNTITLED MIX"). */
  name:      string;
  createdAt: number;
  bpm:       number;
  /** Per-slotId placement snapshot. Keys = characterKind. */
  placements: Record<string, JamPlacementSnapshot>;
  /** Per-slotId slot-state snapshot. Includes the player slot
   *  (PLAYER_SLOT_ID) when there's a vocal. */
  slots:      Record<string, JamSlotSnapshot>;
  /** Whether the player at the mic was placed. */
  playerPlaced: boolean;
  /** Iso position of the player + mic stand, in % of the room. */
  playerPos:    { x: number; y: number };
  /** Per-(slotId,sectionId) mute booleans. Keys formatted
   *  "${slotId}:${sectionId}". */
  arrangeMutes: Record<string, boolean>;
  /** The recorded vocal buffer. Lives in-memory; lost on reload for
   *  the first pass (see file header). */
  vocalBuffer?: AudioBuffer;
}

/** Build a stable, sortable id for a new jam. */
export function newJamId(): string {
  return `jam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a human-friendly default name from the creation timestamp. */
export function defaultJamName(now = Date.now()): string {
  const d  = new Date(now);
  const mm = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${mm} ${dd} · ${hh}:${mi}`;
}
