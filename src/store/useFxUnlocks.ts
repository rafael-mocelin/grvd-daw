/**
 * useFxUnlocks — persistent wet/amount values for character effects.
 *
 * Effects unlock by XP threshold (see jamFx.ts). Once unlocked, the
 * player twists a slider in the controls popover; the wet value
 * (0..1) is persisted here so it survives across sessions and
 * applies to every band slot of that character kind.
 *
 * State shape is flat — keys formatted "${kind}:${fxId}", values
 * 0..1. Reads default to the FxDef.defaultWet on first access (so
 * a freshly-unlocked effect already sounds like something).
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FxUnlocksState {
  /** Persisted wet values, keyed "${kind}:${fxId}". */
  wets: Record<string, number>;
  /** Update one wet value. */
  setWet: (kind: string, fxId: string, value: number) => void;
}

export const useFxUnlocks = create<FxUnlocksState>()(
  persist(
    (set) => ({
      wets: {},
      setWet: (kind, fxId, value) =>
        set((s) => ({
          wets: {
            ...s.wets,
            [`${kind}:${fxId}`]: Math.max(0, Math.min(1, value)),
          },
        })),
    }),
    { name: "grvd:jam:fx-unlocks:v1" },
  ),
);

/** Helper read with explicit fallback — keeps the audio chain init
 *  paths from peppering nullish checks at the call site. */
export function readFxWet(
  state: FxUnlocksState,
  kind: string,
  fxId: string,
  fallback: number,
): number {
  const v = state.wets[`${kind}:${fxId}`];
  return typeof v === "number" ? v : fallback;
}
