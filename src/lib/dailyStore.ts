/**
 * dailyStore — small Zustand store for Daily Drop UX state.
 *
 * Kept separate from the main useStore (which is a 1500-line multi-slice
 * monster) so the prototype touches as little of the existing app as
 * possible. If the concept ships, the slice would migrate into useStore
 * with the rest of the game state.
 *
 * Persistence: streak count + today's submission status live in
 * localStorage. The active session state (timer, picked sounds) is
 * in-memory — if you close the tab mid-session, you lose your run.
 *
 * (In a real implementation: server-side session token so a partial run
 * survives a network blip. Out of scope for the prototype.)
 */

import { create } from "zustand";
import { utcDateKey } from "../data/dailyPrompts";

/** Sub-screen the DailyView is currently showing. */
export type DailyPhase =
  | "prompt"   // briefing + START button
  | "cook"     // pick + play sounds, the live mini-mix
  | "submit";  // wrap + mock feed + streak

export interface DailyState {
  // Phase
  phase: DailyPhase;
  setPhase: (p: DailyPhase) => void;

  // Picked sound ids during cook stage
  picks: string[];
  togglePick: (id: string, max: number) => void;
  clearPicks: () => void;

  // Timer (seconds remaining, counts down)
  secondsLeft: number;
  startTimer: (totalSec: number) => void;
  tickTimer: () => void;
  stopTimer: () => void;
  // Internal — the latest setInterval id we own. Held in store so the
  // tick effect can clear it when leaving the phase.
  _intervalId: number | null;

  // Streak — persisted in localStorage; hydrated on app boot.
  streak: number;
  lastSubmitDate: string | null;
  hydrate: () => void;
  recordSubmission: () => void;

  /** Has today already been submitted? Drives prompt-screen empty state. */
  hasSubmittedToday: () => boolean;
}

const STORAGE_KEY = "grvd:daily:v1";

interface PersistedShape {
  streak:         number;
  lastSubmitDate: string | null;
}

function loadPersisted(): PersistedShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { streak: 0, lastSubmitDate: null };
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return { streak: 0, lastSubmitDate: null };
  }
}

function savePersisted(s: PersistedShape) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

/** Yesterday's date key, computed from a given date. Used to detect
 *  whether a streak should continue or reset. */
function yesterdayKey(today: Date): string {
  const d = new Date(today);
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateKey(d);
}

export const useDailyStore = create<DailyState>((set, get) => ({
  phase: "prompt",
  setPhase: (p) => set({ phase: p }),

  picks: [],
  togglePick: (id, max) => {
    const cur = get().picks;
    if (cur.includes(id)) {
      set({ picks: cur.filter((x) => x !== id) });
    } else if (cur.length < max) {
      set({ picks: [...cur, id] });
    }
    // else: at cap, ignore — UI shows it's full
  },
  clearPicks: () => set({ picks: [] }),

  secondsLeft: 0,
  _intervalId: null,
  startTimer: (totalSec) => {
    const prev = get()._intervalId;
    if (prev !== null) window.clearInterval(prev);
    set({ secondsLeft: totalSec });
    const id = window.setInterval(() => get().tickTimer(), 1000);
    set({ _intervalId: id });
  },
  tickTimer: () => {
    const cur = get().secondsLeft;
    if (cur <= 0) return;
    set({ secondsLeft: cur - 1 });
  },
  stopTimer: () => {
    const id = get()._intervalId;
    if (id !== null) window.clearInterval(id);
    set({ _intervalId: null });
  },

  streak:         0,
  lastSubmitDate: null,
  hydrate: () => {
    const p = loadPersisted();
    // Streak grace check — if the player's last submit was older than
    // yesterday, the streak has lapsed and resets to 0 on next submit.
    // (Same-day repeat submissions don't increment.)
    const today = new Date();
    const todayK = utcDateKey(today);
    const ydayK  = yesterdayKey(today);
    let effectiveStreak = p.streak;
    if (p.lastSubmitDate && p.lastSubmitDate !== todayK && p.lastSubmitDate !== ydayK) {
      effectiveStreak = 0;
    }
    set({ streak: effectiveStreak, lastSubmitDate: p.lastSubmitDate });
  },
  recordSubmission: () => {
    const today = new Date();
    const todayK = utcDateKey(today);
    const ydayK  = yesterdayKey(today);
    const last = get().lastSubmitDate;
    let nextStreak = get().streak;
    if (last === todayK) {
      // already submitted today — don't double-count
    } else if (last === ydayK) {
      nextStreak = get().streak + 1;
    } else {
      nextStreak = 1;  // first submit ever, or streak lapsed and restarts
    }
    set({ streak: nextStreak, lastSubmitDate: todayK });
    savePersisted({ streak: nextStreak, lastSubmitDate: todayK });
  },
  hasSubmittedToday: () => {
    const today = utcDateKey(new Date());
    return get().lastSubmitDate === today;
  },
}));
