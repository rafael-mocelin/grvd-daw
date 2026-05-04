/**
 * runStore — state for a single Studio Run.
 *
 * Holds: which stage we're on, the 3-card draw at the current stage,
 * the picked cards across stages, and the resulting score. Resets at
 * the end of each run.
 *
 * Persistence: career stats (best score, run count) live in
 * localStorage; the active run is in-memory. If the player kills the
 * tab mid-run, the run is lost.
 */

import { create } from "zustand";
import {
  STAGE_ORDER,
  type StageId,
  type VibeCard,
  type SoundCard,
  type PolishCard,
  drawCards,
  VIBE_POOL,
  DRUMS_POOL,
  HAT_POOL,
  MELODY_POOL,
  POLISH_POOL,
} from "../data/runDraws";

/** A pick at a given stage. The kind discriminates so consumers know
 *  which fields are valid. */
export type Pick =
  | { kind: "vibe";   card: VibeCard }
  | { kind: "drums";  card: SoundCard }
  | { kind: "hat";    card: SoundCard }
  | { kind: "melody"; card: SoundCard }
  | { kind: "polish"; card: PolishCard };

export interface RunState {
  /** Where the player is in the run. "boss" = end-of-run summary. */
  currentStage: StageId;

  /** The 3-card draw shown at the current stage. Refilled when the
   *  player advances. The cards' types depend on the stage. */
  draw: VibeCard[] | SoundCard[] | PolishCard[];

  /** Locked picks across stages, in order of selection. */
  picks: Pick[];

  /** Score for the current run (computed at boss). */
  score: number;

  /** Career stats from localStorage. */
  bestScore: number;
  runCount:  number;

  // Actions
  beginRun:    () => void;
  pick:        (cardId: string) => void;
  reroll:      () => void;
  endRun:      () => void;
  resetRun:    () => void;
  hydrate:     () => void;

  /** Read-only helpers. */
  getVibe:   () => VibeCard | null;
  getDrums:  () => SoundCard | null;
  getHat:    () => SoundCard | null;
  getMelody: () => SoundCard | null;
  getPolish: () => PolishCard[];
  /** Master BPM derived from the locked vibe (defaults to 120 pre-pick). */
  getMasterBpm: () => number;
}

const STORAGE_KEY = "grvd:run:career:v1";

interface PersistedShape {
  bestScore: number;
  runCount:  number;
}

function loadCareer(): PersistedShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { bestScore: 0, runCount: 0 };
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return { bestScore: 0, runCount: 0 };
  }
}

function saveCareer(p: PersistedShape) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

