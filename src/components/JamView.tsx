/**
 * JamView — Incredibox/Sprunki-style live mixing stage.
 *
 * Layout (16:9 landscape, scales to fit any viewport):
 *
 *   ┌──────────┬─────────────────────────────────────┐
 *   │          │                                     │
 *   │  SOUND   │       [studio backdrop]             │
 *   │  PALETTE │                                     │
 *   │          │     ╭───╮  ╭───╮  ╭───╮             │
 *   │  drums   │     │ A │  │ B │  │ C │             │
 *   │  hats    │     ╰───╯  ╰───╯  ╰───╯             │
 *   │  808     │                                     │
 *   │  sample  │  ← drag a sound onto a character    │
 *   │          │                                     │
 *   └──────────┴─────────────────────────────────────┘
 *
 * MVP scope:
 *   - 3 default character slots, distinct jacket colors
 *   - Drag-drop a sound from the palette onto a slot to assign it
 *   - Each slot loops its assigned sound, phase-locked to a master
 *     transport so all slots stay in sync regardless of when added
 *   - Tap a slot to open per-slot controls (mute / volume / clear)
 *   - Mute = blindfold animation; loud volume = lightning VFX
 *   - Master BPM defaults to 140; chosen so the most common loops
 *     (140 / 144 / 150) only need a small rate-stretch
 *
 * Out of MVP:
 *   - Slot upgrades (we hint at it visually with a locked 4th tile)
 *   - Per-character effects (reverb / delay / filter)
 *   - Saving the jam as a song
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { REAL_SOUNDS } from "../data/sounds";
import type { SoundOption } from "../data/types";
import { Crib } from "./jam/Crib";
import { BandSlot } from "./jam/BandSlot";
import { CharacterPalette, PLACE_CHAR_MIME } from "./jam/CharacterPalette";
import { CharacterControls } from "./jam/CharacterControls";
import { StageSpot } from "./jam/StageSpot";
import { PlayerAtMic } from "./jam/PlayerAtMic";
import { ComboBanner } from "./jam/ComboBanner";
import { ComboBurst } from "./jam/ComboBurst";
import { COMBOS, detectCombo, type JamCombo } from "../data/jamCombos";
import {
  HYPE_POOL,
  type CharacterKind,
} from "../data/characterSkins";
import { getPlaceable, PLACEABLE_CHARS, type PlaceableChar } from "../data/placeableChars";
import { CHARACTER_SKINS } from "../data/characterSkins";
import { JamArrange, ARRANGE_ACCENT, characterIconFor, playerArrangeRow, type ArrangeRow, SECTIONS as ARRANGE_SECTIONS } from "./jam/JamArrange";
import { CassetteRack } from "./jam/CassetteRack";
import { JamLibrary } from "./jam/JamLibrary";
import { useJamStore } from "../store/useJamStore";
import type { JamSong, JamSlotSnapshot, JamPlacementSnapshot } from "../data/jamSongs";
import { useJamAudioFrame } from "../hooks/useJamAudioFrame";
import { ComboCodex } from "./jam/ComboCodex";
import {
  assignSlot,
  clearSlot,
  setSlotVolume,
  setSlotMuted,
  setMasterBpm,
  setVocalSync,
  setVocalAutotune,
  clearAllSlots,
  pauseJam,
  resumeJam,
  assignVocalSlot,
} from "../audio/jamEngine";
import { ensureAudio, recordVocal } from "../audio/engine";
import { playJamComboSting, playMetronomeTick } from "../audio/jamSfx";
import * as Tone from "tone";
import { C } from "../ui/burst/tokens";

/**
 * Sentinel id passed in via the palette's "MIC" tile. The slot's
 * SoundOption stays null in state (since it's not a catalog entry);
 * the slot value is the recorded buffer instead.
 */
const VOCAL_DROP_ID = "__vocal__";

/**
 * Free-place model — there are no longer fixed band slots. The player
 * picks characters from the floating CharacterPalette popup and drops
 * them anywhere in the room; each placement records its own iso
 * position and audio bus. The player slot at the mic is still fixed.
 *
 * The band character roster (each (character × sound) pair) lives in
 * src/data/placeableChars.ts. The audio engine is keyed by slotId,
 * which we set equal to the soundId — every soundId can be on stage
 * at most once, so this is a stable unique key.
 */

/** Player slot id — distinct from band slots and special-cased in
 *  drop / render logic. Held in slotState alongside band entries so
 *  the audio engine and combo detector treat it uniformly. */
const PLAYER_SLOT_ID = "slot-player";

/** Default player + mic-stand position — front-center, where the lead
 *  used to live in the fixed model. The placement-mode flow lets the
 *  player be dropped anywhere; this just seeds the value before the
 *  first placement and is kept around as a sensible fallback. */
const DEFAULT_PLAYER_POS = { x: 53, y: 74 };

/** Pick a random hype line for a placed band character. Player slot
 *  has no pool — they're the lead, they let the band hype them. */
function randomHypeForCharacter(kind: CharacterKind | undefined): string | null {
  if (!kind) return null;
  const pool = HYPE_POOL[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Clamp an x/y in % to the valid room range so a near-edge drop
 *  doesn't fall off the iso floor. No grid snap — characters land
 *  exactly where the cursor is so the player has pixel-precise
 *  control over placement and can make small adjustments by
 *  dragging. */
function clampPos(xPct: number, yPct: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(100, xPct)),
    y: Math.max(0, Math.min(100, yPct)),
  };
}

/* -------------------------------------------------------------------------- */
/* Floating "+" button position — persisted in localStorage so the player's   */
/* preferred parking spot for the character menu survives reloads. Stored as   */
/* % of the room overlay (square contained in the stage) so the button tracks  */
/* the same room location at any viewport size.                                */
/* -------------------------------------------------------------------------- */

const CHAR_BTN_POS_KEY = "grvd:jam:char-button-pos:v1";
const CHAR_BTN_DEFAULT = { x: 8, y: 50 };  // left wall, vertically centered

function loadCharBtnPos(): { x: number; y: number } {
  try {
    const raw = window.localStorage.getItem(CHAR_BTN_POS_KEY);
    if (!raw) return { ...CHAR_BTN_DEFAULT };
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return clampBtnPos(parsed);
    }
  } catch { /* ignore — corrupt or unavailable storage */ }
  return { ...CHAR_BTN_DEFAULT };
}

