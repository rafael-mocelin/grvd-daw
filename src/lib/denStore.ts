/**
 * denStore — state for the DEN flow.
 *
 * Tracks: which station the player is in (null = lobby), which character
 * mini-games have been completed during the current session, the
 * persistent library of saved tracks, and per-character friendship.
 *
 * Persistence: friendship + library live in localStorage. Active session
 * (current station, draft track) is in-memory.
 */

import { create } from "zustand";
import type { DrumPattern } from "../audio/denEngine";

export type StationId = "mochi" | "neema" | "royal" | "mixx" | null;

/** A finished song in the library. Composed of stems that came out of
 *  mini-games over the course of a den session. */
export interface DenTrack {
  id:        string;
  name:      string;
  /** ms timestamp — used for sorting and the auto-name fallback. */
  createdAt: number;
  /** Cover-art seed: { hue, glyph, accent }. The cover is a CSS-only
   *  generative card. */
  cover: {
    hue:    number;
    glyph:  string;
    accent: string;
  };
  /** Stems contributed by each character. v1 only DRUMMA is real. */
  drumPattern?: DrumPattern;
  bpm:        number;
}

export interface DenState {
  // Lobby vs. station
  currentStation: StationId;
  enterStation:   (id: NonNullable<StationId>) => void;
  exitStation:    () => void;

  // Draft track being assembled across mini-games this session
  draftDrumPattern: DrumPattern | null;
  setDraftDrumPattern: (p: DrumPattern | null) => void;

  // Library of saved tracks
  library: DenTrack[];
  saveDraftToLibrary: (name?: string) => void;
  resetDraft: () => void;

  // Friendship per character — a small int that grows by visiting
  friendship: Record<string, number>;
  bumpFriendship: (charId: string) => void;

  // Hydrate persisted state on mount
  hydrate: () => void;
}

const STORAGE_KEY = "grvd:den:v1";

interface PersistedShape {
  library:    DenTrack[];
  friendship: Record<string, number>;
}

function loadPersisted(): PersistedShape {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { library: [], friendship: {} };
    return JSON.parse(raw) as PersistedShape;
  } catch {
    return { library: [], friendship: {} };
  }
}

function savePersisted(p: PersistedShape) {
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

const COVER_GLYPHS = ["🌃", "🪐", "🌌", "🚇", "🌙", "💫", "🛰", "🌀", "🔮"];
const COVER_ACCENTS = ["#E94560", "#22d3ee", "#facc15", "#a78bfa", "#fb923c", "#4ade80"];

function generateCover(seed: number): DenTrack["cover"] {
  return {
    hue:    Math.floor((seed * 47) % 360),
    glyph:  COVER_GLYPHS[seed % COVER_GLYPHS.length],
    accent: COVER_ACCENTS[seed % COVER_ACCENTS.length],
  };
}

export const useDenStore = create<DenState>((set, get) => ({
  currentStation: null,
  enterStation: (id) => {
    set({ currentStation: id });
    get().bumpFriendship(id);
  },
  exitStation: () => set({ currentStation: null }),

  draftDrumPattern: null,
  setDraftDrumPattern: (p) => set({ draftDrumPattern: p }),

  library:    [],
  saveDraftToLibrary: (name) => {
    const draft = get().draftDrumPattern;
    if (!draft) return;
    const id        = `t-${Date.now().toString(36)}`;
    const fallback  = `track ${get().library.length + 1}`;
    const createdAt = Date.now();
    const cover     = generateCover(get().library.length);
    const track: DenTrack = {
      id,
      name:        name?.trim() || fallback,
      createdAt,
      cover,
      drumPattern: draft,
      bpm:         96,
    };
    const next = [track, ...get().library];
    set({ library: next, draftDrumPattern: null });
    savePersisted({ library: next, friendship: get().friendship });
  },
  resetDraft: () => set({ draftDrumPattern: null }),

  friendship: {},
  bumpFriendship: (charId) => {
    const cur  = get().friendship[charId] ?? 0;
    const next = { ...get().friendship, [charId]: cur + 1 };
    set({ friendship: next });
    savePersisted({ library: get().library, friendship: next });
  },

  hydrate: () => {
    const p = loadPersisted();
    set({ library: p.library ?? [], friendship: p.friendship ?? {} });
  },
}));
