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
import { useJamAudioFrame } from "../hooks/useJamAudioFrame";
import { ComboCodex } from "./jam/ComboCodex";
import {
  assignSlot,
  clearSlot,
  setSlotVolume,
  setSlotMuted,
  setMasterBpm,
  setVocalSync,
  clearAllSlots,
  pauseJam,
  resumeJam,
  assignVocalSlot,
} from "../audio/jamEngine";
import { ensureAudio, recordVocal } from "../audio/engine";
import { playJamComboSting, playMetronomeTick } from "../audio/jamSfx";
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

/** Snap-to-grid resolution for character placements. The room is
 *  rendered as a square; we overlay an invisible GRID_COLS × GRID_ROWS
 *  grid and snap each drop to the nearest cell center. The numbers
 *  here trade off placement freedom (high = anywhere) vs. tidy
 *  alignment (low = chunky desktop-icon feel). 10×7 lands in the
 *  middle: ~10% horizontal × ~14% vertical cells. */
const GRID_COLS = 10;
const GRID_ROWS = 7;

/** Pick a random hype line for a placed band character. Player slot
 *  has no pool — they're the lead, they let the band hype them. */
function randomHypeForCharacter(kind: CharacterKind | undefined): string | null {
  if (!kind) return null;
  const pool = HYPE_POOL[kind];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Snap an x/y in % to the nearest grid cell center, clamping to the
 *  grid extents so a near-edge drop doesn't fall off the room. */
function snapToGrid(xPct: number, yPct: number): { x: number; y: number } {
  const cellW = 100 / GRID_COLS;
  const cellH = 100 / GRID_ROWS;
  const col = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(xPct / cellW)));
  const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(yPct / cellH)));
  return {
    x: (col + 0.5) * cellW,
    y: (row + 0.5) * cellH,
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
}

const EMPTY_SLOT: SlotState = { soundId: null, muted: false, volume: 1.0, syncToBpm: false };

