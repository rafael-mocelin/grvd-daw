/**
 * Jam Combos — the cinematic-moment system.
 *
 * Each combo is a recipe of sounds that, when present together on stage,
 * triggers a payoff: every character pops on an accessory (shades, halo,
 * fire), an accent-colored banner drops from the top, a confetti burst
 * fires, and the stage briefly flashes in the combo's accent color.
 *
 * v1 ships three starter combos using sounds already in REAL_SOUNDS so
 * players can discover them on the existing palette without any new
 * audio. Adding a combo later = one entry in COMBOS + (optionally) a
 * new `Accessory` kind.
 *
 * Detection rules:
 *   - A combo "matches" iff every entry in `needs` is present in some
 *     slot. A `needs` entry can require a specific soundId, OR just a
 *     kind (loosens the recipe — useful for future combos).
 *   - Order doesn't matter. Slot identity doesn't matter.
 *   - Extra unrelated sounds DON'T break the combo. The player can
 *     stack drums on a fourth slot and still see SUNSET CRUISE.
 *   - Mute / volume don't affect detection — the combo is about which
 *     sounds are *assigned*, not about what you hear right now.
 */

import type { LayerKind } from "./types";

/**
 * Visual accessory the character wears while a combo is active. Each
 * value is a discriminator the CharacterAccessory component knows how
 * to render.
 */
export type Accessory =
  | "sunglasses"
  | "halo"
  | "fire"
  | "crown"
  | "chain";

/**
 * One ingredient the combo requires. soundId is optional — leaving it
 * undefined means "any sound of this kind" (handy for combos based on
 * vibe rather than specific picks).
 */
export interface ComboNeed {
  kind:    LayerKind;
  soundId?: string;
}

export interface JamCombo {
  id:       string;
  name:     string;       // banner headline (uppercase, dramatic)
  flavor:   string;       // one-liner under the name
  needs:    ComboNeed[];  // every entry must be present
  accent:   string;       // CSS color — drives banner glow + confetti
  accessory: Accessory;   // worn by every character while active
  /** XP awarded once per discovery — reserved for the player profile.
   *  Not yet wired into the store; harmless to read until then. */
  xpBonus: number;
}

/* -------------------------------------------------------------------------- */
/* Combos                                                                      */
/* -------------------------------------------------------------------------- */

export const COMBOS: JamCombo[] = [
  {
    id:       "sunset-cruise",
    name:     "SUNSET CRUISE",
    flavor:   "Top down, Fm 808, golden hour. You and the highway.",
    needs:    [
      { kind: "drums",  soundId: "r-drums-150" },   // vanessa
      { kind: "808",    soundId: "r-808-144-Fm" },  // werk
      { kind: "sample", soundId: "r-bells-Fm" },    // paradise
    ],
    accent:    "#fb923c",  // warm orange
    accessory: "sunglasses",
    xpBonus:   50,
  },
  {
    id:       "cloud-kingdom",
    name:     "CLOUD KINGDOM",
    flavor:   "Halos on. Soft hats, Fm bells, weightless 808.",
    needs:    [
      { kind: "hat",    soundId: "r-hat-128" },     // segway
      { kind: "808",    soundId: "r-808-144-Fm" },  // werk
      { kind: "sample", soundId: "r-bells-Fm" },    // paradise
    ],
    accent:    "#22d3ee",  // dreamy cyan
    accessory: "halo",
    xpBonus:   50,
  },
  {
    id:       "drill-season",
    name:     "DRILL SEASON",
    flavor:   "Hard 160s, dark keys, no smiling allowed.",
    needs:    [
      { kind: "drums",  soundId: "r-drums-160" },   // magic
      { kind: "hat",    soundId: "r-hat-160" },     // monitor
      { kind: "sample", soundId: "r-sample-Bm" },   // without
    ],
    accent:    "#E94560",  // coral
    accessory: "fire",
    xpBonus:   50,
  },
  {
    id:       "boom-bap-revival",
    name:     "BOOM-BAP REVIVAL",
    flavor:   "Crackle and warmth. The 90s called — they want their drums back.",
    needs:    [
      { kind: "drums",  soundId: "r-drums-150" },   // vanessa
      { kind: "hat",    soundId: "r-hat-150" },     // organic
      { kind: "sample", soundId: "r-vinyl-Em" },    // vinyl cut
    ],
    accent:    "#4ade80",  // green
    accessory: "chain",
    xpBonus:   60,
  },
  {
    id:       "hotline",
    name:     "HOTLINE",
    flavor:   "Late-night swing. Soft hats, bells, deep Em bass.",
    needs:    [
      { kind: "hat",    soundId: "r-hat-128" },     // segway
      { kind: "808",    soundId: "r-808-144-Em" },  // hound
      { kind: "sample", soundId: "r-bells-Fm" },    // paradise
    ],
    accent:    "#a78bfa",  // purple
    accessory: "crown",
    xpBonus:   70,
  },
  {
    id:       "dark-side",
    name:     "DARK SIDE",
    flavor:   "Trap on tilt. 808 melody under sixteenth hats and dark keys.",
    needs:    [
      { kind: "808",    soundId: "r-808-144-Em" },  // hound
      { kind: "hat",    soundId: "r-hat-160" },     // monitor
      { kind: "sample", soundId: "r-sample-Bm" },   // without
    ],
    accent:    "#fb923c",  // orange
    accessory: "fire",
    xpBonus:   60,
  },
];

/* -------------------------------------------------------------------------- */
/* Detection                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Lightweight slot-state shape the detector needs. JamView's full
 * SlotState has more fields (muted, volume) but the combo system
 * doesn't care.
 */
export interface SlotMatchState {
  soundId: string | null;
}

/**
 * Find the first combo whose `needs` all match against the given slot
 * states. Returns null when no combo is active. If multiple combos
 * match, returns the first defined in COMBOS — author order = priority.
 *
 * The check is intentionally loose: extra sounds don't break the combo,
 * and a sound assigned to multiple slots only counts once (Set semantics).
 */
export function detectCombo(slots: Record<string, SlotMatchState>): JamCombo | null {
  // Build a Set of assigned soundIds for fast membership tests, plus a
  // Set of assigned KINDs (resolved via a passed-in lookup) for combos
  // that match by kind only.
  const assignedIds = new Set<string>();
  for (const s of Object.values(slots)) {
    if (s.soundId) assignedIds.add(s.soundId);
  }

  outer: for (const combo of COMBOS) {
    for (const need of combo.needs) {
      if (need.soundId) {
        if (!assignedIds.has(need.soundId)) continue outer;
      }
      // kind-only matching is reserved for future combos — would need
      // a soundId→kind resolver passed in. Skip silently for now.
    }
    return combo;
  }
  return null;
}
