/**
 * useCustomPresets — player-made sounds saved out of DEN training
 * stations (DRUMMA today; 808 / sample / vocal stations land later).
 *
 * Each preset is config-only and replayable: we save the underlying
 * pattern + BPM, and re-render to an AudioBuffer on demand via
 * drummaEngine.renderPatternToBuffer. AudioBuffers don't survive
 * JSON.stringify so we strip them before localStorage write — same
 * approach the cassette library uses for vocal buffers.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DrumPattern } from "../audio/drummaEngine";

export interface CustomDrumPreset {
  /** Stable id; doubles as the slot's soundId in the audio engine.
   *  Always prefixed "custom-drum-" so jamEngine can route it through
   *  the buffer cache instead of the catalog. */
  id:        string;
  /** Player-typed name shown in the cycler. */
  name:      string;
  createdAt: number;
  /** 16-step kick / snare / hat grid the player baked. */
  pattern:   DrumPattern;
  /** Tempo the pattern was authored at. Used when re-rendering so
   *  the rendered buffer loops one bar cleanly; jamEngine scales by
   *  masterBpm / bpm at playback time. */
  bpm:       number;
}

interface CustomPresetsState {
  drumPresets: CustomDrumPreset[];
  /** Add a new preset. Returns the saved CustomDrumPreset (with id +
   *  timestamp) so the caller can route into the cycler / audio. */
  saveDrumPreset: (input: Omit<CustomDrumPreset, "id" | "createdAt">) => CustomDrumPreset;
  /** Rename in place. */
  renameDrumPreset: (id: string, name: string) => void;
  /** Remove from the rack. */
  deleteDrumPreset: (id: string) => void;
  /** Find by id. */
  getDrumPreset: (id: string) => CustomDrumPreset | undefined;
}

function newDrumPresetId(): string {
  return `custom-drum-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const useCustomPresets = create<CustomPresetsState>()(
  persist(
    (set, get) => ({
      drumPresets: [],

      saveDrumPreset: (input) => {
        const preset: CustomDrumPreset = {
          id:        newDrumPresetId(),
          createdAt: Date.now(),
          name:      input.name.trim() || "MY DRUMS",
          pattern:   input.pattern,
          bpm:       input.bpm,
        };
        set((s) => ({ drumPresets: [preset, ...s.drumPresets] }));
        return preset;
      },

      renameDrumPreset: (id, name) => {
        set((s) => ({
          drumPresets: s.drumPresets.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p,
          ),
        }));
      },

      deleteDrumPreset: (id) => {
        set((s) => ({ drumPresets: s.drumPresets.filter((p) => p.id !== id) }));
      },

      getDrumPreset: (id) => get().drumPresets.find((p) => p.id === id),
    }),
    {
      name: "grvd:jam:custom-presets:v1",
    },
  ),
);
