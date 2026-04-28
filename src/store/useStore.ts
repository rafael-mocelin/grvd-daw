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
import { ACHIEVEMENTS, getAchievement } from "../data/achievements";
import { upsertSong, upsertStats, upsertTamagotchi, deleteAllSongs } from "../lib/db";
import {
  fetchLiveEnergy,
  fetchPublishedCatalog,
  fetchUserRatings,
  fetchUserEndorsements,
  rateSongRpc,
  endorseSongRpc,
  publishSongRpc,
  uploadSongAudio,
  spendEnergyRpc,
  type PublishedSong,
  type PublishSongResult,
} from "../lib/game-db";
import {
  publishSoundRpc,
  uploadProducerSound,
  claimSoundRpc,
  fetchMyInventory,
  fetchCatalogByIds,
  catalogRowToSoundOption,
  type PublishSoundResult,
  type ClaimSoundResult,
} from "../lib/sounds-db";
import { registerDynamicSounds, getSound } from "../data/sounds";
import { renderSongToWav, updateMuteState } from "../audio/engine";
import { patchCoopState, fetchCoopSession } from "../lib/coop-db";
import { TEMPLATES } from "../data/templates";

/* -------------------------------------------------------------------------- */
/* Stage machine — the 60-second journey                                       */
/* -------------------------------------------------------------------------- */

export type Stage =
  | "home"     // Slice-1 Tastemaker landing — three-role CTA hub
  | "crib"     // DAW is asleep, waiting to be pulled out (companion care)
  | "template" // picking a template
  | "stack"    // stacking the recipe
  | "vocal"    // recording the hook (optional)
  | "name"     // naming & exporting
  | "done"     // song added to inventory
  | "booth"    // Listening Booth (now serves published catalog for Tastemaker loop)
  | "leaderboard" // Slice 2: Top Songs / Artists / Tastemakers this week
  | "profile"  // Phase 3: TastemakerProfile (self) or ArtistProfile (other) — switched via profileUserId
  | "friends"  // Phase 3: Friends list + search + pending requests
  | "studio"   // Phase 5.B: sound inventory + producer publish + discover
  | "coop"     // Phase 4: co-production
  | "pet"      // UI v1: full-screen pet portal (the C in B+C from the AvatarPuck redesign)
  | "arrange"  // Slice 1: post-Done arrangement view (was a window in CanvasBoard)
  | "mixer";   // Slice 1: post-Done mixer view (was a window in CanvasBoard)

/**
 * Stages that belong to the song-creation pipeline. Used by setStage's
 * coop-sync logic: stage transitions INTO a creation stage broadcast to
 * the partner (so both clients walk through template → stack → vocal →
 * name → done together). Transitions OUT of creation are personal —
 * navigating home / booth / profile / friends doesn't drag the partner.
 */
const CREATION_STAGES = new Set<Stage>(["template", "stack", "vocal", "name", "done"]);

/* -------------------------------------------------------------------------- */
/* Publish-tier energy economy                                                 */
/*                                                                             */
/* `energy` here is the *publish-tier fuel* — the scarce resource that gates   */
/* endorsements, publishing songs, and (later) publishing templates. It is     */
/* NOT the same thing as `tamagotchi.needs.energy`, which is the companion's   */
/* tiredness meter (a visual mood driver only). They live on different state  */
/* slices and don't interact.                                                  */
/* -------------------------------------------------------------------------- */

/** Maximum stored energy. Stays fixed for Slice 1; may scale by level later. */
export const ENERGY_MAX = 100;

/** Regen interval: 1 unit every 5 minutes (matches server-side RPC default). */
export const ENERGY_REGEN_MS = 5 * 60 * 1000;

/** Energy costs for publish-tier actions. Must mirror the server-side guards. */
export const ENERGY_COSTS = {
  endorse:         15,
  publishSong:     40,
  publishSound:    15,
  publishTemplate: 40,
  visitCrib:       3,
  inviteToCrib:    5,
} as const;

/** Daily XP caps for free actions. Server enforces identical numbers via
 *  earn_xp_capped — the client copy is advisory only (for optimistic UI). */
export const XP_DAILY_CAPS = {
  rate:   40, //  2 XP × 20 ratings/day
  listen: 30, //  1 XP × 30 listens/day
} as const;

/**
 * tastemakerRatingLine — companion reaction to a star rating.
 *
 * Returns a short ticker line, or null if the rating is unremarkable (e.g.
 * a 3-star first pass). Called from rateSong so the companion feels
 * present without being chatty.
 */