/** Draw the right pool for the given stage. */
function drawForStage(stage: StageId): VibeCard[] | SoundCard[] | PolishCard[] {
  switch (stage) {
    case "vibe":   return drawCards(VIBE_POOL,   3);
    case "drums":  return drawCards(DRUMS_POOL,  3);
    case "hat":    return drawCards(HAT_POOL,    3);
    case "melody": return drawCards(MELODY_POOL, 3);
    case "polish": return drawCards(POLISH_POOL, 3);
    case "boss":   return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Score formula                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Score a finished run. Components:
 *   - BPM coherence (drums vs vibe, melody vs vibe)
 *   - Key match     (melody vs vibe)
 *   - Polish bonus  (each polish card adds a small kicker)
 *   - Completion    (full 4-pick run gets a baseline)
 *
 * Range roughly 0–1000.
 */
export function scoreRun(picks: Pick[]): number {
  const vibe   = picks.find((p) => p.kind === "vibe")  ?.card as VibeCard | undefined;
  const drums  = picks.find((p) => p.kind === "drums") ?.card as SoundCard | undefined;
  const hat    = picks.find((p) => p.kind === "hat")   ?.card as SoundCard | undefined;
  const melody = picks.find((p) => p.kind === "melody")?.card as SoundCard | undefined;
  const polish = picks.filter((p) => p.kind === "polish");

  if (!vibe) return 0;

  // Baseline for completing all 4 mainline picks + at least 1 polish
  const completed = drums && hat && melody;
  let score = completed ? 400 : 200;

  // BPM coherence — closer ratios to 1.0 score higher (small stretch is fine).
  const bpmScore = (card?: SoundCard) => {
    if (!card) return 0;
    const ratio = vibe.bpm / card.nativeBpm;
    // Punish stretch ratios outside 0.66–1.5 (more than 1.5x stretch is rough).
    if (ratio < 0.66 || ratio > 1.5) return 30;
    // 1.0 = perfect; falls off linearly.
    const dist = Math.abs(1 - ratio);
    return Math.round(120 * (1 - Math.min(1, dist * 2)));
  };
  score += bpmScore(drums) + bpmScore(hat) + bpmScore(melody);

  // Key match — melody key vs vibe key.
  if (melody?.key && melody.key === vibe.key) {
    score += 120;
  } else if (melody?.key) {
    // partial credit for sharing a tonality (both major or both minor)
    const sameMode = (melody.key.endsWith("m") && vibe.key.endsWith("m")) ||
                     (!melody.key.endsWith("m") && !vibe.key.endsWith("m"));
    if (sameMode) score += 40;
  }

  // Polish kickers
  score += polish.length * 30;

  return Math.max(0, Math.min(1000, score));
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export const useRunStore = create<RunState>((set, get) => ({
  currentStage: "vibe",
  draw:         drawForStage("vibe"),
  picks:        [],
  score:        0,

  bestScore: 0,
  runCount:  0,

  beginRun: () => {
    set({
      currentStage: "vibe",
      draw:         drawForStage("vibe"),
      picks:        [],
      score:        0,
    });
  },

  pick: (cardId) => {
    const { currentStage, draw, picks } = get();
    const card = (draw as { id: string }[]).find((c) => c.id === cardId);
    if (!card) return;

    let newPick: Pick;
    if (currentStage === "vibe") {
      newPick = { kind: "vibe", card: card as VibeCard };
    } else if (currentStage === "polish") {
      newPick = { kind: "polish", card: card as PolishCard };
    } else if (currentStage === "drums" || currentStage === "hat" || currentStage === "melody") {
      newPick = { kind: currentStage, card: card as SoundCard };
    } else {
      return;
    }

    const nextPicks = [...picks, newPick];
    const idx = STAGE_ORDER.indexOf(currentStage);
    const nextStage = STAGE_ORDER[idx + 1] ?? "boss";
    const nextDraw = drawForStage(nextStage);

    set({
      picks: nextPicks,
      currentStage: nextStage,
      draw: nextDraw,
    });

    // If we've hit boss, compute the score immediately so the summary
    // screen has something to show.
    if (nextStage === "boss") {
      const score = scoreRun(nextPicks);
      set({ score });
    }
  },

  reroll: () => {
    const { currentStage } = get();
    set({ draw: drawForStage(currentStage) });
  },

  endRun: () => {
    const { score, bestScore, runCount } = get();
    const newBest = Math.max(bestScore, score);
    const newRunCount = runCount + 1;
    set({ bestScore: newBest, runCount: newRunCount });
    saveCareer({ bestScore: newBest, runCount: newRunCount });
  },

  resetRun: () => {
    set({
      currentStage: "vibe",
      draw:         drawForStage("vibe"),
      picks:        [],
      score:        0,
    });
  },

  hydrate: () => {
    const c = loadCareer();
    set({ bestScore: c.bestScore, runCount: c.runCount });
  },

  getVibe:   () => (get().picks.find((p) => p.kind === "vibe")  ?.card as VibeCard | undefined) ?? null,
  getDrums:  () => (get().picks.find((p) => p.kind === "drums") ?.card as SoundCard | undefined) ?? null,
  getHat:    () => (get().picks.find((p) => p.kind === "hat")   ?.card as SoundCard | undefined) ?? null,
  getMelody: () => (get().picks.find((p) => p.kind === "melody")?.card as SoundCard | undefined) ?? null,
  getPolish: () =>  get().picks.filter((p) => p.kind === "polish").map((p) => p.card as PolishCard),
  getMasterBpm: () => get().getVibe()?.bpm ?? 120,
}));
