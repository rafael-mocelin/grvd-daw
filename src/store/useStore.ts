import { create } from "zustand";
import type {
  ArtistCard,
  LayerKind,
  Layer,
  Mood,
  Need,
  Song,
  Tamagotchi,
  Template,
} from "../data/types";
import type { SkinId } from "../shell/skins";
import { ACHIEVEMENTS, getAchievement } from "../data/achievements";
import { upsertSong } from "../lib/db";

/* -------------------------------------------------------------------------- */
/* Stage machine — the 60-second journey                                       */
/* -------------------------------------------------------------------------- */

export type Stage =
  | "crib" // DAW is asleep, waiting to be pulled out
  | "template" // picking a template
  | "stack" // stacking the recipe
  | "vocal" // recording the hook (optional)
  | "name" // naming & exporting
  | "done" // song added to inventory
  | "booth" // Phase 4: Listening Booth
  | "coop"; // Phase 4: co-production

/* -------------------------------------------------------------------------- */
/* Derived mood                                                                */
/* -------------------------------------------------------------------------- */

export function computeMood(t: Tamagotchi): Mood {
  const avg = (t.needs.social + t.needs.creativity + t.needs.energy) / 3;
  if (avg < 15) return "sad";
  if (t.needs.social < 25) return "lonely";
  if (t.needs.energy < 25) return "sleepy";
  if (avg > 80) return "hyped";
  if (avg > 55) return "happy";
  return "chill";
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

interface State {
  // DAW state machine
  stage: Stage;
  // creation
  activeTemplate: Template | null;
  layers: Layer[];
  recipeIndex: number; // which layer kind we're currently picking
  songName: string;
  vocalBuffer: AudioBuffer | null;
  vocalBlobUrl: string | null;
  pitchScore: number | null;
  vocalPitchContour: number[] | null;   // frame-level MIDI notes from estimatePitchContour
  vocalAutotuneEnabled: boolean;        // true = snap to key during playback
  /** Per-section mute state for ArrangeView, keyed "kind:sectionId". */
  arrangeMutes: Record<string, boolean>;

  // 60-second timer
  sessionStartedAt: number | null; // ms timestamp when player picked a template

  // inventory
  inventory: Song[];
  booth: ArtistCard[]; // songs placed in the Listening Booth

  // player + companion
  player: { name: string; avatar: string };
  tamagotchi: Tamagotchi;

  // co-production simulation
  coopPeerName: string | null;
  coopPeerAvatar: string | null;

  // UI
  showLogbook: boolean;
  showStats: boolean;
  skinId: SkinId;
  isPlaying: boolean;
  canvasZoom: number;  // 0 = auto-compute on first CanvasBoard mount
  /** Admin-only override — when set, shell uses this mood instead of derived. null = normal. */
  moodOverride: Mood | null;

  // Lifetime stats
  longestStreak: number;
  longestSessionMs: number; // ms of the single longest creation session
  totalSongsAbandoned: number;

  // Gamification
  totalXP: number;
  unlockedAchievements: string[];
  achievementToastQueue: string[];
  xpFlashQueue: Array<{ id: string; amount: number; label: string; x: number; y: number }>;
  vocalCount: number;

  // ------- actions -------
  setStage: (s: Stage) => void;
  pickTemplate: (t: Template) => void;
  pickLayer: (kind: LayerKind, variant: string, soundId: string) => void;
  swapLayer: (kind: LayerKind, variant: string, soundId: string) => void;
  setRecipeIndex: (i: number) => void;
  skipKind: () => void;
  undoLast: () => void;
  setVocal: (buffer: AudioBuffer | null, blobUrl: string | null, pitchScore: number | null, pitchContour?: number[]) => void;
  toggleVocalAutotune: () => void;
  setArrangeMutes: (m: Record<string, boolean>) => void;
  setSongName: (name: string) => void;
  finalizeSong: (collaborators?: string[]) => Song;
  abandon: () => void;
  feedNeed: (need: Need, amount: number) => void;
  applyDailyDecay: () => void;
  setCoopPeer: (name: string | null, avatar: string | null) => void;
  placeInBooth: (songId: string, status: string) => void;
  setIsPlaying: (v: boolean) => void;
  setCanvasZoom: (v: number) => void;
  toggleLogbook: () => void;
  toggleStats: () => void;
  setSkin: (id: SkinId) => void;
  /** Admin-only: force a specific mood for testing. Pass null to clear. */
  setMoodOverride: (m: Mood | null) => void;
  reset: () => void;

  // Gamification actions
  addXP: (amount: number, label: string, x?: number, y?: number) => void;
  clearXPFlash: (id: string) => void;
  unlockAchievement: (achievementId: string) => void;
  popAchievementToast: () => void;
  checkAndUnlockAchievements: () => void;

  // Supabase sync
  loadUserData: (data: {
    songs?: Song[];
    tamagotchi?: Tamagotchi;
    stats?: {
      totalXP: number;
      unlockedAchievements: string[];
      longestStreak: number;
      longestSessionMs: number;
      totalSongsAbandoned: number;
      vocalCount: number;
    };
  }) => void;
  /** userId must be passed in so the store doesn't import supabase directly */
  setUserId: (id: string | null) => void;
  userId: string | null;
}

const FRESH_TAMAGOTCHI: Tamagotchi = {
  name: "GRVD",
  mood: "chill",
  needs: { social: 70, creativity: 70, energy: 80 },
  lastSeenAt: Date.now(),
  streakDays: 1,
  songsFinished: 0,
  songsAbandoned: 0,
};

export const useStore = create<State>((set, get) => ({
  stage: "crib",
  activeTemplate: null,
  layers: [],
  recipeIndex: 0,
  songName: "",
  vocalBuffer: null,
  vocalBlobUrl: null,
  pitchScore: null,
  vocalPitchContour: null,
  vocalAutotuneEnabled: true,   // autotune ON by default
  arrangeMutes: {},
  sessionStartedAt: null,

  inventory: [],
  booth: [],

  player: { name: "You", avatar: "🧢" },
  tamagotchi: { ...FRESH_TAMAGOTCHI },

  coopPeerName: null,
  coopPeerAvatar: null,

  showLogbook: false,
  showStats: false,
  skinId: "void" as SkinId,
  isPlaying: false,
  canvasZoom: 0,
  moodOverride: null,
  longestStreak: 0,
  longestSessionMs: 0,
  totalSongsAbandoned: 0,

  // Gamification
  totalXP: 0,
  unlockedAchievements: [],
  achievementToastQueue: [],
  xpFlashQueue: [],
  vocalCount: 0,

  // Auth
  userId: null,

  setStage: (s) => set({ stage: s }),

  pickTemplate: (t) => {
    set({
      activeTemplate: t,
      layers: [],
      recipeIndex: 0,
      songName: `${t.name} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      stage: "stack",
      sessionStartedAt: Date.now(), // ← 60-second clock starts here
    });
  },

  pickLayer: (kind, variant, soundId) => {
    const existingIdx = get().layers.findIndex((l) => l.kind === kind);
    const layer: Layer = {
      id: `${kind}-${Date.now()}`,
      kind,
      variant,
      soundId,
    };
    const layers = [...get().layers];
    if (existingIdx >= 0) {
      layers[existingIdx] = layer;
    } else {
      layers.push(layer);
    }
    // advance the recipe pointer
    const tpl = get().activeTemplate;
    const nextIdx = get().recipeIndex + 1;
    const recipeDone = tpl ? nextIdx >= tpl.recipe.length : true;
    set({
      layers,
      recipeIndex: recipeDone ? nextIdx : nextIdx,
    });
  },

  swapLayer: (kind, variant, soundId) => {
    const layers = get().layers.map((l) =>
      l.kind === kind ? { ...l, variant, soundId } : l
    );
    set({ layers });
  },

  setRecipeIndex: (i) => set({ recipeIndex: i }),

  skipKind: () => {
    const tpl = get().activeTemplate;
    const nextIdx = get().recipeIndex + 1;
    if (!tpl) return;
    set({ recipeIndex: nextIdx });
  },

  undoLast: () => {
    const layers = [...get().layers];
    layers.pop();
    set({
      layers,
      recipeIndex: Math.max(0, get().recipeIndex - 1),
    });
  },

  setVocal: (buffer, blobUrl, pitchScore, pitchContour) => {
    if (buffer !== null) {
      // Add (or refresh) a vocal layer so it appears in ArrangeView
      const existing = get().layers;
      const hasVocal = existing.some((l) => l.kind === "vocal");
      const vocalLayer: Layer = {
        id: `vocal-${Date.now()}`,
        kind: "vocal",
        variant: "hook",
        soundId: "vocal-recorded",
      };
      const newLayers = hasVocal
        ? existing.map((l) => l.kind === "vocal" ? { ...vocalLayer } : l)
        : [...existing, vocalLayer];
      set((s) => ({
        vocalBuffer: buffer,
        vocalBlobUrl: blobUrl,
        pitchScore,
        vocalPitchContour: pitchContour ?? null,
        vocalCount: s.vocalCount + 1,
        layers: newLayers,
      }));
    } else {
      // Remove vocal layer when skipping
      const newLayers = get().layers.filter((l) => l.kind !== "vocal");
      set({ vocalBuffer: null, vocalBlobUrl: null, pitchScore, vocalPitchContour: null, layers: newLayers });
    }
  },

  toggleVocalAutotune: () => set((s) => ({ vocalAutotuneEnabled: !s.vocalAutotuneEnabled })),

  setArrangeMutes: (m) => set({ arrangeMutes: m }),

  setSongName: (name) => set({ songName: name }),

  finalizeSong: (collaborators = []) => {
    const { activeTemplate, layers, songName, vocalBlobUrl, pitchScore, arrangeMutes, tamagotchi, player, sessionStartedAt, longestSessionMs, longestStreak } = get();
    if (!activeTemplate) throw new Error("No template active.");
    const song: Song = {
      id: `song-${Date.now()}`,
      name: songName || "Untitled Hook",
      bpm: activeTemplate.bpm,
      bars: activeTemplate.bars,
      keyRoot: activeTemplate.keyRoot,
      templateId: activeTemplate.id,
      layers: [...layers],
      tags: Array.from(new Set([...activeTemplate.tags])),
      collaborators: [player.name, ...collaborators],
      createdAt: Date.now(),
      vocalBlobUrl: vocalBlobUrl ?? undefined,
      pitchScore: pitchScore ?? undefined,
      arrangeMutes: Object.keys(arrangeMutes).length > 0 ? { ...arrangeMutes } : undefined,
    };
    // needs update: finishing a song feeds creativity + energy a bit
    const newTam: Tamagotchi = {
      ...tamagotchi,
      songsFinished: tamagotchi.songsFinished + 1,
      needs: {
        ...tamagotchi.needs,
        creativity: clamp(tamagotchi.needs.creativity + 15),
        energy: clamp(tamagotchi.needs.energy - 5),
        social: clamp(
          tamagotchi.needs.social + (collaborators.length > 0 ? 20 : 0)
        ),
      },
    };
    newTam.mood = computeMood(newTam);
    const sessionMs = sessionStartedAt ? Date.now() - sessionStartedAt : 0;
    set({
      inventory: [song, ...get().inventory],
      tamagotchi: newTam,
      stage: "done",
      longestSessionMs: Math.max(longestSessionMs, sessionMs),
      longestStreak: Math.max(longestStreak, newTam.streakDays),
    });
    // Persist to Supabase if the user is logged in
    const uid = get().userId;
    if (uid) upsertSong(song, uid);
    return song;
  },

  abandon: () => {
    const tam = get().tamagotchi;
    const newTam: Tamagotchi = {
      ...tam,
      songsAbandoned: tam.songsAbandoned + 1,
      needs: {
        ...tam.needs,
        creativity: clamp(tam.needs.creativity - 5),
        energy: clamp(tam.needs.energy - 3),
      },
    };
    newTam.mood = computeMood(newTam);
    set({
      stage: "crib",
      activeTemplate: null,
      layers: [],
      recipeIndex: 0,
      songName: "",
      vocalBuffer: null,
      vocalBlobUrl: null,
      pitchScore: null,
      vocalPitchContour: null,
      vocalAutotuneEnabled: true,
      arrangeMutes: {},
      sessionStartedAt: null,
      tamagotchi: newTam,
      isPlaying: false,
    });
  },

  feedNeed: (need, amount) => {
    const tam = get().tamagotchi;
    const newTam: Tamagotchi = {
      ...tam,
      needs: {
        ...tam.needs,
        [need]: clamp(tam.needs[need] + amount),
      },
    };
    newTam.mood = computeMood(newTam);
    set({ tamagotchi: newTam });
  },

  applyDailyDecay: () => {
    const tam = get().tamagotchi;
    const daysMissed = Math.floor(
      (Date.now() - tam.lastSeenAt) / (24 * 60 * 60 * 1000)
    );
    if (daysMissed <= 0) return;
    const decay = daysMissed * 20;
    const newTam: Tamagotchi = {
      ...tam,
      needs: {
        social: clamp(tam.needs.social - decay),
        creativity: clamp(tam.needs.creativity - decay),
        energy: clamp(tam.needs.energy - decay),
      },
      lastSeenAt: Date.now(),
      streakDays: daysMissed > 1 ? 1 : tam.streakDays + 1,
    };
    newTam.mood = computeMood(newTam);
    set({ tamagotchi: newTam });
  },

  setCoopPeer: (name, avatar) =>
    set({ coopPeerName: name, coopPeerAvatar: avatar }),

  placeInBooth: (songId, status) => {
    const song = get().inventory.find((s) => s.id === songId);
    if (!song) return;
    const card: ArtistCard = {
      id: `card-${Date.now()}`,
      name: get().player.name,
      avatar: get().player.avatar,
      songId: song.id,
      status,
      tags: song.tags,
      createdAt: Date.now(),
    };
    set({ booth: [card, ...get().booth] });
  },

  setIsPlaying:  (v) => set({ isPlaying: v }),
  setCanvasZoom: (v) => set({ canvasZoom: v }),
  toggleLogbook: () => set({ showLogbook: !get().showLogbook }),
  toggleStats: () => set({ showStats: !get().showStats }),
  setSkin: (id) => set({ skinId: id }),
  setMoodOverride: (m) => set({ moodOverride: m }),

  reset: () =>
    set({
      stage: "crib",
      activeTemplate: null,
      layers: [],
      recipeIndex: 0,
      songName: "",
      vocalBuffer: null,
      vocalBlobUrl: null,
      pitchScore: null,
      vocalPitchContour: null,
      vocalAutotuneEnabled: true,
      arrangeMutes: {},
      sessionStartedAt: null,
      isPlaying: false,
      // note: totalXP / unlockedAchievements persist across sessions
    }),

  /* ────────────────── Gamification ────────────────── */

  addXP: (amount, label, x, y) => {
    if (amount <= 0) return;
    const id = `xp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({
      totalXP: s.totalXP + amount,
      xpFlashQueue: [
        ...s.xpFlashQueue,
        {
          id, amount, label,
          x: x ?? window.innerWidth  * 0.5,
          y: y ?? window.innerHeight * 0.55,
        },
      ],
    }));
  },

  clearXPFlash: (id) =>
    set((s) => ({ xpFlashQueue: s.xpFlashQueue.filter((f) => f.id !== id) })),

  unlockAchievement: (achievementId) => {
    if (get().unlockedAchievements.includes(achievementId)) return;
    const ach = getAchievement(achievementId);
    set((s) => ({
      unlockedAchievements: [...s.unlockedAchievements, achievementId],
      achievementToastQueue: [...s.achievementToastQueue, achievementId],
      totalXP: s.totalXP + (ach?.xpReward ?? 0),
    }));
  },

  popAchievementToast: () =>
    set((s) => ({ achievementToastQueue: s.achievementToastQueue.slice(1) })),

  /* ────────────────── Supabase sync ────────────────── */

  setUserId: (id) => set({ userId: id }),

  loadUserData: ({ songs, tamagotchi, stats }) => {
    const patch: Partial<State> = {};
    if (songs)      patch.inventory = songs;
    if (tamagotchi) patch.tamagotchi = tamagotchi;
    if (stats) {
      patch.totalXP              = stats.totalXP;
      patch.unlockedAchievements = stats.unlockedAchievements;
      patch.longestStreak        = stats.longestStreak;
      patch.longestSessionMs     = stats.longestSessionMs;
      patch.totalSongsAbandoned  = stats.totalSongsAbandoned;
      patch.vocalCount           = stats.vocalCount;
    }
    set(patch);
  },

  checkAndUnlockAchievements: () => {
    const state = get();
    const { inventory, unlockedAchievements, totalXP, vocalCount, pitchScore } = state;

    for (const ach of ACHIEVEMENTS) {
      if (unlockedAchievements.includes(ach.id)) continue;
      const { trigger } = ach;
      let shouldUnlock = false;

      switch (trigger.type) {
        case "first_song":
          shouldUnlock = inventory.length >= 1;
          break;
        case "song_count":
          shouldUnlock = inventory.length >= (trigger.threshold ?? 1);
          break;
        case "vocal_count":
          shouldUnlock = vocalCount >= (trigger.threshold ?? 1);
          break;
        case "has_layer_kind":
          if (trigger.kind && inventory.length > 0) {
            shouldUnlock = inventory[0].layers.some((l) => l.kind === trigger.kind);
          }
          break;
        case "layer_count_in_song":
          if (inventory.length > 0) {
            shouldUnlock = inventory[0].layers.length >= (trigger.threshold ?? 4);
          }
          break;
        case "pitch_score":
          shouldUnlock = (pitchScore ?? 0) >= (trigger.threshold ?? 88);
          break;
        case "collab_count": {
          const collabs = inventory.filter((s) => s.collaborators.length > 1).length;
          shouldUnlock = collabs >= (trigger.threshold ?? 1);
          break;
        }
        case "xp_total":
          shouldUnlock = totalXP >= (trigger.threshold ?? 0);
          break;
        case "session_hours":
        case "manual":
          break;
      }

      if (shouldUnlock) {
        get().unlockAchievement(ach.id);
      }
    }
  },
}));

function clamp(v: number) {
  return Math.max(0, Math.min(100, v));
}