function saveCharBtnPos(pos: { x: number; y: number }) {
  try {
    window.localStorage.setItem(CHAR_BTN_POS_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

/** Clamp the button to the room — pad a little so the chunky disc
 *  doesn't fall off the wall edges. */
function clampBtnPos(pos: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(2, Math.min(98, pos.x)),
    y: Math.max(2, Math.min(98, pos.y)),
  };
}

/** Master BPM defaults — chosen so the most common loops (140 / 144 /
 *  150) only need a small rate stretch. The user can dial this live
 *  via the top-bar control; setMasterBpm() updates Tone.Transport AND
 *  recomputes every active player's rate so the music stays in sync. */
const DEFAULT_BPM = 140;
const MIN_BPM = 70;
const MAX_BPM = 200;

/** localStorage key for combo-discovery persistence. Bumping the suffix
 *  is a clean way to wipe stored discoveries during a schema migration. */
const DISCOVERED_KEY = "grvd:jam:discovered-combos:v1";

interface SlotState {
  soundId:   string | null;
  muted:     boolean;
  volume:    number;
  /** Vocal-slot only: whether this slot's player rate-stretches to
   *  match the master BPM (true) or stays at its recorded tempo
   *  (false). Default false so changing master BPM doesn't break
   *  existing recordings. The popover surfaces this as a toggle. */
  syncToBpm: boolean;
  /** Vocal-slot only: semitone offset for the autotune pitch
   *  shifter (-12..+12). Default 0. */
  autotunePitch?:  number;
  /** Vocal-slot only: 0..1 chorus wet-blend driving the autotune
   *  effect amount. Default 0.5 — produced-sounding but not
   *  cartoonish. */
  autotuneEffect?: number;
}

const EMPTY_SLOT: SlotState = { soundId: null, muted: false, volume: 1.0, syncToBpm: false };

/** Vocal slot defaults applied when a fresh recording lands. */
const VOCAL_AUTOTUNE_DEFAULT_PITCH  = 0;
const VOCAL_AUTOTUNE_DEFAULT_EFFECT = 0.5;

/** XP gate for the bottom arrange-timeline feature. The player has
 *  to do a bit of music creation before this unlocks, so the empty
 *  jam stage doesn't lead with a "DAW UI" they don't yet need. */
const ARRANGE_UNLOCK_XP = 300;

export function JamView() {
  const setStage = useStore((s) => s.setStage);
  const totalXP  = useStore((s) => s.totalXP);

  // Per-slot state, keyed by the slot id. Band slots use the
  // characterKind as their slotId ("drum-guy" / "beat-guy" /
  // "guitar-guy") — stable across sound swaps so the audio engine and
  // popover anchor stay valid when the player cycles to a different
  // sound for the same character. Player slot uses PLAYER_SLOT_ID.
  // Empty band entries are absent from the map (not present == empty).
  const [slotState, setSlotState] = useState<Record<string, SlotState>>(() => ({
    [PLAYER_SLOT_ID]: { ...EMPTY_SLOT },
  }));

  // Iso position + assigned soundId per placed band character, keyed
  // by characterKind. The soundId is mutable: cycling sounds in the
  // popover updates it without changing the key, so the placement
  // (and its iso position + audio bus) stays put.
  const [bandPlacements, setBandPlacements] = useState<
    Partial<Record<CharacterKind, { soundId: string; pos: { x: number; y: number } }>>
  >({});

  // Whether the floating CharacterPalette popup is open.
  const [paletteOpen, setPaletteOpen] = useState(false);

  // ── Saved-jams state ──
  // Cassette rack opens this overlay; RECORD button can either save
  // instantly (no arrange unlocked) or run an interactive recording
  // pass through the unlocked sections.
  const jamSongs   = useJamStore((s) => s.songs);
  const saveJam    = useJamStore((s) => s.saveJam);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** Active recording pass — null when idle. Shape:
   *  { startedAtSec, durationSec, mode }. mode = 'arrange' runs a
   *  playhead pass; mode = 'instant' fires immediately. */
  const [recordingPass, setRecordingPass] = useState<
    { startedAtSec: number; durationSec: number } | null
  >(null);
  /** Save-confirm overlay state. Shows a name field after a recording
   *  pass completes (or on Back when there are unsaved changes). */
  const [saveDialog, setSaveDialog] = useState<{
    nameDraft: string;
    /** If set, on confirm/cancel we also exit the stage. */
    exitAfter: boolean;
  } | null>(null);
  /** Tracks whether the current jam state has unsaved changes (i.e.,
   *  the player has dropped a character / recorded since the last
   *  RECORD commit). Used to fire the back-prompt. */
  const [dirty, setDirty] = useState(false);
  /** Vocal AudioBuffer kept in a ref so the save snapshot can capture
   *  it without polluting slotState (AudioBuffer isn't JSON). */
  const vocalBufferRef = useRef<AudioBuffer | null>(null);

  // ── Arrange per-section mute state ──
  // Keyed `${slotId}:${sectionId}`. true = that slot is silent during
  // that section. Sectional mute is COMBINED with the slot's global
  // mute by JamArrange's RAF loop, which calls onApplyEffectiveMutes
  // every frame with the currently-silent slot ids — we push that
  // straight to the audio engine via setSlotMuted below.
  const [arrangeMutes, setArrangeMutes] = useState<Record<string, boolean>>({});
  /** Most recent set of "effectively muted" slot ids (global ∪
   *  section). Stored in a ref so the RAF tick can diff without
   *  re-rendering each frame. */
  const effectiveMutedRef = useRef<Set<string>>(new Set());

  function toggleArrangeMute(slotId: string, sectionId: string) {
    const key = `${slotId}:${sectionId}`;
    setArrangeMutes((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /** Called every animation frame by JamArrange with the slot ids
   *  that should be silent right now. We diff against the previous
   *  effective set and push only the changes into setSlotMuted so the
   *  engine doesn't churn on every frame. */
  function applyEffectiveMutes(mutedSlotIds: Set<string>) {
    const prev = effectiveMutedRef.current;
    // Things that became muted this frame.
    for (const id of mutedSlotIds) {
      if (!prev.has(id) && slotState[id]?.soundId) {
        setSlotMuted(id, true);
      }
    }
    // Things that became unmuted this frame (engine state matches
    // their slotState.muted flag — we only flip OFF the arrange-mute
    // overlay; if the slot is globally muted via state.muted it stays
    // silent because globalMuted is part of the set already).
    for (const id of prev) {
      if (!mutedSlotIds.has(id) && slotState[id]) {
        // Restore the slot's intended state: muted if globally
        // muted, otherwise live.
        setSlotMuted(id, !!slotState[id].muted);
      }
    }
    effectiveMutedRef.current = mutedSlotIds;
  }

  // Whether the player has been placed in the room. Initial state is
  // false — the room starts empty, the player's tile lives in the
  // palette like every other character. Picking the VOICE tile enters
  // placement mode (see pendingPlayer below); clicking the floor sets
  // playerPos and flips this to true. Clearing them from the popover
  // flips it back.
  const [playerPlaced, setPlayerPlaced] = useState(false);
  /** Iso position (% of the contained room square) the player + mic
   *  stand render at. Settable via placement mode — the mic follows
   *  wherever the player lands. */
  const [playerPos, setPlayerPos] = useState(DEFAULT_PLAYER_POS);
  /** True while the player tile has been picked but not yet placed —
   *  cursor carries the player sprite, click the room to drop. */
  const [pendingPlayer, setPendingPlayer] = useState(false);

  // ── Placement mode ──
  // When the player taps a character tile in the popup (instead of
  // dragging), we close the popup and enter placement mode. The
  // selected character "follows" the cursor as a translucent floating
  // sprite at room scale; clicking the room drops them at the cursor
  // position. Esc / clicking the + button cancels.
  const [pendingChar, setPendingChar] = useState<PlaceableChar | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Track cursor + pointerup while in placement mode (band character
  // OR player). Pointermove drives the cursor sprite; pointerup
  // handles the release-on-room drop so the entire pick + drop is a
  // single gesture (drag from tile to room). Releases on the popup,
  // top bar, or anywhere else are ignored — placement mode persists
  // so the user can also tap-then-click if they prefer.
  useEffect(() => {
    if (!pendingChar && !pendingPlayer) {
      setCursorPos(null);
      return;
    }
    const onMove = (e: PointerEvent) => {
      setCursorPos({ x: e.clientX, y: e.clientY });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPendingChar(null);
        setPendingPlayer(false);
      }
    };
    const onUp = (e: PointerEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const inStage = (
        e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.bottom
      );
      if (!inStage) return;
      // Ignore releases over the popup or onto an existing placed
      // character — we only place on empty floor.
      const t = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!t) return;
      if (t.closest('[role="dialog"][aria-label="characters"]')) return;
      if (t.closest("[data-slot-id]")) return;
      void placePendingAt(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup",   onUp);
    window.addEventListener("keydown",     onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup",   onUp);
      window.removeEventListener("keydown",     onKey);
    };
    // placePendingAt is closure-stable; we only re-run when pending
    // state flips so the listener has the latest closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingChar, pendingPlayer]);

  // Which slot has its control panel open (null = none).
  const [openControls, setOpenControls] = useState<string | null>(null);
  const [controlAnchor, setControlAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // Track which slot is being dragged-over for the cyan halo.
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Master play/pause state for the whole jam. Defaults to true (playing)
  // so the audio reacts the moment the first sound is dropped — same
  // behaviour as before, just now with an explicit toggle.
  const [playing, setPlaying] = useState(true);

  // ── Master BPM ──
  // Live-editable from the top-bar BPM control. Changing it propagates
  // immediately to the jam engine (recomputes every active player's
  // rate) AND to BandSlot's L↔R flip cadence. Vocal slots pin at
  // rate 1 in the engine.
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  function nudgeBpm(delta: number) {
    setBpm((cur) => {
      const next = Math.max(MIN_BPM, Math.min(MAX_BPM, cur + delta));
      setMasterBpm(next);
      return next;
    });
  }

  // Recording state — when truthy, an in-line record overlay covers the
  // stage with a 4-bar countdown. On finish, the buffer is handed off
  // to assignVocalSlot for that slot.
  const [recordingForSlot, setRecordingForSlot] = useState<string | null>(null);

  // ── Combo state ──
  // activeCombo = currently-applied combo (drives accessory + banner).
  // burstingCombo = a transient flag that fires the ComboBurst (confetti
  //   + flash) once and then self-clears. Separate from activeCombo so
  //   we don't re-burst on every slotState tweak while the same combo
  //   stays active.
  const [activeCombo,   setActiveCombo]   = useState<JamCombo | null>(null);
  const [burstingCombo, setBurstingCombo] = useState<JamCombo | null>(null);
  /** Increments each time a burst fires so the React key on ComboBurst
   *  changes — re-mount triggers a fresh confetti + flash animation. */
  const [burstSeq, setBurstSeq] = useState(0);

  /** Per-slot transient hype line. Cleared by a setTimeout when shown
   *  (handled in the speech-bubble effect below). Empty by default. */
  const [hypeLines, setHypeLines] = useState<Record<string, string | null>>({});

  // ── Combo discovery (Codex) ──
  // Persistence is localStorage so discoveries survive reloads. We
  // hydrate from storage on mount and rewrite on every new discovery.
  const [discoveredIds, setDiscoveredIds] = useState<Set<string>>(() => {
    try {
      const raw = window.localStorage.getItem(DISCOVERED_KEY);
      if (raw) return new Set<string>(JSON.parse(raw));
    } catch { /* ignore — corrupt or unavailable storage */ }
    return new Set();
  });
  const [codexOpen, setCodexOpen] = useState(false);

  // Stage container — used to compute control-panel anchor coords.
  const stageRef = useRef<HTMLDivElement>(null);

  // ── Room size (in px) ──
  // The Crib backdrop renders as a square contained inside the stage —
  // its edge length is min(stageW, stageH). We measure that here so we
  // can size the band sprites + player as a fraction of the room. This
  // is what makes the formation hold its shape across viewports: the
  // slot positions are already %-based, so scaling sprite size with the
  // room keeps the spacing-to-sprite ratio constant. Without this,
  // sprites stay 200 / 250 px on every screen and bleed into each other
  // on narrow viewports while looking tiny on wide ones.
  const [roomSize, setRoomSize] = useState(0);
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      setRoomSize(Math.min(el.clientWidth, el.clientHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Sprite size fractions — tuned against the slot positions so the
  // band reads as a tight band-photo line at any size without sprites
  // overlapping into illegibility. Player gets a slight bump (~26%) so
  // they read as the lead.
  const BAND_SPRITE_FRAC   = 0.22;
  const PLAYER_SPRITE_FRAC = 0.26;
  const bandSpriteSize   = Math.max(64,  Math.round(roomSize * BAND_SPRITE_FRAC));
  const playerSpriteSize = Math.max(80,  Math.round(roomSize * PLAYER_SPRITE_FRAC));

  // ── Floating "+" button position ──
  // Stored as % of the room overlay so it stays at the same room
  // location across viewports. Persisted to localStorage so the
  // player's preferred parking spot survives reloads. Default: anchored
  // to the left wall, vertically centered.
  const [charBtnPos, setCharBtnPos] = useState<{ x: number; y: number }>(() =>
    loadCharBtnPos(),
  );
  const charBtnDragRef = useRef({
    active:    false,
    moved:     false,        // crossed the click-vs-drag threshold?
    startX:    0,
    startY:    0,
    startPctX: 0,
    startPctY: 0,
  });

  // Map soundId → SoundOption for fast lookup.
  const soundsById = useMemo(() => {
    const m = new Map<string, SoundOption>();
    for (const s of REAL_SOUNDS) m.set(s.id, s);
    return m;
  }, []);

  /** Set of soundIds currently assigned to ANY slot — drives the
   *  "in use" ring on the palette tiles. */
  const assignedIds = useMemo(() => {
    const set = new Set<string>();
    for (const s of Object.values(slotState)) {
      if (s.soundId) set.add(s.soundId);
    }
    return set;
  }, [slotState]);

  // Stop everything when the player leaves the jam stage.
  useEffect(() => {
    return () => {
      clearAllSlots();
    };
  }, []);

  // ── Eager audio unlock (mobile fix) ──
  // Mobile browsers (Chrome / Safari / Firefox) require the
  // AudioContext to be resumed from inside a fresh user-gesture
  // event — not from an async chain triggered by a gesture. Our
  // placement flow is fine on desktop but on a phone the chain
  // goes pointerup → placePendingAt → handleRoomDrop → ensureAudio
  // and by the time the synchronous ctx.resume() runs the gesture
  // can be considered stale. Solution: on the first pointerdown /
  // touchstart anywhere in the document we call ensureAudio
  // synchronously inside the gesture and remove the listener. After
  // that the context stays running and every subsequent call lands
  // on an already-resumed AudioContext.
  useEffect(() => {
    let unlocked = false;
    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      // Fire-and-forget — ensureAudio's synchronous unlock runs
      // before the await Tone.start(), which is what matters for
      // the gesture-frame requirement.
      void ensureAudio();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart",  unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart",  unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart",  unlock);
    };
  }, []);

  // Combo detection — runs every time slotState changes. When the
  // detected combo flips to a NEW id, fire a burst and update the
  // active combo. When the combo de-activates (player breaks the
  // recipe), clear both. We compare by id so the same combo persisting
  // across unrelated slot changes doesn't retrigger the burst.
  useEffect(() => {
    const matched = detectCombo(slotState);
    if (matched?.id !== activeCombo?.id) {
      setActiveCombo(matched);
      if (matched) {
        setBurstingCombo(matched);
        setBurstSeq((n) => n + 1);
        // Combo sting — short triad stab, ducks under the mix.
        void playJamComboSting();
        // Mark the combo as discovered (idempotent) and persist.
        setDiscoveredIds((prev) => {
          if (prev.has(matched.id)) return prev;
          const next = new Set(prev);
          next.add(matched.id);
          try {
            window.localStorage.setItem(
              DISCOVERED_KEY,
              JSON.stringify(Array.from(next)),
            );
          } catch { /* ignore */ }
          return next;
        });
        // Combo activation also fires a hype line on every filled
        // band slot — every character celebrates simultaneously. The
        // player slot doesn't run hype lines (the lead lets the band
        // hype them).
        const next: Record<string, string | null> = {};
        for (const slotId of Object.keys(bandPlacements)) {
          const st = slotState[slotId];
          if (!st?.soundId) continue;
          // slotId === characterKind in the new model.
          const line = randomHypeForCharacter(slotId as CharacterKind);
          if (line) next[slotId] = line;
        }
        setHypeLines((prev) => ({ ...prev, ...next }));
        window.setTimeout(() => {
          setHypeLines((prev) => {
            const cleared: Record<string, string | null> = { ...prev };
            for (const id of Object.keys(next)) cleared[id] = null;
            return cleared;
          });
        }, 1800);
      }
    }
  }, [slotState, activeCombo?.id]);

  // ── Camera nudge on kick ──
  // Subtle 2–3 px translate applied to the stage container on every kick
  // hit. The brain reads it subliminally as "the room shifted with that"
  // even though the conscious eye misses it. Quiet when paused / empty.
  const cameraFrame = useJamAudioFrame();
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = stageRef.current;
      if (node) {
        const active = playing && assignedIds.size > 0;
        const k = active ? cameraFrame.current.kick : 0;
        // Slight downward bias on the punch so the camera "drops" into
        // the kick rather than just shimmering side-to-side.
        const dx = k * 2;
        const dy = k * 3;
        node.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cameraFrame, playing, assignedIds.size]);

  // ── Ambient hype lines ──
  // Every ~5–9 seconds while playing, a random filled + unmuted slot
  // pops a hype line from that character's pool. Clears itself after
  // ~1.7s (matches the HypeBubble animation). Reads the latest slot
  // state via a ref so the interval doesn't have to be torn down on
  // every state mutation.
  const slotStateRef = useRef(slotState);
  slotStateRef.current = slotState;
  const bandPlacementsRef = useRef(bandPlacements);
  bandPlacementsRef.current = bandPlacements;
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const current = slotStateRef.current;
      const placements = bandPlacementsRef.current;
      const filledIds = Object.keys(placements).filter((id) => {
        const st = current[id];
        return st?.soundId && !st.muted;
      });
      if (filledIds.length === 0) return;
      const id   = filledIds[Math.floor(Math.random() * filledIds.length)];
      // slotId === characterKind in the new model.
      const line = randomHypeForCharacter(id as CharacterKind);
      if (!line) return;
      setHypeLines((prev) => ({ ...prev, [id]: line }));
      window.setTimeout(() => {
        setHypeLines((prev) =>
          prev[id] === line ? { ...prev, [id]: null } : prev,
        );
      }, 1700);
    };
    const interval = window.setInterval(tick, 6500);
    return () => window.clearInterval(interval);
  }, [playing]);

  /** Picked a character from the popup (tap, no drag) — enter
   *  placement mode. The popup STAYS OPEN so the player can pick
   *  another character right after dropping the current one without
   *  re-opening the menu. Close it explicitly via the + button, X,
   *  or Esc when finished placing. */
  function handlePickCharacter(char: PlaceableChar) {
    setPendingChar(char);
  }

  /** Picked the player from the popup — enter placement mode. Same
   *  rule as handlePickCharacter: the popup stays open. */
  function handlePickPlayer() {
    setPendingPlayer(true);
  }

  /** Cancel placement mode — fired by Esc, by clicking the + button
   *  while pending, or by an outside click on the top bar. */
  function cancelPlacement() {
    setPendingChar(null);
    setPendingPlayer(false);
  }

  /** Place the pending character at the given client-space coords,
   *  translating into room %, snapping to grid. Handles both band
   *  characters and the player. */
  async function placePendingAt(clientX: number, clientY: number) {
    if (!pendingChar && !pendingPlayer) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect  = stage.getBoundingClientRect();
    const sq    = Math.min(rect.width, rect.height);
    const sqL   = rect.left + (rect.width  - sq) / 2;
    const sqT   = rect.top  + (rect.height - sq) / 2;
    const xPct  = ((clientX - sqL) / sq) * 100;
    const yPct  = ((clientY - sqT) / sq) * 100;

    if (pendingPlayer) {
      setPlayerPos(clampPos(xPct, yPct));
      setPlayerPlaced(true);
      setPendingPlayer(false);
      // Auto-open the recorder so the user doesn't have to tap the
      // just-placed player to start recording — the placement IS the
      // request to record.
      setRecordingForSlot(PLAYER_SLOT_ID);
      return;
    }
    if (pendingChar) {
      setPendingChar(null);
      await handleRoomDrop(pendingChar.soundId, xPct, yPct);
    }
  }

  /** Player-slot drop — only accepts the VOCAL_DROP_ID sentinel. Other
   *  drops are silently rejected. Used by PlayerAtMic only. */
  function handlePlayerDrop(soundId: string) {
    setDragOverSlot(null);
    if (soundId !== VOCAL_DROP_ID) return;
    setRecordingForSlot(PLAYER_SLOT_ID);
  }

  /** Room drop — a character was picked / dropped at some point on
   *  the floor. The slotId is the characterKind ("drum-guy" / etc.):
   *  one band slot per kind, the assigned soundId lives inside the
   *  placement. Cycling sounds in the popover updates the soundId
   *  without changing the slot key. */
  async function handleRoomDrop(soundId: string, xPct: number, yPct: number) {
    const placeable = getPlaceable(soundId);
    if (!placeable) return;
    const slotId  = placeable.characterKind;
    const dropped = clampPos(xPct, yPct);

    setBandPlacements((prev) => ({
      ...prev,
      [slotId]: { soundId, pos: dropped },
    }));
    setSlotState((prev) => ({
      ...prev,
      [slotId]: { soundId, muted: false, volume: 1.0, syncToBpm: false },
    }));

    try { await ensureAudio(); } catch { /* ignore */ }
    await assignSlot(slotId, soundId, bpm);
    if (!playing) {
      resumeJam();
      setPlaying(true);
    }
    // Popup stays open after a drop — the player can keep placing
    // characters without re-opening the menu each time. The + button
    // / X / Esc closes it.
  }

  // ── Dirty tracking ──
  // Flip to true whenever the jam state changes from its last-saved
  // baseline. The first render is skipped via a ref so a freshly-
  // mounted JamView isn't immediately "dirty". commitSave / handleLoadJam
  // both reset this flag.
  const firstDirtyRenderRef = useRef(true);
  useEffect(() => {
    if (firstDirtyRenderRef.current) {
      firstDirtyRenderRef.current = false;
      return;
    }
    setDirty(true);
  }, [bandPlacements, slotState, arrangeMutes, playerPlaced, playerPos, bpm]);

  // ── Arrange-derived song length ──
  // Sum the bars of every section the player has unlocked, then turn
  // that into seconds at the current BPM. This is the duration of one
  // "recording pass" when the arrange feature is unlocked.
  const arrangeUnlocked  = totalXP >= ARRANGE_UNLOCK_XP;
  const unlockedSongBars = ARRANGE_SECTIONS.reduce((n, s) =>
    (s.baseUnlocked || totalXP >= s.xpRequired) ? n + s.bars : n,
    0,
  );
  const songDurationSec  = unlockedSongBars > 0
    ? (unlockedSongBars * 4) / (bpm / 60)
    : 0;

  /** Build a JamSong-shaped snapshot of the current jam state for
   *  saving / passing to the store. Vocal buffer is captured by ref
   *  alongside (not JSON-serializable). */
  function snapshotForSave(name: string): Omit<JamSong, "id" | "createdAt"> {
    const placements: Record<string, JamPlacementSnapshot> = {};
    for (const [slotId, p] of Object.entries(bandPlacements)) {
      if (!p) continue;
      placements[slotId] = {
        characterKind: slotId as CharacterKind,
        soundId:       p.soundId,
        pos:           p.pos,
      };
    }
    const slots: Record<string, JamSlotSnapshot> = {};
    for (const [slotId, st] of Object.entries(slotState)) {
      if (!st.soundId && slotId !== PLAYER_SLOT_ID) continue;
      slots[slotId] = {
        soundId:        st.soundId,
        muted:          st.muted,
        volume:         st.volume,
        syncToBpm:      st.syncToBpm,
        autotunePitch:  st.autotunePitch,
        autotuneEffect: st.autotuneEffect,
      };
    }
    return {
      name,
      bpm,
      placements,
      slots,
      playerPlaced,
      playerPos,
      arrangeMutes,
      vocalBuffer: vocalBufferRef.current ?? undefined,
    };
  }

  /** Commit a save with the given (player-typed) name and reset the
   *  dirty flag so the back-prompt doesn't trigger again. */
  function commitSave(name: string) {
    saveJam(snapshotForSave(name));
    setDirty(false);
  }

  /** Start a recording pass. With the arrange feature unlocked, this
   *  seeks the transport back to bar 0 and watches the elapsed time;
   *  once a full song length has played, we capture the snapshot and
   *  open the name prompt. Without the arrange feature, we skip the
   *  pass and open the prompt instantly (the underlying loop already
   *  represents a single 'verse' worth of song). */
  function startRecordingPass() {
    if (saveDialog) return;     // a save is already in flight
    if (!arrangeUnlocked) {
      setSaveDialog({ nameDraft: "", exitAfter: false });
      return;
    }
    if (songDurationSec <= 0) {
      setSaveDialog({ nameDraft: "", exitAfter: false });
      return;
    }
    // Reset the playhead so the recording pass starts at the song's
    // beginning. We can't easily restart the underlying audio loops,
    // so this is a visual + accounting reset — the song character
    // remains the same.
    Tone.getTransport().seconds = 0;
    setRecordingPass({
      startedAtSec: Tone.getTransport().seconds,
      durationSec:  songDurationSec,
    });
  }
  /** Cancel an in-flight recording pass without saving. */
  function cancelRecordingPass() {
    setRecordingPass(null);
  }

  // Watcher — once the in-flight recording pass reaches its duration,
  // open the save dialog and clear the pass.
  useEffect(() => {
    if (!recordingPass) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (cancelled) return;
      const elapsed = Tone.getTransport().seconds - recordingPass.startedAtSec;
      if (elapsed >= recordingPass.durationSec) {
        setRecordingPass(null);
        setSaveDialog({ nameDraft: "", exitAfter: false });
      }
    }, 80);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [recordingPass]);

  /** Load a saved jam back into the stage — tears down the current
   *  audio chain, rebuilds it from the snapshot, restores every bit
   *  of state. Caller closes the library overlay separately. */
  async function handleLoadJam(song: JamSong) {
    // Tear down existing audio.
    clearAllSlots();

    // Restore positions + slot state synchronously so React renders
    // the right characters / playerAtMic immediately.
    const placements: Partial<Record<CharacterKind, { soundId: string; pos: { x: number; y: number } }>> = {};
    for (const [slotId, p] of Object.entries(song.placements)) {
      placements[slotId as CharacterKind] = { soundId: p.soundId, pos: p.pos };
    }
    setBandPlacements(placements);

    const nextSlotState: Record<string, SlotState> = {
      [PLAYER_SLOT_ID]: { ...EMPTY_SLOT },
    };
    for (const [slotId, snap] of Object.entries(song.slots)) {
      nextSlotState[slotId] = {
        soundId:        snap.soundId,
        muted:          snap.muted,
        volume:         snap.volume,
        syncToBpm:      snap.syncToBpm,
        autotunePitch:  snap.autotunePitch,
        autotuneEffect: snap.autotuneEffect,
      };
    }
    setSlotState(nextSlotState);
    setPlayerPlaced(song.playerPlaced);
    setPlayerPos(song.playerPos);
    setArrangeMutes(song.arrangeMutes);
    setBpm(song.bpm);
    setMasterBpm(song.bpm);

    // Rebuild audio. Band slots first.
    try { await ensureAudio(); } catch { /* ignore */ }
    for (const [slotId, p] of Object.entries(song.placements)) {
      try { await assignSlot(slotId, p.soundId, song.bpm); } catch { /* ignore */ }
    }
    // Player slot — needs the vocal buffer, which only survives the
    // current session (see jamSongs.ts). If a saved jam came back
    // from localStorage without a vocal buffer attached, we still
    // restore the visual at the mic but the slot stays silent.
    if (song.playerPlaced && song.vocalBuffer) {
      vocalBufferRef.current = song.vocalBuffer;
      try { await assignVocalSlot(PLAYER_SLOT_ID, song.vocalBuffer, song.bpm); } catch { /* ignore */ }
      const sp = song.slots[PLAYER_SLOT_ID];
      if (sp) {
        setVocalAutotune(PLAYER_SLOT_ID, {
          pitch:  sp.autotunePitch  ?? 0,
          effect: sp.autotuneEffect ?? 0.5,
        });
        if (sp.muted)     setSlotMuted(PLAYER_SLOT_ID, true);
        if (sp.volume !== 1.0) setSlotVolume(PLAYER_SLOT_ID, sp.volume);
        setVocalSync(PLAYER_SLOT_ID, sp.syncToBpm, song.bpm);
      }
    }
    // Apply mute/volume on band slots after they're assigned.
    for (const [slotId, snap] of Object.entries(song.slots)) {
      if (slotId === PLAYER_SLOT_ID) continue;
      if (snap.muted)        setSlotMuted(slotId, true);
      if (snap.volume !== 1) setSlotVolume(slotId, snap.volume);
    }

    setLibraryOpen(false);
    setDirty(false);
    firstDirtyRenderRef.current = true;   // skip the next dirty fire
  }

  /** Drag-to-reposition. Fired by BandSlot when a placed character
   *  is dragged past the threshold and released. The audio bus
   *  doesn't need to be touched — only the iso position changes.
   *  Snap to the same grid the palette drops use. */
  function handleSlotMove(slotId: string, clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect  = stage.getBoundingClientRect();
    const sq    = Math.min(rect.width, rect.height);
    const sqL   = rect.left + (rect.width  - sq) / 2;
    const sqT   = rect.top  + (rect.height - sq) / 2;
    const xPct  = ((clientX - sqL) / sq) * 100;
    const yPct  = ((clientY - sqT) / sq) * 100;
    const dropped = clampPos(xPct, yPct);
    setBandPlacements((prev) => {
      const cur = prev[slotId as CharacterKind];
      if (!cur) return prev;
      return { ...prev, [slotId]: { ...cur, pos: dropped } };
    });
  }

  /** Drag-to-reposition for the player slot. Same translation logic;
   *  updates the standalone `playerPos` state used by StageSpot and
   *  PlayerAtMic. */
  function handlePlayerMove(clientX: number, clientY: number) {
    const stage = stageRef.current;
    if (!stage) return;
    const rect  = stage.getBoundingClientRect();
    const sq    = Math.min(rect.width, rect.height);
    const sqL   = rect.left + (rect.width  - sq) / 2;
    const sqT   = rect.top  + (rect.height - sq) / 2;
    const xPct  = ((clientX - sqL) / sq) * 100;
    const yPct  = ((clientY - sqT) / sq) * 100;
    setPlayerPos(clampPos(xPct, yPct));
  }

  /** Cycle the sound on a placed band character (called from the
   *  CharacterControls popover). slotId is a characterKind. The skin
   *  refreshes automatically because BandSlot reads soundId from
   *  state. The audio engine swaps the bus in place. */
  async function handleSwapSound(slotId: string, newSoundId: string) {
    const cur = bandPlacements[slotId as CharacterKind];
    if (!cur) return;
    if (cur.soundId === newSoundId) return;

    setBandPlacements((prev) => ({
      ...prev,
      [slotId]: { soundId: newSoundId, pos: cur.pos },
    }));
    setSlotState((prev) => {
      const prevState = prev[slotId];
      if (!prevState) return prev;
      return {
        ...prev,
        [slotId]: { ...prevState, soundId: newSoundId },
      };
    });

    try { await ensureAudio(); } catch { /* ignore */ }
    await assignSlot(slotId, newSoundId, bpm);
  }

  /** Master play/pause — toggles every slot at once via the engine. */
  function handleTogglePlay() {
    if (playing) {
      pauseJam();
      setPlaying(false);
    } else {
      resumeJam();
      setPlaying(true);
    }
  }

  /**
   * Vocal recording finished — hand the buffer to the engine, mark the
   * slot as filled with the vocal sentinel id, close the overlay.
   */
  async function handleVocalRecorded(slotId: string, buffer: AudioBuffer) {
    // Stash the buffer in a ref so saved jams can capture it without
    // having to round-trip through slotState (AudioBuffer isn't JSON).
    vocalBufferRef.current = buffer;
    setSlotState((prev) => ({
      ...prev,
      // syncToBpm: false — fresh recordings start unsynced; the player
      // can flip the toggle in the popover to lock the vocal to the
      // master BPM if they want.
      [slotId]: {
        soundId:        VOCAL_DROP_ID,
        muted:          false,
        volume:         1.0,
        syncToBpm:      false,
        autotunePitch:  VOCAL_AUTOTUNE_DEFAULT_PITCH,
        autotuneEffect: VOCAL_AUTOTUNE_DEFAULT_EFFECT,
      },
    }));
    setRecordingForSlot(null);
    await assignVocalSlot(slotId, buffer, bpm);
    // The defaults baked into Tone.PitchShift / Tone.Chorus already
    // match VOCAL_AUTOTUNE_DEFAULT_*, so no extra setVocalAutotune
    // call needed here.
    if (!playing) {
      resumeJam();
      setPlaying(true);
    }
  }

  /** Update the autotune params on the player's vocal slot. Persists
   *  the values in slotState so the popover sliders stay in sync, and
   *  pushes the new params to the audio engine so the sound updates
   *  in real time. */
  function handleAutotuneChange(
    slotId: string,
    params: { pitch?: number; effect?: number },
  ) {
    setSlotState((prev) => {
      const cur = prev[slotId];
      if (!cur) return prev;
      return {
        ...prev,
        [slotId]: {
          ...cur,
          ...(typeof params.pitch  === "number" ? { autotunePitch:  params.pitch  } : {}),
          ...(typeof params.effect === "number" ? { autotuneEffect: params.effect } : {}),
        },
      };
    });
    setVocalAutotune(slotId, params);
  }

  function handleSlotTap(slotId: string) {
    if (!stageRef.current) return;
    const slotEl = stageRef.current.querySelector(`[data-slot-id="${slotId}"]`) as HTMLElement | null;
    if (!slotEl) return;
    // Viewport coordinates — CharacterControls renders via portal at
    // position: fixed and clamps itself into the visible window, so
    // anchors close to the room edges still get a fully-visible
    // popover.
    const slotRect  = slotEl.getBoundingClientRect();
    setControlAnchor({
      left: slotRect.left + slotRect.width / 2,
      top:  slotRect.top,
    });
    setOpenControls(slotId);
  }

  function handleMuteToggle(slotId: string) {
    setSlotState((prev) => {
      const next = { ...prev[slotId], muted: !prev[slotId].muted };
      setSlotMuted(slotId, next.muted);
      return { ...prev, [slotId]: next };
    });
  }

  function handleVolume(slotId: string, v: number) {
    setSlotState((prev) => {
      const next = { ...prev[slotId], volume: v };
      setSlotVolume(slotId, v);
      return { ...prev, [slotId]: next };
    });
  }

  function handleClear(slotId: string) {
    clearSlot(slotId);
    if (slotId === PLAYER_SLOT_ID) {
      // Player slot is removed from the room entirely. Tile re-opens
      // in the palette so the player can summon them back later.
      setSlotState((prev) => ({ ...prev, [slotId]: { ...EMPTY_SLOT } }));
      setPlayerPlaced(false);
    } else {
      // Band placements vanish from the floor — both the audio bus and
      // the iso position are dropped, freeing the soundId tile in the
      // popup.
      setSlotState((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setBandPlacements((prev) => {
        const next = { ...prev };
        delete next[slotId as CharacterKind];
        return next;
      });
    }
    setOpenControls(null);
  }

  /** Toggle vocal-slot sync to master BPM. No-op for non-vocal slots. */
  function handleSyncToggle(slotId: string) {
    setSlotState((prev) => {
      const cur  = prev[slotId];
      if (!cur) return prev;
      const next = { ...cur, syncToBpm: !cur.syncToBpm };
      // Engine-side: flip nativeBpm between recordedBpm and null and
      // immediately rewrite the player's playbackRate.
      setVocalSync(slotId, next.syncToBpm, bpm);
      return { ...prev, [slotId]: next };
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0f1c",
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Top bar — quit + title + BPM */}
      <div
        style={{
          flexShrink: 0,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(180deg, rgba(15, 24, 40, 0.95) 0%, rgba(15, 24, 40, 0.6) 100%)",
          borderBottom: "2px solid rgba(0, 0, 0, 0.6)",
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            // Unsaved work? Prompt to save before leaving. Save
            // dialog's exitAfter flag triggers the actual exit once
            // the player commits or discards.
            if (dirty && (Object.keys(bandPlacements).length > 0 || playerPlaced)) {
              setSaveDialog({ nameDraft: "", exitAfter: true });
              return;
            }
            clearAllSlots();
            setStage("home");
          }}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ← back
        </button>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 18,
            color: "#fff",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(0,0,0,0.5)",
          }}
        >
          🎛️ JAM <span style={{ color: C.coral }}>STUDIO</span>
        </div>
        <div style={{ flex: 1 }} />

        {/* Codex button — opens the combo discovery panel. Subtle pip
         *  reads as "you found one" when discoveredIds is non-empty. */}
        <button
          onClick={() => setCodexOpen(true)}
          aria-label="open combo codex"
          style={{
            position: "relative",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ★ codex {discoveredIds.size}/{COMBOS.length}
        </button>

        {/* RECORD button — saves the current jam as a cassette. With
         *  the arrange feature unlocked it kicks off a recording
         *  pass (playhead sweeps once, then prompts a save). Without,
         *  it pops the save prompt instantly. Disabled when nothing
         *  is placed yet. Press again while recording to cancel. */}
        <button
          onClick={() => {
            if (recordingPass) {
              cancelRecordingPass();
              return;
            }
            // Need at least one character (band OR player) to save.
            if (Object.keys(bandPlacements).length === 0 && !playerPlaced) return;
            startRecordingPass();
          }}
          disabled={
            !recordingPass &&
            Object.keys(bandPlacements).length === 0 &&
            !playerPlaced
          }
          aria-label={recordingPass ? "cancel recording" : "record this jam"}
          title={recordingPass ? "tap to cancel" : "record this jam to a cassette"}
          style={{
            padding: "6px 14px",
            borderRadius: 999,
            border: "2px solid #0a0f1c",
            background: recordingPass
              ? "linear-gradient(180deg, #ff7a8e, #b8253a)"
              : "linear-gradient(180deg, #c084fc, #7e22ce)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            letterSpacing: 0.6,
            cursor:
              !recordingPass &&
              Object.keys(bandPlacements).length === 0 &&
              !playerPlaced
                ? "not-allowed"
                : "pointer",
            opacity:
              !recordingPass &&
              Object.keys(bandPlacements).length === 0 &&
              !playerPlaced
                ? 0.4
                : 1,
            boxShadow: recordingPass
              ? "inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(0,0,0,0.45), 0 0 18px rgba(233, 69, 96, 0.7)"
              : "inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(0,0,0,0.45), 0 0 14px rgba(192, 132, 252, 0.5)",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {recordingPass ? (
            <>
              <span
                style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 0 8px rgba(255,255,255,0.9)",
                  animation: "recDot 0.9s ease-in-out infinite",
                }}
              />
              RECORDING…
            </>
          ) : (
            <>● RECORD</>
          )}
        </button>

        {/* Master play / pause — controls every assigned slot at once.
         *  Disabled until at least one slot is filled so it doesn't
         *  look interactive when there's nothing to play. */}
        <button
          onClick={handleTogglePlay}
          disabled={assignedIds.size === 0}
          aria-label={playing ? "pause" : "play"}
          style={{
            width: 44, height: 44,
            borderRadius: "50%",
            border: "2.5px solid #0a0f1c",
            background: playing
              ? "linear-gradient(180deg, #ff7a8e, #b8253a)"
              : "linear-gradient(180deg, #6bf395, #16a34a)",
            color: "#fff",
            fontSize: 18,
            display: "grid",
            placeItems: "center",
            cursor: assignedIds.size === 0 ? "not-allowed" : "pointer",
            opacity: assignedIds.size === 0 ? 0.4 : 1,
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.45), 0 0 18px " +
              (playing ? "rgba(233,69,96,0.4)" : "rgba(74,222,128,0.4)"),
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>

        {/* Live BPM control — − / number / +. Click to nudge by 1,
         *  hold to repeat for fast dial-in. Pushes through to
         *  setMasterBpm() which updates Tone.Transport AND every
         *  active player's playbackRate, so the music tempo follows
         *  in real time (pitch shifts with rate; standard DAW
         *  behaviour without time-stretching). */}
        <BpmControl bpm={bpm} onNudge={nudgeBpm} />
      </div>

      {/* Main area — full-width stage. The character roster lives in
       *  the floating CharacterPalette popup (toggled via the on-stage
       *  "+" button), not a sidebar. */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Stage */}
        <div
          ref={stageRef}
          // Room-level drop target — accepts character tiles dragged
          // from CharacterPalette (HTML5 drag flow) and places them at
          // the cursor position.
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes(PLACE_CHAR_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(e) => {
            const id = e.dataTransfer.getData(PLACE_CHAR_MIME);
            if (!id) return;
            e.preventDefault();
            const stage = stageRef.current;
            if (!stage) return;
            const rect = stage.getBoundingClientRect();
            // Crib contains the image as a square at min(w, h),
            // centered. Convert clientX/Y to %-of-the-square so dropped
            // positions match the same coord space the slots use.
            const sq    = Math.min(rect.width, rect.height);
            const sqL   = rect.left + (rect.width  - sq) / 2;
            const sqT   = rect.top  + (rect.height - sq) / 2;
            const xPct  = ((e.clientX - sqL) / sq) * 100;
            const yPct  = ((e.clientY - sqT) / sq) * 100;
            void handleRoomDrop(id, xPct, yPct);
          }}
          // Click-to-place — fires when the player has tapped a tile
          // (band character OR player) and then clicks the room.
          // Right-click cancels placement so the user has a quick
          // out without hunting for the + button or Esc.
          onClick={(e) => {
            if (!pendingChar && !pendingPlayer) return;
            // Don't place when the click originated on a placed
            // character (those have their own handlers — tap = mute).
            const target = e.target as HTMLElement;
            if (target.closest("[data-slot-id]")) return;
            void placePendingAt(e.clientX, e.clientY);
          }}
          onContextMenu={(e) => {
            if (pendingChar || pendingPlayer) {
              e.preventDefault();
              cancelPlacement();
            }
          }}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            cursor: pendingChar || pendingPlayer ? "crosshair" : "default",
          }}
        >
          {/* Crib backdrop — pre-rendered iso room PNG, contained inside
           *  the stage area so the whole room is visible regardless of
           *  viewport aspect (dark bars fill the leftover space). The
           *  Crib also provides a child-overlay box that matches the
           *  rendered image bounds, so the iso character positions
           *  below stay locked to the floor when the viewport changes. */}
          <Crib>
            {/* Per-placed-character stage spots — soft circular spotlights
             *  on the floor under each character, brightening with audio. */}
            {Object.entries(bandPlacements).map(([slotId, placement]) => {
              if (!placement) return null;
              const state = slotState[slotId];
              return (
                <StageSpot
                  key={`spot-${slotId}`}
                  pos={placement.pos}
                  active={playing && !!state?.soundId && !state.muted}
                />
              );
            })}
            {/* Player spot — gold accent + larger so the lead reads as
             *  the star even when the band is hot. Only rendered after
             *  the player is summoned from the palette. */}
            {playerPlaced && (
              <StageSpot
                pos={playerPos}
                active={playing && !!slotState[PLAYER_SLOT_ID].soundId && !slotState[PLAYER_SLOT_ID].muted}
                size="large"
                accent="#facc15"
              />
            )}

            {/* Band — sprite-based, free-place. Each entry in
             *  bandPlacements becomes a BandSlot at its iso position.
             *  slotId === characterKind for band slots. */}
            {Object.entries(bandPlacements).map(([slotId, placement]) => {
              if (!placement) return null;
              const state = slotState[slotId];
              const sound = state?.soundId
                ? soundsById.get(state.soundId) ?? null
                : null;
              if (!state) return null;
              return (
                <div
                  key={slotId}
                  style={{
                    position: "absolute",
                    left: `${placement.pos.x}%`,
                    top:  `${placement.pos.y}%`,
                    // Anchor the sprite's feet at (x, y).
                    transform: "translate(-50%, -100%)",
                    zIndex: 4,
                  }}
                  data-slot-id={slotId}
                >
                  <BandSlot
                    slotId={slotId}
                    characterKind={slotId as CharacterKind}
                    // Free-place model has no acceptKind gate — drops
                    // happen at the room level, not on the slot. Pass
                    // the character's own kind so any drop into the
                    // slot's bounds is just rerouted up.
                    acceptKind={"drums"}
                    sound={sound}
                    muted={state.muted}
                    volume={state.volume}
                    playing={playing}
                    bpm={bpm}
                    hypeLine={hypeLines[slotId] ?? null}
                    size={bandSpriteSize}
                    // Drops on the slot are uncommon now (the room
                    // catches them), but if one slips through we
                    // re-route to the room handler at the slot's pos.
                    onDropSound={() => { /* no-op: room-level drop */ }}
                    onTap={() => state.soundId && handleMuteToggle(slotId)}
                    onLongPress={() => state.soundId && handleSlotTap(slotId)}
                    onMove={(x, y) => handleSlotMove(slotId, x, y)}
                    dragOver={false}
                    onDragEnter={() => { /* no-op */ }}
                    onDragLeave={() => { /* no-op */ }}
                  />
                </div>
              );
            })}

            {/* Player + mic stand. Only rendered after the player is
             *  summoned from the palette. Drop a vocal recording here
             *  (the existing recorder flow); other dropped sounds are
             *  silently rejected. */}
            {playerPlaced && (
              <div
                style={{
                  position: "absolute",
                  left: `${playerPos.x}%`,
                  top:  `${playerPos.y}%`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 5,
                }}
                data-slot-id={PLAYER_SLOT_ID}
              >
                <PlayerAtMic
                  active={playing}
                  filled={!!slotState[PLAYER_SLOT_ID].soundId}
                  muted={slotState[PLAYER_SLOT_ID].muted}
                  dragOver={dragOverSlot === PLAYER_SLOT_ID}
                  size={playerSpriteSize}
                  onDropSound={handlePlayerDrop}
                  onDragEnter={() => setDragOverSlot(PLAYER_SLOT_ID)}
                  onDragLeave={() => setDragOverSlot((s) => (s === PLAYER_SLOT_ID ? null : s))}
                  onTap={() => {
                    // Empty player → open the recorder; filled → mute toggle.
                    if (slotState[PLAYER_SLOT_ID].soundId) {
                      handleMuteToggle(PLAYER_SLOT_ID);
                    } else {
                      setRecordingForSlot(PLAYER_SLOT_ID);
                    }
                  }}
                  onLongPress={() => {
                    // Empty player → open the recorder; filled → controls popover.
                    if (slotState[PLAYER_SLOT_ID].soundId) {
                      handleSlotTap(PLAYER_SLOT_ID);
                    } else {
                      setRecordingForSlot(PLAYER_SLOT_ID);
                    }
                  }}
                  onMove={handlePlayerMove}
                />
              </div>
            )}

            {/* Cassette rack — clickable room furniture that opens
             *  the saved-jam library. Sized as a fraction of the room
             *  so it scales with the viewport just like the band
             *  characters. */}
            <CassetteRack
              // Floor spot in the back-left area, right below the
              // pink-framed canvas leaning on the wall. iso pos is %
              // of the room-square so the rack stays in the same
              // visual spot at any viewport size; size scales with
              // roomSize so it shrinks/grows in lockstep with the
              // characters when the room shrinks on mobile.
              pos={{ x: 50, y: 45 }}
              size={Math.max(60, Math.round(roomSize * 0.175))}
              jamCount={jamSongs.length}
              onClick={() => setLibraryOpen(true)}
            />

            {/* Floating "characters" button — draggable, persists to
             *  localStorage. Tap to toggle the popup; if placement
             *  mode is active, tap to cancel instead. Drag (>5 px) to
             *  reposition; the new spot is saved on pointer-up. */}
            <button
              onPointerDown={(e) => {
                charBtnDragRef.current = {
                  active:    true,
                  moved:     false,
                  startX:    e.clientX,
                  startY:    e.clientY,
                  startPctX: charBtnPos.x,
                  startPctY: charBtnPos.y,
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                const ref = charBtnDragRef.current;
                if (!ref.active) return;
                const dx = e.clientX - ref.startX;
                const dy = e.clientY - ref.startY;
                if (!ref.moved && Math.hypot(dx, dy) <= 5) return;
                ref.moved = true;
                // Translate the pixel delta into a %-of-room delta so
                // the button stays where the player drags it
                // regardless of viewport size.
                const stage = stageRef.current;
                if (!stage) return;
                const rect = stage.getBoundingClientRect();
                const sq = Math.min(rect.width, rect.height);
                if (sq <= 0) return;
                const dxPct = (dx / sq) * 100;
                const dyPct = (dy / sq) * 100;
                setCharBtnPos(
                  clampBtnPos({
                    x: ref.startPctX + dxPct,
                    y: ref.startPctY + dyPct,
                  }),
                );
              }}
              onPointerUp={(e) => {
                const wasDrag = charBtnDragRef.current.moved;
                charBtnDragRef.current.active = false;
                try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                if (wasDrag) {
                  saveCharBtnPos(charBtnPos);
                  return;
                }
                // Treated as a tap.
                if (pendingChar || pendingPlayer) {
                  cancelPlacement();
                  return;
                }
                setPaletteOpen((v) => !v);
              }}
              onContextMenu={(e) => e.preventDefault()}
              aria-label={
                pendingChar || pendingPlayer
                  ? "cancel placement"
                  : paletteOpen
                    ? "close characters"
                    : "open characters · drag to move"
              }
              title={
                pendingChar || pendingPlayer
                  ? "cancel placement"
                  : "tap to open · drag to move"
              }
              style={{
                position: "absolute",
                left: `${charBtnPos.x}%`,
                top:  `${charBtnPos.y}%`,
                transform: "translate(-50%, -50%)",
                zIndex: 6,
                width: 64,
                height: 64,
                borderRadius: 32,
                border: "3px solid #0a0f1c",
                background: pendingChar || pendingPlayer
                  ? "linear-gradient(180deg, #f4d35e, #b8881a)"
                  : paletteOpen
                    ? "linear-gradient(180deg, #f4d35e, #b8881a)"
                    : "linear-gradient(180deg, #ff7a8e, #b8253a)",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 32,
                lineHeight: 1,
                cursor: charBtnDragRef.current.active && charBtnDragRef.current.moved
                  ? "grabbing"
                  : "grab",
                touchAction: "none",
                userSelect: "none",
                boxShadow:
                  "inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.3), 0 6px 0 rgba(0,0,0,0.5), 0 0 22px rgba(233,69,96,0.55)",
                animation:
                  Object.keys(bandPlacements).length === 0 && !playerPlaced && !pendingChar && !pendingPlayer && !paletteOpen
                    ? "jamCharBtnPulse 2.4s ease-in-out infinite"
                    : "none",
              }}
            >
              {pendingChar || pendingPlayer ? "✕" : paletteOpen ? "✕" : "+"}
            </button>

            {/* ── Arrange timeline ──
             *  Floats over the bottom of the room (rendered inside
             *  Crib's overlay so its % anchors map to the room-square).
             *  XP-gated: panel mounts only when the player has earned
             *  ARRANGE_UNLOCK_XP. Inside, individual sections
             *  (INTRO / BRIDGE / OUTRO) have their own XP thresholds
             *  and render as dashed locked-out placeholders until met.
             */}
            {totalXP >= ARRANGE_UNLOCK_XP && (() => {
              const rows: ArrangeRow[] = [];
              for (const [slotId, placement] of Object.entries(bandPlacements)) {
                if (!placement) continue;
                const state = slotState[slotId];
                if (!state?.soundId) continue;
                const placeable = getPlaceable(state.soundId);
                const name      = placeable?.name ?? state.soundId.toUpperCase();
                const kind      = slotId as CharacterKind;
                rows.push({
                  slotId,
                  name,
                  iconSrc:     characterIconFor(kind, state.soundId),
                  globalMuted: state.muted,
                  accent:      ARRANGE_ACCENT[kind],
                });
              }
              const playerRow = playerArrangeRow({
                slotId:      PLAYER_SLOT_ID,
                globalMuted: slotState[PLAYER_SLOT_ID].muted,
                filled:      !!slotState[PLAYER_SLOT_ID].soundId,
              });
              if (playerRow) rows.push(playerRow);

              if (rows.length === 0) return null;
              return (
                <JamArrange
                  rows={rows}
                  bpm={bpm}
                  totalXP={totalXP}
                  arrangeMutes={arrangeMutes}
                  onToggleSectionMute={toggleArrangeMute}
                  onApplyEffectiveMutes={applyEffectiveMutes}
                />
              );
            })()}
          </Crib>

          {/* Empty-state hint removed — the floating + button pulses
           *  while the room is empty, which is enough of a cue. */}


          {/* Combo banner — drops in from the top while a combo is active.
           *  Keyed on the combo id so a transition to a different combo
           *  retriggers the entrance animation. */}
          {activeCombo && (
            <ComboBanner key={activeCombo.id} combo={activeCombo} />
          )}

          {/* Combo burst — confetti + flash one-shot. Self-clears via
           *  onDone after ~1.4s. Keyed on combo id so consecutive distinct
           *  combos each get their own burst. */}
          {burstingCombo && (
            <ComboBurst
              key={burstingCombo.id + ":" + burstSeq}
              combo={burstingCombo}
              onDone={() => setBurstingCombo(null)}
            />
          )}

          {/* Per-character control popover */}
          {openControls && (() => {
            const state = slotState[openControls];
            const sound = state?.soundId === VOCAL_DROP_ID
              ? VOCAL_PSEUDO_SOUND
              : (state?.soundId ? soundsById.get(state.soundId) ?? null : null);

            // Build the sibling list for the sound cycler — every
            // PlaceableChar that shares this band slot's character
            // kind. For the player slot openControls === PLAYER_SLOT_ID,
            // which has no PlaceableChar entries, so the cycler is
            // hidden automatically.
            const siblings = openControls !== PLAYER_SLOT_ID
              ? PLACEABLE_CHARS
                  .filter((c) => c.characterKind === openControls)
                  .map((c) => ({
                    soundId: c.soundId,
                    name:    c.name.toLowerCase(),
                    iconSrc: c.iconSrc,
                  }))
              : undefined;

            return (
              <CharacterControls
                sound={sound}
                muted={state.muted}
                volume={state.volume}
                syncToBpm={state.syncToBpm}
                anchorLeft={controlAnchor.left}
                anchorTop={controlAnchor.top}
                siblings={siblings}
                currentSoundId={state.soundId ?? undefined}
                onSwap={(sid) => handleSwapSound(openControls, sid)}
                autotunePitch={state.autotunePitch}
                autotuneEffect={state.autotuneEffect}
                onAutotuneChange={(p) => handleAutotuneChange(openControls, p)}
                onMuteToggle={() => handleMuteToggle(openControls)}
                onVolume={(v) => handleVolume(openControls, v)}
                onSyncToggle={() => handleSyncToggle(openControls)}
                onClear={() => handleClear(openControls)}
                onClose={() => setOpenControls(null)}
              />
            );
          })()}

        </div>
      </div>

      {/* Mic recording overlay — covers the whole stage while the user
       *  records 4 bars at the master BPM. On finish, the buffer is
       *  handed off to the slot via assignVocalSlot. */}
      {recordingForSlot && (
        <VocalRecordingOverlay
          bpm={bpm}
          onCancel={() => setRecordingForSlot(null)}
          onRecorded={(buffer) => handleVocalRecorded(recordingForSlot, buffer)}
        />
      )}

      {/* Combo Codex — slide-out discovery tracker */}
      {codexOpen && (
        <ComboCodex
          discoveredIds={discoveredIds}
          onClose={() => setCodexOpen(false)}
        />
      )}

      {/* Cassette library — modal grid of every saved jam. */}
      {libraryOpen && (
        <JamLibrary
          onLoad={(song) => { void handleLoadJam(song); }}
          onClose={() => setLibraryOpen(false)}
        />
      )}

      {/* Save-name dialog. Triggered by RECORD pass completion OR by
       *  Back when there are unsaved changes. Commits the snapshot
       *  via commitSave(), then optionally exits the stage. */}
      {saveDialog && (
        <SaveJamDialog
          nameDraft={saveDialog.nameDraft}
          onChange={(v) => setSaveDialog({ ...saveDialog, nameDraft: v })}
          onSave={() => {
            commitSave(saveDialog.nameDraft);
            const shouldExit = saveDialog.exitAfter;
            setSaveDialog(null);
            if (shouldExit) {
              clearAllSlots();
              setStage("home");
            }
          }}
          onDiscard={() => {
            const shouldExit = saveDialog.exitAfter;
            setSaveDialog(null);
            if (shouldExit) {
              clearAllSlots();
              setStage("home");
            }
          }}
          onCancel={() => setSaveDialog(null)}
          showDiscard={saveDialog.exitAfter}
        />
      )}

      {/* RECORD button pulse keyframe — defined once at the JamView
       *  root so the dot animation works whether the button is in
       *  its idle or recording variant. */}
      <style>{`
        @keyframes recDot {
          0%, 100% { transform: scale(1);    opacity: 1;   }
          50%      { transform: scale(0.6);  opacity: 0.4; }
        }
      `}</style>

      {/* Character popup — replaces the v1 sidebar palette. Opens via
       *  the floating "+" button. Tapping a tile picks the character
       *  (closes the popup, enters placement mode); dragging a tile
       *  uses the classic HTML5 drop flow. */}
      {paletteOpen && (
        <CharacterPalette
          placedKinds={new Set(Object.keys(bandPlacements) as CharacterKind[])}
          playerOnStage={playerPlaced}
          onPick={handlePickCharacter}
          onPickPlayer={handlePickPlayer}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Placement-mode cursor preview — the picked character follows
       *  the pointer at full room scale until the player clicks the
       *  room (or hits Esc / right-clicks to cancel). pointer-events
       *  none so the click below it actually lands on the room. */}
      {(pendingChar || pendingPlayer) && cursorPos && (() => {
        // Pick the right preview source — band character uses its
        // skin's right pose; player uses the player-character.png
        // PlayerAtMic renders. Player gets a slightly bigger preview
        // to match the lead's room size.
        const previewSrc = pendingChar
          ? CHARACTER_SKINS[pendingChar.characterKind][pendingChar.soundId].right
          : "/characters/player-guy/player-character.png";
        const previewSize = pendingChar ? bandSpriteSize : playerSpriteSize;
        const label = pendingChar ? pendingChar.name : "YOU";
        return (
          <>
            <img
              src={previewSrc}
              alt=""
              draggable={false}
              style={{
                position: "fixed",
                left: cursorPos.x,
                top:  cursorPos.y,
                width:  previewSize,
                height: previewSize,
                transform: "translate(-50%, -100%)",
                pointerEvents: "none",
                userSelect: "none",
                zIndex: 250,
                opacity: 0.85,
                filter: "drop-shadow(0 0 18px rgba(255, 230, 90, 0.8)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))",
              }}
            />
            {/* "Placing X — click to drop" hint banner */}
            <div
              style={{
                position: "fixed",
                top: 60,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 251,
                padding: "8px 16px",
                borderRadius: 999,
                background: "linear-gradient(180deg, #f4d35e, #b8881a)",
                border: "2.5px solid #0a0f1c",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 13,
                color: "#0a0f1c",
                letterSpacing: 0.5,
                pointerEvents: "none",
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), 0 4px 0 rgba(0,0,0,0.45), 0 0 18px rgba(244, 211, 94, 0.55)",
                textShadow: "0 1px 0 rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              PLACING {label} — click to drop · esc to cancel
            </div>
          </>
        );
      })()}

      <style>{`
        @keyframes jamCharBtnPulse {
          0%, 100% { transform: translate(0, -50%) scale(1);    box-shadow: inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.3), 0 6px 0 rgba(0,0,0,0.5), 0 0 22px rgba(233,69,96,0.55); }
          50%      { transform: translate(0, -50%) scale(1.06); box-shadow: inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.3), 0 6px 0 rgba(0,0,0,0.5), 0 0 32px rgba(233,69,96,0.85); }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* VOCAL_PSEUDO_SOUND — synthetic SoundOption used to render character / control
   panel labels for slots that have a recorded vocal. The catalog map doesn't
   know about user recordings, so we manufacture this on-the-fly.            */
/* -------------------------------------------------------------------------- */

const VOCAL_PSEUDO_SOUND = {
  id: VOCAL_DROP_ID,
  kind: "vocal" as const,
  name: "your voice",
  glyph: "🎤",
  variant: "vocal-recording",
  tags: [],
  vibe: "your recorded voice",
  // Treat it as if it were 140 BPM so character animations behave normally.
  nativeBpm: 140,
};

/* -------------------------------------------------------------------------- */
/* VocalRecordingOverlay — full-stage overlay that captures 4 bars of mic     */
/* audio and hands the resulting AudioBuffer back via onRecorded.             */
/* -------------------------------------------------------------------------- */

interface VocalRecordingOverlayProps {
  bpm:        number;
  onRecorded: (buffer: AudioBuffer) => void;
  onCancel:   () => void;
}

/** Premade verse pool — 8 hooks across trap / drill / melodic so the
 *  GENERATE button always lands somewhere usable. Two lines each so
 *  the recording stays in the 5–9 s sweet spot at common BPMs. */
const VERSE_POOL: string[][] = [
  ["step in the booth, it's time to create",
   "GRVD certified, we shining at the light"],
  ["count it up, all this paper in my hand",
   "no time to play, gotta stick to the plan"],
  ["uptown, uptown, gettin' it shakin'",
   "linkin' my dawgs, this the takeover"],
  ["feel the bass, it's a wave in my chest",
   "city night ridin' with the squad on my left"],
  ["paint a picture with the words I say",
   "every single line, every flow a play"],
  ["I been on a roll, won't slow down",
   "rep my city, yeah I hold it down"],
  ["it's a movement, it's a moment",
   "every beat I drop, it's golden"],
  ["chasin' dreams in the middle of the night",
   "everything I touch, it turn out right"],
];

function pickRandomVerse(): string[] {
  return VERSE_POOL[Math.floor(Math.random() * VERSE_POOL.length)];
}

function VocalRecordingOverlay({ bpm, onRecorded, onCancel }: VocalRecordingOverlayProps) {
  type Phase = "ready" | "countdown" | "recording" | "scoring" | "error";
  const [phase,         setPhase]         = useState<Phase>("ready");
  const [error,         setError]         = useState<string | null>(null);
  const [elapsed,       setElapsed]       = useState(0);
  const [countdownTick, setCountdownTick] = useState<3 | 2 | 1>(3);

  // ── Karaoke lyrics ──
  // Verse = an array of lines. Each line takes BARS_PER_LINE bars of
  // the master BPM. Total record length = verse.length × line length.
  // 2 lines × 2 bars at 140 BPM ≈ 6.9 s — matches the catalog loops
  // (drums / 808 / sample) so the vocal phrase loops cleanly under
  // the band. Generate picks a new random verse from the pool; edit
  // opens an inline textarea per line.
  const BARS_PER_LINE = 2;
  const [verse, setVerse] = useState<string[]>(() => pickRandomVerse());
  const [isEditing, setIsEditing] = useState(false);
  const [editLines, setEditLines] = useState<string[]>([]);

  const beatSecs = 60 / bpm;
  const lineSecs = beatSecs * 4 * BARS_PER_LINE;     // 1 line = 2 bars
  const recordSecs = verse.length * lineSecs;

  // Which lyric line should be lit up given current elapsed time.
  const activeLineIdx = phase === "recording"
    ? Math.min(verse.length - 1, Math.floor(elapsed / lineSecs))
    : -1;

  // ── Countdown phase — BPM-locked via setTimeout ──
  // 3 → 2 → 1 → record. Each step is one BEAT at the master BPM
  // (not one second), so the countdown matches the band's tempo
  // regardless of whether the master transport is currently running
  // (the player may be recording before placing any band character).
  // The ticks are the only metronome cues — the recording phase
  // itself runs silent so the captured vocal isn't muddied by click
  // bleed (phone speaker → mic) and the singer is free to flow.
  useEffect(() => {
    if (phase !== "countdown") return;
    let cancelled = false;
    const beatMs = (60 / bpm) * 1000;

    setCountdownTick(3);
    void playMetronomeTick(false);

    const t1 = window.setTimeout(() => {
      if (cancelled) return;
      setCountdownTick(2);
      void playMetronomeTick(false);
    }, beatMs);
    const t2 = window.setTimeout(() => {
      if (cancelled) return;
      setCountdownTick(1);
      void playMetronomeTick(true);
    }, beatMs * 2);
    const t3 = window.setTimeout(() => {
      if (cancelled) return;
      void beginRecording();
    }, beatMs * 3);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bpm]);

  // ── No recording-phase metronome ──
  // The countdown handles "lock the tempo / cue the singer to start".
  // Once recording begins, the band loops the singer hears in their
  // headphones (when any band character is placed) are the rhythm
  // reference, plus the active-line highlight in the lyrics block.
  // A ticking click during the take ends up either bleeding into the
  // captured vocal (phone-speaker recording) or distracting the
  // singer from free-flowing custom lyrics. Free-form vocal performance
  // tends to be tighter without the click on top.

  async function beginRecording() {
    setPhase("recording");
    setElapsed(0);
    const startMs = Date.now();
    const tick = window.setInterval(() => {
      const s = (Date.now() - startMs) / 1000;
      setElapsed(s);
      if (s >= recordSecs) window.clearInterval(tick);
    }, 50);

    try {
      const { buffer } = await recordVocal(recordSecs, () => { /* no VU for now */ });
      window.clearInterval(tick);
      setPhase("scoring");
      onRecorded(buffer);
    } catch (e) {
      window.clearInterval(tick);
      setPhase("error");
      setError(e instanceof Error ? e.message : "recording failed");
    }
  }

  function handleStart() {
    setError(null);
    setPhase("countdown");
  }

  // Which beat dot of the bar is currently lit (0..3).
  const beatIdx = phase === "recording"
    ? Math.floor(elapsed / beatSecs) % 4
    : -1;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8, 10, 24, 0.85)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "min(94vw, 420px)",
          padding: 22,
          borderRadius: 22,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.55)",
          textAlign: "center",
        }}
      >
        {/* READY phase — title, lyrics block + edit / generate, headphone
         *  hint, start / cancel. */}
        {phase === "ready" && (
          <>
            <div style={{ fontSize: 40, marginBottom: 4 }}>🎤</div>
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 20,
                color: "#fff",
                letterSpacing: 0.5,
                marginBottom: 12,
              }}
            >
              RECORD YOUR VOICE
            </div>

            {/* Lyrics block — read mode by default; edit mode shows a
             *  per-line textarea so the player can rewrite freely. */}
            {!isEditing ? (
              <div
                style={{
                  padding: "12px 14px",
                  marginBottom: 12,
                  borderRadius: 14,
                  background: "rgba(0, 0, 0, 0.28)",
                  border: "2px solid rgba(192, 132, 252, 0.35)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 12px rgba(192, 132, 252, 0.18)",
                  textAlign: "center",
                }}
              >
                {verse.map((line, i) => (
                  <div
                    key={i}
                    style={{
                      fontFamily: "'Lilita One', system-ui",
                      fontSize: 14,
                      color: "#fff",
                      letterSpacing: 0.2,
                      lineHeight: 1.4,
                      marginBottom: i < verse.length - 1 ? 4 : 0,
                      textShadow: "0 1px 0 rgba(0,0,0,0.55)",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  padding: 10,
                  marginBottom: 12,
                  borderRadius: 14,
                  background: "rgba(0, 0, 0, 0.28)",
                  border: "2px solid rgba(192, 132, 252, 0.55)",
                }}
              >
                {editLines.map((line, i) => (
                  <input
                    key={i}
                    type="text"
                    value={line}
                    onChange={(e) => {
                      const next = [...editLines];
                      next[i] = e.target.value;
                      setEditLines(next);
                    }}
                    style={{
                      width: "100%",
                      padding: "6px 10px",
                      marginBottom: i < editLines.length - 1 ? 6 : 0,
                      borderRadius: 8,
                      border: "1.5px solid rgba(255,255,255,0.18)",
                      background: "rgba(255,255,255,0.04)",
                      color: "#fff",
                      fontFamily: "'Lilita One', system-ui",
                      fontSize: 13,
                      letterSpacing: 0.2,
                      outline: "none",
                      textAlign: "center",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Generate / Edit row */}
            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 12 }}>
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setVerse(pickRandomVerse())}
                    style={lyricsBtn("#fb923c")}
                  >
                    🎲 GENERATE
                  </button>
                  <button
                    onClick={() => {
                      setEditLines([...verse]);
                      setIsEditing(true);
                    }}
                    style={lyricsBtn("#c084fc")}
                  >
                    ✏️ EDIT
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      const cleaned = editLines.map((l) => l.trim()).filter((l) => l.length > 0);
                      setVerse(cleaned.length > 0 ? cleaned : verse);
                      setIsEditing(false);
                    }}
                    style={lyricsBtn("#6bf395")}
                  >
                    ✓ SAVE
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    style={lyricsBtn("#9ca3af")}
                  >
                    ✕ CANCEL
                  </button>
                </>
              )}
            </div>

            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui",
                fontSize: 11,
                color: "rgba(255,255,255,0.55)",
                fontStyle: "italic",
                margin: "0 0 14px",
                lineHeight: 1.5,
              }}
            >
              use wired headphones for high-quality results
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={handleStart} disabled={isEditing} style={primaryBtn(isEditing)}>START</button>
              <button onClick={onCancel} style={secondaryBtn()}>CANCEL</button>
            </div>
          </>
        )}

        {/* COUNTDOWN phase — huge 3, 2, 1 with click on each. */}
        {phase === "countdown" && (
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.32em",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
                marginBottom: 10,
              }}
            >
              get ready
            </div>
            <div
              key={countdownTick}
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 110,
                color: "#fff",
                lineHeight: 1,
                textShadow: "0 4px 0 rgba(0,0,0,0.55), 0 0 28px rgba(233, 69, 96, 0.7)",
                animation: "vocalCountdownPop 1s ease-out both",
              }}
            >
              {countdownTick}
            </div>
          </>
        )}

        {/* RECORDING phase — beat dots, progress bar. Minimal text. */}
        {phase === "recording" && (
          <>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.32em",
                color: "#E94560",
                textTransform: "uppercase",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{
                display: "inline-block",
                width: 10, height: 10,
                borderRadius: "50%",
                background: "#E94560",
                boxShadow: "0 0 10px rgba(233, 69, 96, 0.85)",
                animation: "vocalRecPulse 1.2s ease-in-out infinite",
              }} />
              RECORDING
            </div>

            {/* Karaoke lyrics — line that's "now" is gold and big; the
             *  upcoming / already-sung lines fade. Active line based
             *  purely on elapsed time so it tracks the metronome the
             *  singer is hearing. */}
            <div
              style={{
                marginBottom: 14,
                padding: "10px 12px",
                borderRadius: 12,
                background: "rgba(0, 0, 0, 0.32)",
                border: "2px solid rgba(192, 132, 252, 0.30)",
              }}
            >
              {verse.map((line, i) => {
                const active = i === activeLineIdx;
                return (
                  <div
                    key={i}
                    style={{
                      fontFamily: "'Lilita One', system-ui",
                      fontSize: active ? 16 : 13,
                      color: active ? "#facc15" : "rgba(255,255,255,0.45)",
                      letterSpacing: 0.2,
                      lineHeight: 1.35,
                      marginBottom: i < verse.length - 1 ? 4 : 0,
                      textShadow: active
                        ? "0 1px 0 rgba(0,0,0,0.65), 0 0 12px rgba(250, 204, 21, 0.55)"
                        : "0 1px 0 rgba(0,0,0,0.5)",
                      transition: "color 0.2s, font-size 0.2s, text-shadow 0.2s",
                    }}
                  >
                    {line}
                  </div>
                );
              })}
            </div>

            {/* 4 beat dots — light up in sequence with the bar. Reads
             *  like a visual metronome the singer can follow. */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: 12,
                marginBottom: 14,
              }}
            >
              {[0, 1, 2, 3].map((i) => {
                const lit = i === beatIdx;
                const accent = i === 0;
                return (
                  <div
                    key={i}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: lit
                        ? (accent ? "#facc15" : "#E94560")
                        : "rgba(255, 255, 255, 0.10)",
                      border: `2px solid ${lit ? "#0a0f1c" : "rgba(255,255,255,0.18)"}`,
                      boxShadow: lit
                        ? (accent ? "0 0 14px rgba(250, 204, 21, 0.85)" : "0 0 12px rgba(233, 69, 96, 0.85)")
                        : undefined,
                      transform: lit ? "scale(1.18)" : "scale(1)",
                      transition: "transform 0.08s ease-out, background 0.08s ease-out, box-shadow 0.08s ease-out",
                    }}
                  />
                );
              })}
            </div>

            <div
              style={{
                height: 4,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 2,
                overflow: "hidden",
                margin: "0 0 4px",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(100, (elapsed / recordSecs) * 100)}%`,
                  background: "linear-gradient(90deg, #E94560, #ff7a8e)",
                  transition: "width 0.05s linear",
                }}
              />
            </div>
          </>
        )}

        {phase === "scoring" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 22,
                color: "#fff",
                letterSpacing: 0.5,
              }}
            >
              DONE
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⚠️</div>
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 22,
                color: "#fff",
                letterSpacing: 0.5,
                marginBottom: 6,
              }}
            >
              OOPS
            </div>
            <p
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.65)",
                margin: "0 0 16px",
                lineHeight: 1.5,
              }}
            >
              {error ?? "couldn't access the microphone"}
            </p>
            <button onClick={onCancel} style={secondaryBtn()}>CLOSE</button>
          </>
        )}

        <style>{`
          @keyframes vocalCountdownPop {
            0%   { transform: scale(0.6);  opacity: 0; }
            30%  { transform: scale(1.15); opacity: 1; }
            100% { transform: scale(1);    opacity: 1; }
          }
          @keyframes vocalRecPulse {
            0%, 100% { opacity: 0.55; }
            50%      { opacity: 1;    }
          }
        `}</style>
      </div>
    </div>
  );
}