export function JamView() {
  const setStage = useStore((s) => s.setStage);

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
  // position (snapped to grid). Esc / clicking the + button cancels.
  const [pendingChar, setPendingChar] = useState<PlaceableChar | null>(null);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  // Track cursor while in placement mode (band character OR player)
  // so the floating sprite tracks the pointer. We attach to document
  // so movement outside the stage (e.g., over the top bar) still
  // updates the preview.
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
    window.addEventListener("pointermove", onMove);
    window.addEventListener("keydown",     onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("keydown",     onKey);
    };
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

  /** Picked a character from the popup (tap, no drag) — close the
   *  popup and enter placement mode. The cursor will carry the
   *  full-size sprite until the player clicks the room. */
  function handlePickCharacter(char: PlaceableChar) {
    setPaletteOpen(false);
    setPendingChar(char);
  }

  /** Picked the player from the popup — close the popup and enter
   *  placement mode. The cursor will carry the player sprite until
   *  the user clicks the room. */
  function handlePickPlayer() {
    setPaletteOpen(false);
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
      setPlayerPos(snapToGrid(xPct, yPct));
      setPlayerPlaced(true);
      setPendingPlayer(false);
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
    const snapped = snapToGrid(xPct, yPct);

    setBandPlacements((prev) => ({
      ...prev,
      [slotId]: { soundId, pos: snapped },
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

    setPaletteOpen(false);
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
    setSlotState((prev) => ({
      ...prev,
      // syncToBpm: false — fresh recordings start unsynced; the player
      // can flip the toggle in the popover to lock the vocal to the
      // master BPM if they want.
      [slotId]: { soundId: VOCAL_DROP_ID, muted: false, volume: 1.0, syncToBpm: false },
    }));
    setRecordingForSlot(null);
    await assignVocalSlot(slotId, buffer, bpm);
    if (!playing) {
      resumeJam();
      setPlaying(true);
    }
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
          // the cursor position (snapped to grid).
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
                  onTap={() => slotState[PLAYER_SLOT_ID].soundId && handleMuteToggle(PLAYER_SLOT_ID)}
                  onLongPress={() => slotState[PLAYER_SLOT_ID].soundId && handleSlotTap(PLAYER_SLOT_ID)}
                />
              </div>
            )}

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

function VocalRecordingOverlay({ bpm, onRecorded, onCancel }: VocalRecordingOverlayProps) {
  type Phase = "ready" | "countdown" | "recording" | "scoring" | "error";
  const [phase,         setPhase]         = useState<Phase>("ready");
  const [error,         setError]         = useState<string | null>(null);
  const [elapsed,       setElapsed]       = useState(0);
  const [countdownTick, setCountdownTick] = useState<3 | 2 | 1>(3);

  // 4 bars at the master BPM = recordSecs. Long enough to phrase a
  // hook, short enough to feel snappy.
  const recordSecs = (60 / bpm) * 4 * 4;
  const beatSecs   = 60 / bpm;

  // ── Countdown phase ──
  // 3 → 2 → 1 → recording starts. Each step plays one metronome click
  // (downbeat-accented on "1") so the singer can lock the tempo before
  // they have to perform.
  useEffect(() => {
    if (phase !== "countdown") return;
    let cancelled = false;
    void playMetronomeTick(false);            // click on "3"
    setCountdownTick(3);
    const t1 = window.setTimeout(() => {
      if (cancelled) return;
      setCountdownTick(2);
      void playMetronomeTick(false);          // click on "2"
    }, 1000);
    const t2 = window.setTimeout(() => {
      if (cancelled) return;
      setCountdownTick(1);
      void playMetronomeTick(true);           // accented click on "1"
    }, 2000);
    const t3 = window.setTimeout(() => {
      if (cancelled) return;
      void beginRecording();
    }, 3000);
    return () => {
      cancelled = true;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Beat clicks during recording ──
  // setInterval at one beat per master BPM. Beats 1/5/9/13 are accented
  // so the bar boundaries are audible.
  useEffect(() => {
    if (phase !== "recording") return;
    let beatIdx = 0;
    void playMetronomeTick(true);             // beat 1, accented
    const id = window.setInterval(() => {
      beatIdx += 1;
      void playMetronomeTick(beatIdx % 4 === 0);
    }, beatSecs * 1000);
    return () => window.clearInterval(id);
  }, [phase, beatSecs]);

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
          width: "min(90vw, 360px)",
          padding: 24,
          borderRadius: 22,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.55)",
          textAlign: "center",
        }}
      >
        {/* READY phase — minimal copy: title, headphone hint, buttons. */}
        {phase === "ready" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎤</div>
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 22,
                color: "#fff",
                letterSpacing: 0.5,
                marginBottom: 8,
              }}
            >
              RECORD YOUR VOICE
            </div>
            <p
              style={{
                fontFamily: "'Plus Jakarta Sans', system-ui",
                fontSize: 12,
                color: "rgba(255,255,255,0.65)",
                fontStyle: "italic",
                margin: "0 0 18px",
                lineHeight: 1.5,
              }}
            >
              use wired headphones for high-quality results
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={handleStart}    style={primaryBtn()}>START</button>
              <button onClick={onCancel}        style={secondaryBtn()}>CANCEL</button>
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

            <div style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 24,
              color: "#fff",
              letterSpacing: 0.5,
              marginBottom: 14,
            }}>
              SING IT
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

function primaryBtn(): React.CSSProperties {
  return {
    padding: "10px 22px",
    borderRadius: 14,
    border: "2px solid #0a0f1c",
    background: "linear-gradient(180deg, #ff7a8e, #b8253a)",
    color: "#fff",
    fontFamily: "'Lilita One', system-ui",
    fontSize: 14,
    letterSpacing: 0.5,
    cursor: "pointer",
    boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45)",
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