export function tastemakerRatingLine(
  stars: number,
  opts: { isFirst: boolean; isChange: boolean },
): string | null {
  if (opts.isChange) {
    if (stars === 5) return "came around to it, huh";
    if (stars === 1) return "cold reversal";
    return "changing your mind?";
  }
  if (!opts.isFirst) return null; // same-star re-tap, stay quiet
  if (stars === 5) return "5★ — early taste, we'll see if it sticks";
  if (stars === 4) return "solid ears on you";
  if (stars === 1) return "brutal. but fair.";
  if (stars === 2) return "you're not feeling it. noted.";
  return null; // 3-star first pass: unremarkable
}

/** Compute live energy from stored base + elapsed regen. Pure, no I/O. */
export function computeLiveEnergy(
  base: number,
  updatedAtMs: number,
  now: number = Date.now(),
): number {
  const elapsed = Math.max(0, now - updatedAtMs);
  const regenUnits = Math.floor(elapsed / ENERGY_REGEN_MS);
  return Math.min(ENERGY_MAX, base + regenUnits);
}

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
  isPlaying: boolean;
  /** Admin-only override — when set, the avatar uses this mood instead of derived. null = normal. */
  moodOverride: Mood | null;
  /**
   * The line the DAW is currently "saying" — rendered as a speech bubble
   * above the MouthWave at the bottom of the shell. null when silent.
   * Set transient (auto-clearing) lines via sayLine(msg, durationMs).
   */
  dawTalk: string | null;

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

  // ─────────── Tastemaker / publish-tier economy (Slice 1) ───────────
  /** Base energy at last server sync. Compute live energy via computeLiveEnergy(energy, energyUpdatedAt). */
  energy: number;
  /** Millis timestamp of the last authoritative energy write. */
  energyUpdatedAt: number;
  /** Player level — affects publish caps in later slices. */
  level: number;
  /** Published catalog fetched from song_publication_stats (drops to listen + rate). */
  publishedCatalog: PublishedSong[];
  /** The current user's star ratings, keyed by songId. */
  userRatings: Record<string, number>;
  /** Song ids the current user has endorsed. */
  userEndorsements: string[];
  /** True while fetching the catalog — UI can show a loading state. */
  catalogLoading: boolean;

  // ------- actions -------
  setStage: (s: Stage) => void;
  /**
   * Which user's profile the "profile" stage should show.
   * - null → your own TastemakerProfile (listener stats).
   * - a uuid → that user's ArtistProfile (their drops, stats, become-fan).
   * When the caller equals the current userId we still render ArtistProfile
   * so you can see "how I look to everyone else."
   */
  profileUserId: string | null;
  /** Navigate to the Profile stage in one shot. Pass null/undefined for self. */
  openProfile: (userId?: string | null) => void;

  /**
   * Coop (Phase 4). Session id of the currently-active coop the user is in,
   * or null if they're not in a session. The Coop screen subscribes to this
   * row via Supabase Realtime; Phase 4.2 will use the same subscription to
   * sync shared DAW state.
   */
  activeCoopSessionId: string | null;
  setActiveCoopSession: (sessionId: string | null) => void;
  /** Navigate to the Coop stage, optionally entering a specific session. */
  openCoop: (sessionId?: string | null) => void;

  /**
   * Cached row of the currently-active coop session. Single source of
   * truth populated by AppCore's useCoopSession subscription so that
   * downstream components (Coop, future shared-DAW UI) can read the
   * row without each opening their own Realtime channel. null when no
   * session is active or the row hasn't loaded yet.
   */
  activeCoopRow: import("../lib/coop-db").CoopSession | null;
  setActiveCoopRow: (row: import("../lib/coop-db").CoopSession | null) => void;

  /**
   * Internal-ish flag flipped true while we're applying a shared-state blob
   * that came in from Supabase Realtime. Wrapped store actions (pickTemplate,
   * pickLayer, setStage, setSongName…) check this and SKIP their coop-sync
   * write — otherwise we'd bounce the same patch back to the server and
   * trigger a loop. Not persisted; purely a transient guard.
   */
  isApplyingCoopState: boolean;
  /**
   * Apply an incoming Phase 4.2 shared-state blob from the coop session.
   * Called by the useCoopSync hook when a Realtime row change fires.
   * This mirrors the fields we sync (template, layers, recipe index, song
   * name, stage) and deliberately ignores local-only fields (vocal buffer,
   * pitch score, audio-engine state) so each seat keeps its own audio.
   */
  applyCoopSharedState: (remote: Record<string, unknown>) => void;
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
  toggleLogbook: () => void;
  toggleStats: () => void;
  /** Admin-only: force a specific mood for testing. Pass null to clear. */
  setMoodOverride: (m: Mood | null) => void;
  /**
   * Make the DAW say a line (rendered above the MouthWave). Pass null to clear.
   * If durationMs > 0 the line auto-clears after that many ms (unless replaced
   * by another sayLine call in the meantime). durationMs = 0 / undefined means
   * the line persists until replaced or explicitly cleared.
   */
  sayLine: (msg: string | null, durationMs?: number) => void;
  reset: () => void;

  /* ─────────── Admin resets (wipe gamification state) ─────────── */
  /** Zero out total XP (level implicitly resets). Syncs to Supabase if signed in. */
  adminResetXP: () => void;
  /** Clear all unlocked achievements and any queued toasts. Syncs to Supabase. */
  adminResetAchievements: () => void;
  /** Zero out lifetime aggregate stats (streak, longest session, abandons, vocals). Syncs. */
  adminResetLifetimeStats: () => void;
  /** Delete every song in the inventory (and from Supabase, if signed in). */
  adminResetInventory: () => void;
  /** Reset the tamagotchi to a fresh newborn state. Syncs to Supabase. */
  adminResetTamagotchi: () => void;
  /** Nuclear option: runs every reset above in one shot. */
  adminResetEverything: () => void;

  // Gamification actions
  addXP: (amount: number, label: string, x?: number, y?: number) => void;
  clearXPFlash: (id: string) => void;
  unlockAchievement: (achievementId: string) => void;
  popAchievementToast: () => void;
  checkAndUnlockAchievements: () => void;

  // ─────────── Tastemaker actions (Slice 1) ───────────
  /** Refresh live energy + level + total XP from the server. Safe to no-op for guests. */
  loadPlayerEnergy: () => Promise<void>;
  /** Fetch the published catalog view. */
  loadPublishedCatalog: () => Promise<void>;
  /** Fetch the user's own ratings + endorsements for UI state. */
  loadUserTastemakerData: () => Promise<void>;
  /** Rate a song 1–5 stars. Upserts server-side and awards capped XP. */
  rateSong: (songId: string, stars: number) => Promise<void>;
  /** Endorse a song (energy-gated, atomic). Returns true on success. */
  endorseSong: (songId: string) => Promise<boolean>;
  /**
   * Publish an inventory song to the public booth. Renders the WAV,
   * uploads to Supabase Storage, calls publish_song RPC (which enforces
   * energy cost + daily cap + snapshots artist identity). On success
   * marks the song as published in-memory so the UI disables the button.
   */
  publishSong: (songId: string) => Promise<PublishSongResult | null>;
  /** Whether a publish is currently in flight (for UI disable + spinner). */
  publishingSongId: string | null;
  /**
   * Producer publish-sound flow (Phase 5.B step 4):
   *   1. Upload the recorded clip to the producer-sounds bucket.
   *   2. Call publish_sound RPC (validates inputs + charges energy +
   *      awards XP + inserts the catalog row + grants the producer
   *      the new sound).
   *   3. Commit authoritative server numbers to the store on success.
   * Returns the RPC result so the caller can surface the message.
   */
  publishSound: (args: {
    blob:        Blob;
    kind:        LayerKind;
    displayName: string;
    glyph:       string;
    variant?:    string | null;
    bpm?:        number | null;
    keyRoot?:    string | null;
  }) => Promise<PublishSoundResult | null>;
  /** Whether a publish-sound is currently in flight (UI disable + spinner). */
  publishingSound: boolean;
  /**
   * Producer claim flow (Phase 5.B step 5). Idempotent — if the player
   * already owns the sound, returns success with alreadyOwned=true and
   * no XP change. Producers self-claiming their own drop is a no-op.
   * Returns the RPC result so the caller can update local state.
   */
  claimSound: (soundId: string) => Promise<ClaimSoundResult | null>;
  /** sound_id currently being claimed — for per-tile spinner gating. */
  claimingSoundId: string | null;
  /**
   * Phase 5.B step 6 — the live inventory of soundIds the current user
   * owns. Drives the DAW sound picker (StackingView) so it filters to
   * what the player has, not the entire static catalog.
   *
   * `null` = inventory not yet loaded (guests, or first paint before
   * loadInventory resolves). Picker falls back to ALL_SOUNDS in that
   * state so the experience still works.
   *
   * Producer-published rows in this set also get pushed into
   * data/sounds.ts's dynamic registry on every load, so the audio engine
   * can resolve their fileUrl via getSound(id).
   */
  ownedSoundIds: Set<string> | null;
  /** Re-fetch the user's inventory + register producer drops. Safe to call
   *  repeatedly; idempotent. */
  loadInventory: () => Promise<void>;
  /**
   * Phase 5.B step 9 — local-only layer mute set.
   *
   * Each seat keeps an independent client-side set of muted layer ids.
   * Toggling adds/removes the id locally and routes through
   * engine.updateMuteState; we deliberately do NOT touch Layer.muted on
   * the synced layers array, so the partner's playback is unaffected.
   *
   * Cleared on abandon/finalize/coop-leave so stale ids never linger.
   */
  localMutedLayerIds: Set<string>;
  toggleLocalLayerMute: (layerId: string) => void;
  /**
   * Phase 5.B step 7 — when the active coop session's available_sound_ids
   * snapshot updates, fetch any catalog rows we don't already know +
   * register them with the audio engine. The picker reads availableSoundIds
   * directly from activeCoopRow; this action only handles the
   * register-for-engine-playback side effect.
   */
  ensureCoopUnionSounds: (ids: string[]) => Promise<void>;
  /**
   * Client-side optimistic energy spend — matches the server RPC's effect
   * locally so the meter animates immediately. Server authority still wins on
   * next loadPlayerEnergy() refresh. Guests (no userId) mutate locally only.
   */
  spendEnergyOptimistic: (cost: number, eventType: string, targetId?: string, xp?: number) => Promise<{ success: boolean; message: string }>;

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
  stage: "home",
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
  isPlaying: false,
  moodOverride: null,
  dawTalk: null,
  longestStreak: 0,
  longestSessionMs: 0,
  totalSongsAbandoned: 0,

  // Gamification
  totalXP: 0,
  unlockedAchievements: [],
  achievementToastQueue: [],
  xpFlashQueue: [],
  vocalCount: 0,

  // Tastemaker / publish-tier economy
  energy: ENERGY_MAX,           // guests start with a full bar; loadPlayerEnergy overwrites for real users
  energyUpdatedAt: Date.now(),
  level: 1,
  publishedCatalog: [],
  userRatings: {},
  userEndorsements: [],
  catalogLoading: false,
  publishingSongId: null,
  publishingSound:  false,
  claimingSoundId:  null,
  ownedSoundIds:    null,
  localMutedLayerIds: new Set<string>(),

  // Auth
  userId: null,

  setStage: (s) => {
    set({ stage: s });
    // Coop sync (Phase 4.2): broadcast stage transitions ONLY when
    // moving INTO a creation stage. This way the host clicking "start
    // cooking together" or picking a template still pulls the guest
    // along, but stepping OUT of the DAW (back to home / booth / a
    // profile / friends) is a personal action — the partner stays
    // where they are. Avoids the rude "host clicked back, why am I on
    // home now?" surprise. Going from creation→creation (e.g. stack
    // → vocal → name → done) still syncs because all those are in the
    // creation set.
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState && CREATION_STAGES.has(s)) {
      patchCoopState(sid, { stage: s });
    }
  },
  profileUserId: null,
  openProfile: (userId) => set({ stage: "profile", profileUserId: userId ?? null }),
  activeCoopSessionId: null,
  setActiveCoopSession: (sessionId) => set({ activeCoopSessionId: sessionId }),
  openCoop: (sessionId) =>
    set({ stage: "coop", activeCoopSessionId: sessionId ?? null }),
  activeCoopRow: null,
  setActiveCoopRow: (row) => set({ activeCoopRow: row }),

  isApplyingCoopState: false,
  applyCoopSharedState: (remote) => {
    // Narrow the blob to the fields we sync. Everything else is ignored.
    // The `isApplyingCoopState` guard prevents the wrapped actions from
    // re-emitting patches back to the server during this set().
    set({ isApplyingCoopState: true });
    try {
      const patch: Partial<State> = {};

      if (typeof remote.stage === "string") {
        patch.stage = remote.stage as Stage;
      }
      if (typeof remote.template_id === "string") {
        const tpl = TEMPLATES.find((t) => t.id === remote.template_id);
        if (tpl) patch.activeTemplate = tpl;
      } else if (remote.template_id === null) {
        patch.activeTemplate = null;
      }
      if (Array.isArray(remote.layers)) {
        patch.layers = remote.layers as Layer[];
      }
      if (typeof remote.recipe_index === "number") {
        patch.recipeIndex = remote.recipe_index;
      }
      if (typeof remote.song_name === "string") {
        patch.songName = remote.song_name;
      }
      if (typeof remote.session_started_at === "number") {
        patch.sessionStartedAt = remote.session_started_at;
      }

      if (Object.keys(patch).length > 0) set(patch);
    } finally {
      set({ isApplyingCoopState: false });
    }
  },

  pickTemplate: (t) => {
    const newName = `${t.name} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    const startedAt = Date.now();
    set({
      activeTemplate: t,
      layers: [],
      recipeIndex: 0,
      songName: newName,
      stage: "stack",
      sessionStartedAt: startedAt, // ← 60-second clock starts here
      localMutedLayerIds: new Set<string>(),  // step 9 — fresh slate per song
    });
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, {
        template_id:        t.id,
        layers:             [],
        recipe_index:       0,
        song_name:          newName,
        stage:              "stack",
        session_started_at: startedAt,
      });
    }
  },

  pickLayer: (kind, variant, soundId) => {
    const existingIdx = get().layers.findIndex((l) => l.kind === kind);
    const ownerId = get().userId ?? undefined;  // step 8 attribution
    const layer: Layer = {
      id: `${kind}-${Date.now()}`,
      kind,
      variant,
      soundId,
      sourceOwnerId: ownerId,
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
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, { layers, recipe_index: nextIdx });
    }
  },

  swapLayer: (kind, variant, soundId) => {
    const ownerId = get().userId ?? undefined;  // step 8 — re-attribute on swap
    const layers = get().layers.map((l) =>
      l.kind === kind ? { ...l, variant, soundId, sourceOwnerId: ownerId } : l
    );
    set({ layers });
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, { layers });
    }
  },

  setRecipeIndex: (i) => {
    set({ recipeIndex: i });
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, { recipe_index: i });
    }
  },

  skipKind: () => {
    const tpl = get().activeTemplate;
    const nextIdx = get().recipeIndex + 1;
    if (!tpl) return;
    set({ recipeIndex: nextIdx });
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, { recipe_index: nextIdx });
    }
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

  setSongName: (name) => {
    set({ songName: name });
    const sid = get().activeCoopSessionId;
    if (sid && !get().isApplyingCoopState) {
      patchCoopState(sid, { song_name: name });
    }
  },

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
      localMutedLayerIds: new Set<string>(),  // step 9 — drop stale per-seat mutes
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
  toggleLogbook: () => set({ showLogbook: !get().showLogbook }),
  toggleStats:   () => set({ showStats: !get().showStats }),
  setMoodOverride: (m) => set({ moodOverride: m }),

  sayLine: (msg, durationMs) => {
    set({ dawTalk: msg });
    if (msg && durationMs && durationMs > 0) {
      // Only auto-clear if this specific message is still the one showing
      // (a later sayLine() call would have replaced it).
      setTimeout(() => {
        if (get().dawTalk === msg) set({ dawTalk: null });
      }, durationMs);
    }
  },

  reset: () =>
    set({
      stage: "home",
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
      // note: totalXP / unlockedAchievements / energy persist across sessions
    }),

  /* ────────────────── Admin resets ──────────────────
   * Each reset mutates the local store first, then fires a best-effort
   * sync to Supabase when the user is signed in. If the user is a guest
   * the sync is skipped (there's nothing to sync).
   */

  adminResetXP: () => {
    set({ totalXP: 0, xpFlashQueue: [] });
    const s = get();
    if (s.userId) {
      upsertStats(
        {
          totalXP: 0,
          unlockedAchievements: s.unlockedAchievements,
          longestStreak: s.longestStreak,
          longestSessionMs: s.longestSessionMs,
          totalSongsAbandoned: s.totalSongsAbandoned,
          vocalCount: s.vocalCount,
        },
        s.userId
      );
    }
  },

  adminResetAchievements: () => {
    set({ unlockedAchievements: [], achievementToastQueue: [] });
    const s = get();
    if (s.userId) {
      upsertStats(
        {
          totalXP: s.totalXP,
          unlockedAchievements: [],
          longestStreak: s.longestStreak,
          longestSessionMs: s.longestSessionMs,
          totalSongsAbandoned: s.totalSongsAbandoned,
          vocalCount: s.vocalCount,
        },
        s.userId
      );
    }
  },

  adminResetLifetimeStats: () => {
    set({
      longestStreak: 0,
      longestSessionMs: 0,
      totalSongsAbandoned: 0,
      vocalCount: 0,
    });
    const s = get();
    if (s.userId) {
      upsertStats(
        {
          totalXP: s.totalXP,
          unlockedAchievements: s.unlockedAchievements,
          longestStreak: 0,
          longestSessionMs: 0,
          totalSongsAbandoned: 0,
          vocalCount: 0,
        },
        s.userId
      );
    }
  },

  adminResetInventory: () => {
    set({ inventory: [], booth: [] });
    const s = get();
    if (s.userId) deleteAllSongs(s.userId);
  },

  adminResetTamagotchi: () => {
    const fresh: Tamagotchi = {
      ...FRESH_TAMAGOTCHI,
      lastSeenAt: Date.now(),
    };
    set({ tamagotchi: fresh, moodOverride: null });
    const s = get();
    if (s.userId) upsertTamagotchi(fresh, s.userId);
  },

  adminResetEverything: () => {
    get().adminResetXP();
    get().adminResetAchievements();
    get().adminResetLifetimeStats();
    get().adminResetInventory();
    get().adminResetTamagotchi();
    // Also return the in-session DAW to a clean crib state
    get().reset();
  },

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

  /* ────────────────── Tastemaker actions (Slice 1) ────────────────── */

  loadPlayerEnergy: async () => {
    const uid = get().userId;
    if (!uid) return; // guests stay on their full local bar
    const live = await fetchLiveEnergy();
    if (!live) return;
    set({
      energy:          live.liveEnergy,
      energyUpdatedAt: new Date(live.energyUpdatedAt).getTime(),
      level:           live.level,
      totalXP:         live.totalXp,
    });
  },

  loadPublishedCatalog: async () => {
    set({ catalogLoading: true });
    // Pass the current user id so the booth catalog excludes the player's
    // own drops. Artists shouldn't be able to rate or push their own songs.
    // Guests (no userId) see everyone's catalog.
    const rows = await fetchPublishedCatalog(50, get().userId ?? null);
    set({ publishedCatalog: rows, catalogLoading: false });
  },

  loadUserTastemakerData: async () => {
    const uid = get().userId;
    if (!uid) return;
    const [ratings, endorsements] = await Promise.all([
      fetchUserRatings(uid),
      fetchUserEndorsements(uid),
    ]);
    set({ userRatings: ratings, userEndorsements: endorsements });
  },

  rateSong: async (songId, stars) => {
    // Grab prior rating BEFORE we stomp it so we know if this is a change.
    const priorStars = get().userRatings[songId];
    const isChange   = priorStars !== undefined && priorStars !== stars;
    const isFirst    = priorStars === undefined;

    // Optimistic local write so the UI snaps instantly.
    set((s) => ({ userRatings: { ...s.userRatings, [songId]: stars } }));

    // Companion reaction based on what the user did. Short ticker line so
    // the player feels heard. Only nudge on meaningful events — silent on
    // middle-of-the-road ratings (2-3 stars on first try).
    const line = tastemakerRatingLine(stars, { isFirst, isChange });
    if (line) get().sayLine(line, 2200);

    const uid = get().userId;
    if (!uid) return; // guests only mutate locally
    const result = await rateSongRpc(songId, stars);
    if (result) {
      set((s) => ({ totalXP: result.newXp || s.totalXP }));
      // Optimistic aggregate bump on the local catalog row so UI shows the
      // effect without a full refetch. Server-side view is still source of
      // truth for everyone else.
      set((s) => ({
        publishedCatalog: s.publishedCatalog.map((row) => {
          if (row.songId !== songId) return row;
          // If the user had no prior rating, the aggregate gains a count.
          // (We captured priorStars above before the optimistic write.)
          return {
            ...row,
            ratingCount: isFirst ? row.ratingCount + 1 : row.ratingCount,
          };
        }),
      }));
    }
  },

  endorseSong: async (songId) => {
    const uid = get().userId;
    if (get().userEndorsements.includes(songId)) return false;

    // Client-side affordability precheck — fast fail without a round-trip.
    // The server (endorse_song RPC) is the real authority; it ALSO checks
    // the level-scaled daily cap, which we can't know locally without an
    // extra round-trip. If the cap is hit, we'll find out from the RPC
    // response and roll back.
    const liveNow = computeLiveEnergy(get().energy, get().energyUpdatedAt);
    if (liveNow < ENERGY_COSTS.endorse) {
      get().sayLine("not enough energy for that push", 2400);
      return false;
    }

    // Optimistic local update: feels snappy, rollback on server rejection.
    set((s) => ({
      energy:          Math.max(0, liveNow - ENERGY_COSTS.endorse),
      energyUpdatedAt: Date.now(),
      userEndorsements: [...s.userEndorsements, songId],
      publishedCatalog: s.publishedCatalog.map((r) =>
        r.songId === songId ? { ...r, endorsementCount: r.endorsementCount + 1 } : r
      ),
    }));

    if (!uid) return true; // guests push locally; no server write

    // Atomic server call — spends energy, awards XP, inserts the endorsement,
    // enforces the daily cap, and logs the event in one transaction.
    const result = await endorseSongRpc(songId);

    if (!result || !result.success) {
      // Roll back optimistic local state.
      set((s) => ({
        energy:          liveNow,
        energyUpdatedAt: Date.now(),
        userEndorsements: s.userEndorsements.filter((id) => id !== songId),
        publishedCatalog: s.publishedCatalog.map((r) =>
          r.songId === songId ? { ...r, endorsementCount: Math.max(0, r.endorsementCount - 1) } : r
        ),
      }));
      // Server message is the source of truth for the reason — cap reached,
      // duplicate push, not enough energy, etc. Surface it verbatim.
      get().sayLine(result?.message ?? "couldn't push that one", 2600);
      return false;
    }

    // Commit the authoritative numbers from the server.
    set({
      energy:          result.newEnergy,
      energyUpdatedAt: Date.now(),
      totalXP:         result.newXp || get().totalXP,
      level:           result.newLevel || get().level,
    });

    // Companion reaction — prefer the cap-aware server message when we're
    // approaching the cap, otherwise use our own "low tank" warning.
    const atCapEdge = result.endorsementsToday >= result.dailyCap - 1;
    const postLine = atCapEdge
      ? `push sent 🔥 — ${result.endorsementsToday}/${result.dailyCap} today`
      : result.newEnergy < ENERGY_COSTS.endorse
        ? "push sent 🔥 — tank's running low"
        : "push sent 🔥 let's see who else hears it";
    get().sayLine(postLine, 2600);
    return true;
  },

  publishSong: async (songId) => {
    const uid = get().userId;
    if (!uid) {
      get().sayLine("sign in to publish", 2400);
      return null;
    }
    if (get().publishingSongId) {
      // Already publishing another song; avoid concurrent WAV renders.
      get().sayLine("one at a time", 2000);
      return null;
    }

    const song = get().inventory.find((s) => s.id === songId);
    if (!song) {
      get().sayLine("song not found", 2000);
      return null;
    }
    // Already-published guard: server also checks this and returns a clean
    // message, but we short-circuit locally to skip the render + upload.
    if (song.publishedPublicationId) {
      get().sayLine("already out there", 2200);
      return null;
    }

    set({ publishingSongId: songId });
    get().sayLine("rendering the final mix…", 3000);

    try {
      // 1. Render the WAV. Uses the same path the Logbook download button uses.
      //    vocalBuffer is only in memory for the most recently recorded song;
      //    historical songs render without the vocal stem — acceptable.
      const wav = await renderSongToWav(song, get().vocalBuffer);

      // 2. Upload to storage.
      get().sayLine("uploading to the booth…", 3000);
      const uploadResult = await uploadSongAudio(uid, songId, wav);
      if (!uploadResult.publicUrl) {
        // Surface the actual Supabase error — helps diagnose RLS /
        // permission / size issues in the field.
        const reason = uploadResult.error ?? "unknown";
        get().sayLine(`upload failed: ${reason}`, 4000);
        return null;
      }
      const audioUrl = uploadResult.publicUrl;

      // 3. Gather any collaborators (Phase 5.A). If we're publishing from
      //    inside an active coop session, include the other participants
      //    so the booth/leaderboard/profile attribute the drop correctly.
      //    Server dedupes + drops the caller, so it's safe to send everyone.
      let collaboratorIds: string[] = [];
      const coopId = get().activeCoopSessionId;
      if (coopId) {
        const session = await fetchCoopSession(coopId);
        if (session) {
          collaboratorIds = [session.hostId, session.guestId]
            .filter((id): id is string => !!id && id !== uid);
        }
      }

      // 4. Atomic server commit.
      const result = await publishSongRpc(songId, audioUrl, collaboratorIds);
      if (!result || !result.success) {
        get().sayLine(result?.message ?? "publish failed", 2800);
        return result;
      }

      // 4. Commit authoritative server numbers + mark in-memory song as
      //    published so the button disables on repeat.
      set((s) => ({
        energy:          result.newEnergy,
        energyUpdatedAt: Date.now(),
        totalXP:         result.newXp || s.totalXP,
        level:           result.newLevel || s.level,
        inventory: s.inventory.map((row) =>
          row.id === songId
            ? { ...row, publishedPublicationId: result.publicationId ?? undefined }
            : row
        ),
      }));

      // 5. Re-fetch the booth catalog in the background so the new drop
      //    shows up next time the booth loads (don't await — UX concern
      //    is that publish returns fast).
      get().loadPublishedCatalog();

      // 6. Companion reaction — cap-aware "keep one in the tank".
      const atCapEdge = result.publicationsToday >= result.dailyCap;
      get().sayLine(
        atCapEdge
          ? `dropped 🎧 — that's your ${result.publicationsToday}/${result.dailyCap} for today`
          : "dropped 🎧 it's out there now",
        2800,
      );

      return result;
    } catch (err) {
      console.error("[store] publishSong:", err);
      get().sayLine("render failed — check the console", 2800);
      return null;
    } finally {
      set({ publishingSongId: null });
    }
  },

  publishSound: async ({ blob, kind, displayName, glyph, variant, bpm, keyRoot }) => {
    const uid = get().userId;
    if (!uid) {
      get().sayLine("sign in to publish sounds", 2400);
      return null;
    }
    if (get().publishingSound) {
      get().sayLine("one at a time", 2000);
      return null;
    }

    set({ publishingSound: true });
    get().sayLine("uploading the clip…", 2400);

    try {
      // 1. Upload clip to storage. Storage RLS enforces own-folder writes.
      const upload = await uploadProducerSound(blob);
      if (!upload.publicUrl) {
        get().sayLine(`upload failed: ${upload.error ?? "unknown"}`, 4000);
        return null;
      }

      // 2. Atomic server commit.
      const result = await publishSoundRpc({
        kind,
        displayName,
        glyph,
        audioUrl: upload.publicUrl,
        variant,
        bpm,
        keyRoot,
      });
      if (!result || !result.success) {
        get().sayLine(result?.message ?? "publish failed", 2800);
        return result;
      }

      // 3. Commit authoritative server numbers.
      set((s) => ({
        energy:          result.newEnergy,
        energyUpdatedAt: Date.now(),
        totalXP:         result.newXp    || s.totalXP,
        level:           result.newLevel || s.level,
      }));

      // 4. Refresh inventory so the auto-granted producer row appears in
      //    the DAW picker + Studio MINE without a stale-cache window.
      get().loadInventory();

      // 5. Companion reaction.
      const atCapEdge = result.publicationsToday >= result.dailyCap;
      get().sayLine(
        atCapEdge
          ? `dropped 🎛️ — that's your ${result.publicationsToday}/${result.dailyCap} for today`
          : "dropped 🎛️ producers eat",
        2800,
      );

      return result;
    } catch (err) {
      console.error("[store] publishSound:", err);
      get().sayLine("publish failed — check the console", 2800);
      return null;
    } finally {
      set({ publishingSound: false });
    }
  },

  claimSound: async (soundId) => {
    const uid = get().userId;
    if (!uid) {
      get().sayLine("sign in to claim", 2400);
      return null;
    }
    if (get().claimingSoundId) {
      // Already mid-claim somewhere — avoid pile-ups while waiting on RPC.
      return null;
    }
    set({ claimingSoundId: soundId });
    try {
      const result = await claimSoundRpc(soundId);
      if (!result) {
        get().sayLine("claim failed", 2400);
        return null;
      }
      if (!result.success) {
        get().sayLine(result.message ?? "claim failed", 2800);
        return result;
      }
      // Server-authoritative messaging. The claimer doesn't get XP from
      // claiming today — producer XP is awarded on the server side.
      if (result.alreadyOwned) {
        get().sayLine("already in your bag", 2200);
      } else {
        // Refresh inventory so the new sound shows up in the DAW picker
        // + MINE inventory grid immediately.
        get().loadInventory();
        get().sayLine("claimed 💿 it's yours now", 2400);
      }
      return result;
    } catch (err) {
      console.error("[store] claimSound:", err);
      get().sayLine("claim failed — check the console", 2800);
      return null;
    } finally {
      set({ claimingSoundId: null });
    }
  },

  loadInventory: async () => {
    const uid = get().userId;
    if (!uid) {
      // Guests have no inventory in the DB; clear and let the picker
      // fall back to ALL_SOUNDS (the original starter-everywhere mode).
      set({ ownedSoundIds: null });
      return;
    }
    const rows = await fetchMyInventory(uid);
    // Register every owned producer-published row so the audio engine
    // can resolve their fileUrl in getSound(id). Starter rows already
    // exist in ALL_SOUNDS so we skip registering them — keeps the
    // synth-rendered starter behavior intact.
    const dynamic = rows
      .filter((r) => r.category === "producer_published")
      .map(catalogRowToSoundOption);
    if (dynamic.length > 0) registerDynamicSounds(dynamic);
    set({ ownedSoundIds: new Set(rows.map((r) => r.id)) });
  },

  toggleLocalLayerMute: (layerId) => {
    const next = new Set(get().localMutedLayerIds);
    const willMute = !next.has(layerId);
    if (willMute) next.add(layerId);
    else          next.delete(layerId);
    // Update audio first so the change is audible immediately; the React
    // rerender from set() lags by a frame and the latency is felt.
    updateMuteState(layerId, willMute);
    set({ localMutedLayerIds: next });
  },

  ensureCoopUnionSounds: async (ids) => {
    if (!ids.length) return;
    // Skip ids the engine can already resolve (static catalog OR previously
    // registered dynamic). The remaining set is the partner's exclusive
    // producer drops we haven't seen yet.
    const unknown = ids.filter((id) => !getSound(id));
    if (unknown.length === 0) return;
    const rows = await fetchCatalogByIds(unknown);
    if (rows.length > 0) {
      registerDynamicSounds(rows.map(catalogRowToSoundOption));
    }
  },

  spendEnergyOptimistic: async (cost, eventType, targetId, xp = 0) => {
    const liveNow = computeLiveEnergy(get().energy, get().energyUpdatedAt);
    if (liveNow < cost) return { success: false, message: "Not enough energy" };
    const uid = get().userId;
    // Optimistic local deduction
    set({
      energy:          Math.max(0, liveNow - cost),
      energyUpdatedAt: Date.now(),
    });
    if (!uid) return { success: true, message: "OK (local)" };
    const result = await spendEnergyRpc(cost, eventType, targetId ?? null, xp);
    if (!result || !result.success) {
      // Roll back
      set({ energy: liveNow, energyUpdatedAt: Date.now() });
      return { success: false, message: result?.message ?? "Spend failed" };
    }
    set({
      energy:          result.newEnergy,
      energyUpdatedAt: Date.now(),
      totalXP:         result.newXp || get().totalXP,
    });
    return { success: true, message: "OK" };
  },
}));

function clamp(v: number) {
  return Math.max(0, Math.min(100, v));
}
