/**
 * useJamStore — separate inventory for the jam-stage's saved "cassettes".
 *
 * Lives apart from the recipe-flow useStore so the two prototypes don't
 * contaminate each other. localStorage persists the config (placements,
 * BPM, mutes, autotune settings); the in-memory AudioBuffer for vocals
 * doesn't survive a reload yet — that's a future commit.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultJamName, newJamId, type JamSong } from "../data/jamSongs";

interface JamStoreState {
  songs: JamSong[];
  /** Add a fresh jam to the rack. Returns the saved JamSong (with
   *  generated id / createdAt) so the caller can route into the
   *  library / show toasts / etc. */
  saveJam: (input: Omit<JamSong, "id" | "createdAt" | "name"> & { name?: string }) => JamSong;
  /** Rename a saved jam in place. No-op when id isn't found. */
  renameJam: (id: string, name: string) => void;
  /** Remove a jam from the rack. */
  deleteJam: (id: string) => void;
  /** Find a jam by id. */
  getJam: (id: string) => JamSong | undefined;
}

export const useJamStore = create<JamStoreState>()(
  persist(
    (set, get) => ({
      songs: [],

      saveJam: (input) => {
        const song: JamSong = {
          id:        newJamId(),
          createdAt: Date.now(),
          name:      (input.name ?? "").trim() || defaultJamName(),
          bpm:          input.bpm,
          placements:   input.placements,
          slots:        input.slots,
          playerPlaced: input.playerPlaced,
          playerPos:    input.playerPos,
          arrangeMutes: input.arrangeMutes,
          vocalBuffer:  input.vocalBuffer,
        };
        set((s) => ({ songs: [song, ...s.songs] }));
        return song;
      },

      renameJam: (id, name) => {
        set((s) => ({
          songs: s.songs.map((j) =>
            j.id === id ? { ...j, name: name.trim() || j.name } : j,
          ),
        }));
      },

      deleteJam: (id) => {
        set((s) => ({ songs: s.songs.filter((j) => j.id !== id) }));
      },

      getJam: (id) => get().songs.find((j) => j.id === id),
    }),
    {
      name: "grvd:jam:cassettes:v1",
      // AudioBuffer can't go through JSON.stringify — strip it for
      // localStorage. The buffer stays alive in-memory for the
      // current session; future commit will move it to IndexedDB.
      partialize: (state) => ({
        songs: state.songs.map(({ vocalBuffer: _vocalBuffer, ...rest }) => rest),
      }) as unknown as JamStoreState,
    },
  ),
);