function primaryBtn(disabled = false): React.CSSProperties {
  return {
    padding: "10px 22px",
    borderRadius: 14,
    border: "2px solid #0a0f1c",
    background: disabled
      ? "linear-gradient(180deg, #4a4a4a, #2a2a2a)"
      : "linear-gradient(180deg, #ff7a8e, #b8253a)",
    color: "#fff",
    fontFamily: "'Lilita One', system-ui",
    fontSize: 14,
    letterSpacing: 0.5,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45)",
  };
}

/** Small accent-colour pill used by the GENERATE / EDIT / SAVE row.
 *  Color is the gradient top — a darker shade is computed for the
 *  bottom so the button looks chunky and game-y at any hue. */
function lyricsBtn(accent: string): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 10,
    border: "2px solid #0a0f1c",
    background: `linear-gradient(180deg, ${accent}, ${accent}99)`,
    color: "#0a0f1c",
    fontFamily: "'Lilita One', system-ui",
    fontSize: 11,
    letterSpacing: 0.3,
    cursor: "pointer",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(0,0,0,0.4)",
    textShadow: "0 1px 0 rgba(255,255,255,0.35)",
  };
}
function secondaryBtn(): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 12,
    border: "1.5px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}

/* LockedSlot was removed when the band became 4-of-4 in the Crib layout.
 * Future progression (additional characters / unlocks) will use a
 * different visual treatment that fits the iso room — likely a fade-in
 * silhouette pre-spawning at its floor position rather than a separate
 * placeholder tile. */

/* -------------------------------------------------------------------------- */
/* BpmControl — live tempo widget in the top bar.                              */
/* -------------------------------------------------------------------------- */

interface BpmControlProps {
  bpm:    number;
  /** Called with a delta. Parent clamps to MIN_BPM..MAX_BPM. */
  onNudge: (delta: number) => void;
}

/* -------------------------------------------------------------------------- */
/* SaveJamDialog — name-this-jam overlay shown after a recording pass or       */
/* when the player hits Back with unsaved changes.                              */
/* -------------------------------------------------------------------------- */

interface SaveJamDialogProps {
  nameDraft:    string;
  onChange:     (v: string) => void;
  onSave:       () => void;
  onDiscard:    () => void;
  onCancel:     () => void;
  /** True when the dialog was triggered by Back. Shows a Discard
   *  option (toss the jam and exit anyway). False when triggered by
   *  RECORD completion — the user is saving, not deciding whether
   *  to. */
  showDiscard:  boolean;
}

function SaveJamDialog({
  nameDraft, onChange, onSave, onDiscard, onCancel, showDiscard,
}: SaveJamDialogProps) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 400,
          background: "rgba(8, 12, 24, 0.7)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left:  "50%",
          top:   "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 401,
          width: "min(94vw, 380px)",
          padding: 22,
          borderRadius: 20,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 18px 38px rgba(0,0,0,0.6), 0 0 28px rgba(192, 132, 252, 0.35)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 4 }}>📼</div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 20,
            color: "#fff",
            letterSpacing: 0.5,
            marginBottom: 10,
            textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 14px rgba(192, 132, 252, 0.45)",
          }}
        >
          NAME YOUR CASSETTE
        </div>
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); onSave(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          placeholder="untitled mix"
          style={{
            width: "100%",
            padding: "9px 12px",
            marginBottom: 14,
            borderRadius: 10,
            border: "2px solid rgba(192, 132, 252, 0.5)",
            background: "rgba(0,0,0,0.3)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 14,
            letterSpacing: 0.3,
            outline: "none",
            textAlign: "center",
          }}
        />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={onSave} style={saveBtn()}>SAVE</button>
          {showDiscard && (
            <button onClick={onDiscard} style={discardBtn()}>DISCARD</button>
          )}
          <button onClick={onCancel} style={secondaryBtn()}>CANCEL</button>
        </div>
      </div>
    </>
  );
}

function saveBtn(): React.CSSProperties {
  return {
    padding: "10px 22px",
    borderRadius: 14,
    border: "2px solid #0a0f1c",
    background: "linear-gradient(180deg, #c084fc, #7e22ce)",
    color: "#fff",
    fontFamily: "'Lilita One', system-ui",
    fontSize: 14,
    letterSpacing: 0.5,
    cursor: "pointer",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45)",
  };
}
function discardBtn(): React.CSSProperties {
  return {
    padding: "10px 18px",
    borderRadius: 14,
    border: "2px solid #0a0f1c",
    background: "linear-gradient(180deg, #4a4a4a, #2a2a2a)",
    color: "#fff",
    fontFamily: "'Lilita One', system-ui",
    fontSize: 12,
    letterSpacing: 0.5,
    cursor: "pointer",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), 0 4px 0 rgba(0,0,0,0.45)",
  };
}

function BpmControl({ bpm, onNudge }: BpmControlProps) {
  // Press-and-hold repeat: tap once = ±1, hold = repeat at increasing
  // rate. Released on pointerup / pointerleave.
  const repeatTimeoutRef = useRef<number | null>(null);
  const repeatIntervalRef = useRef<number | null>(null);

  function clearRepeat() {
    if (repeatTimeoutRef.current !== null) {
      window.clearTimeout(repeatTimeoutRef.current);
      repeatTimeoutRef.current = null;
    }
    if (repeatIntervalRef.current !== null) {
      window.clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  }

  function startRepeat(delta: number) {
    onNudge(delta);                         // immediate first nudge
    // After 350ms hold, start repeating at 50ms intervals (~20/s).
    repeatTimeoutRef.current = window.setTimeout(() => {
      repeatIntervalRef.current = window.setInterval(() => {
        onNudge(delta);
      }, 50);
    }, 350);
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 6px",
        borderRadius: 999,
        border: "1.5px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
      }}
    >
      <BpmButton
        label="−"
        onPointerDown={() => startRepeat(-1)}
        onPointerUp={clearRepeat}
        onPointerLeave={clearRepeat}
        onPointerCancel={clearRepeat}
      />
      <div
        style={{
          minWidth: 56,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "0.10em",
          padding: "0 4px",
        }}
        aria-label={`${bpm} beats per minute`}
      >
        {bpm}<span style={{ opacity: 0.45, marginLeft: 4 }}>BPM</span>
      </div>
      <BpmButton
        label="+"
        onPointerDown={() => startRepeat(+1)}
        onPointerUp={clearRepeat}
        onPointerLeave={clearRepeat}
        onPointerCancel={clearRepeat}
      />
    </div>
  );
}

interface BpmButtonProps {
  label: string;
  onPointerDown:  () => void;
  onPointerUp:    () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

function BpmButton({ label, onPointerDown, onPointerUp, onPointerLeave, onPointerCancel }: BpmButtonProps) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onPointerDown(); }}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        border: "1.5px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.85)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {label}
    </button>
  );
}
