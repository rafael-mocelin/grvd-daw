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

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { REAL_SOUNDS } from "../data/sounds";
import type { LayerKind, SoundOption } from "../data/types";
import { Crib } from "./jam/Crib";
import { BandSlot } from "./jam/BandSlot";
import { SoundPalette } from "./jam/SoundPalette";
import { CharacterControls } from "./jam/CharacterControls";
import { StageSpot } from "./jam/StageSpot";
import { PlayerAtMic } from "./jam/PlayerAtMic";
import { ComboBanner } from "./jam/ComboBanner";
import { ComboBurst } from "./jam/ComboBurst";
import { COMBOS, detectCombo, type JamCombo } from "../data/jamCombos";
import {
  ACCEPTED_KIND,
  HYPE_POOL,
  type CharacterKind,
} from "../data/characterSkins";
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
 * Slots on the Crib stage. Each slot is bound to ONE character kind
 * and ONE accepted LayerKind — drum-guy only takes drums, beat-guy
 * only takes 808s, guitar-guy only takes samples, and the player
 * (slot-player) only takes the VOCAL_DROP_ID sentinel from the MIC
 * tile. Mismatched drops are silently rejected by the slot.
 *
 * Each slot has an iso position expressed as a %% of the contained
 * backdrop image (see Crib.tsx for how the bounds are computed). The
 * player slot is rendered separately (PlayerAtMic) because it has
 * different visuals + drop semantics.
 *
 * Hi-hat slot was removed from the band — no character for that
 * section yet. r-bells-Fm (paradise) is also hidden in the palette
 * because guitar-guy has no skin for it.
 */
interface BandSlotConfig {
  id:            string;
  characterKind: CharacterKind;
  pos:           { x: number; y: number };  // %% of the contained image
}

const BAND_SLOTS: BandSlotConfig[] = [
  // Symmetric arc around the player — drum-guy back-center, beat-guy
  // and guitar-guy mirrored at the same y on either side. Tuned by
  // eye against the iso room so the band reads centered with the
  // wood floor and the player out front.
  { id: "slot-drums",  characterKind: "drum-guy",   pos: { x: 53, y: 52 } },  // back-center
  { id: "slot-808",    characterKind: "beat-guy",   pos: { x: 64, y: 63 } },  // mid-right
  { id: "slot-sample", characterKind: "guitar-guy", pos: { x: 41, y: 63 } },  // mid-left
];

/** Player slot id — distinct from band slots and special-cased in
 *  drop / render logic. Held in slotState alongside band entries so
 *  the audio engine and combo detector treat it uniformly. */
const PLAYER_SLOT_ID = "slot-player";

/** Player + mic stand position — front-center, on the same vertical
 *  axis as drum-guy so the band-and-singer arc looks centered. */
const PLAYER_POS = { x: 53, y: 74 };

/** Lookup table mapping slot id → character kind for hype lines etc. */
const SLOT_CHARACTER: Record<string, CharacterKind | "player"> = {
  ...Object.fromEntries(BAND_SLOTS.map((s) => [s.id, s.characterKind])),
  [PLAYER_SLOT_ID]: "player",
};

/** Pick a random hype line for a band slot. Player slot has no pool
 *  in v1 — they're the lead, they let the band hype them. */
function randomHypeForSlot(slotId: string): string | null {
  const ck = SLOT_CHARACTER[slotId];
  if (ck === "player" || !ck) return null;
  const pool = HYPE_POOL[ck];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Sound-id → LayerKind lookup, used by drop validation. */
const SOUND_KIND: Record<string, LayerKind> = Object.fromEntries(
  REAL_SOUNDS.map((s) => [s.id, s.kind]),
);

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

  // Per-slot state, keyed by the slot id. Includes both the band
  // slots and the player slot so the audio engine, combo detector,
  // and hype-line interval all treat the player uniformly.
  const [slotState, setSlotState] = useState<Record<string, SlotState>>(() => {
    const bands = Object.fromEntries(BAND_SLOTS.map((s) => [s.id, { ...EMPTY_SLOT }]));
    return { ...bands, [PLAYER_SLOT_ID]: { ...EMPTY_SLOT } };
  });

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
        for (const slot of BAND_SLOTS) {
          const st = slotState[slot.id];
          if (!st?.soundId) continue;
          const line = randomHypeForSlot(slot.id);
          if (line) next[slot.id] = line;
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
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const current = slotStateRef.current;
      const filledSlots = BAND_SLOTS.filter((s) => {
        const st = current[s.id];
        return st?.soundId && !st.muted;
      });
      if (filledSlots.length === 0) return;
      const slot = filledSlots[Math.floor(Math.random() * filledSlots.length)];
      const line = randomHypeForSlot(slot.id);
      if (!line) return;
      setHypeLines((prev) => ({ ...prev, [slot.id]: line }));
      window.setTimeout(() => {
        setHypeLines((prev) =>
          prev[slot.id] === line ? { ...prev, [slot.id]: null } : prev,
        );
      }, 1700);
    };
    const interval = window.setInterval(tick, 6500);
    return () => window.clearInterval(interval);
  }, [playing]);

  /** Drop handler — assign sound to slot, update state, kick the engine. */
  async function handleDrop(slotId: string, soundId: string) {
    setDragOverSlot(null);

    // ── Vocal / mic drops ──
    // Only the player slot accepts the VOCAL_DROP_ID sentinel. Band
    // slots silently reject it (they're locked to their own kind).
    if (soundId === VOCAL_DROP_ID) {
      if (slotId !== PLAYER_SLOT_ID) return;
      setRecordingForSlot(slotId);
      return;
    }

    // ── Catalog sound drops ──
    // The player slot does not accept any catalog sound — only the
    // mic. Band slots accept ONLY their bound LayerKind.
    if (slotId === PLAYER_SLOT_ID) return;

    const droppedKind = SOUND_KIND[soundId];
    const slotConfig = BAND_SLOTS.find((s) => s.id === slotId);
    if (!slotConfig) return;
    const expectedKind = ACCEPTED_KIND[slotConfig.characterKind];
    if (droppedKind !== expectedKind) {
      // Wrong kind for this band slot — silently reject. (Future:
      // wire an onRejectDrop callback so the slot can shake.)
      return;
    }

    setSlotState((prev) => ({
      ...prev,
      [slotId]: { soundId, muted: false, volume: 1.0 },
    }));
    try { await ensureAudio(); } catch { /* ignore */ }
    await assignSlot(slotId, soundId, bpm);
    if (!playing) {
      resumeJam();
      setPlaying(true);
    }
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
      [slotId]: { soundId: VOCAL_DROP_ID, muted: false, volume: 1.0 },
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
    const stageRect = stageRef.current.getBoundingClientRect();
    const slotRect  = slotEl.getBoundingClientRect();
    setControlAnchor({
      left: slotRect.left - stageRect.left + slotRect.width / 2,
      top:  slotRect.top  - stageRect.top,
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
    setSlotState((prev) => ({ ...prev, [slotId]: { ...EMPTY_SLOT } }));
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

      {/* Main area — palette on left, stage on right */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sound palette — sized to fit the tile (icon + name) and not
         *  much else. Was 200 px when each tile carried a BPM subline;
         *  the BPM is now in the top bar so the sidebar can shrink. */}
        <div
          style={{
            width: 160,
            flexShrink: 0,
            minHeight: 0,
            zIndex: 5,
          }}
        >
          <SoundPalette assignedIds={assignedIds} />
        </div>

        {/* Stage */}
        <div
          ref={stageRef}
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Crib backdrop — pre-rendered iso room PNG, contained inside
           *  the stage area so the whole room is visible regardless of
           *  viewport aspect (dark bars fill the leftover space). The
           *  Crib also provides a child-overlay box that matches the
           *  rendered image bounds, so the iso character positions
           *  below stay locked to the floor when the viewport changes. */}
          <Crib>
            {/* Per-band-slot stage spots — soft circular spotlights on
             *  the floor under each character, brightening with audio. */}
            {BAND_SLOTS.map((slot) => {
              const state = slotState[slot.id];
              return (
                <StageSpot
                  key={`spot-${slot.id}`}
                  pos={slot.pos}
                  active={playing && !!state.soundId && !state.muted}
                />
              );
            })}
            {/* Player spot — gold accent + larger so the lead reads as
             *  the star even when the band is hot. */}
            <StageSpot
              pos={PLAYER_POS}
              active={playing && !!slotState[PLAYER_SLOT_ID].soundId && !slotState[PLAYER_SLOT_ID].muted}
              size="large"
              accent="#facc15"
            />

            {/* Band — 3 sprite-based slots, each bound to one kind. */}
            {BAND_SLOTS.map((slot) => {
              const state = slotState[slot.id];
              const sound = state.soundId
                ? soundsById.get(state.soundId) ?? null
                : null;
              return (
                <div
                  key={slot.id}
                  style={{
                    position: "absolute",
                    left: `${slot.pos.x}%`,
                    top:  `${slot.pos.y}%`,
                    // Anchor the sprite's feet at (x, y) — sprite is
                    // square (200x200), so shift up-left by half-width
                    // and full-height to land on the floor.
                    transform: "translate(-50%, -100%)",
                    zIndex: 4,
                  }}
                >
                  <BandSlot
                    slotId={slot.id}
                    characterKind={slot.characterKind}
                    acceptKind={ACCEPTED_KIND[slot.characterKind]}
                    sound={sound}
                    muted={state.muted}
                    volume={state.volume}
                    playing={playing}
                    bpm={bpm}
                    hypeLine={hypeLines[slot.id] ?? null}
                    onDropSound={(soundId) => handleDrop(slot.id, soundId)}
                    onTap={() => state.soundId && handleMuteToggle(slot.id)}
                    onLongPress={() => state.soundId && handleSlotTap(slot.id)}
                    dragOver={dragOverSlot === slot.id}
                    onDragEnter={() => setDragOverSlot(slot.id)}
                    onDragLeave={() => setDragOverSlot((s) => (s === slot.id ? null : s))}
                  />
                </div>
              );
            })}

            {/* Player + mic stand. Drop a vocal recording here (the
             *  MIC tile from the palette); other dropped sounds are
             *  silently rejected. */}
            <div
              style={{
                position: "absolute",
                left: `${PLAYER_POS.x}%`,
                top:  `${PLAYER_POS.y}%`,
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
                onDropSound={(soundId) => handleDrop(PLAYER_SLOT_ID, soundId)}
                onDragEnter={() => setDragOverSlot(PLAYER_SLOT_ID)}
                onDragLeave={() => setDragOverSlot((s) => (s === PLAYER_SLOT_ID ? null : s))}
                onTap={() => slotState[PLAYER_SLOT_ID].soundId && handleMuteToggle(PLAYER_SLOT_ID)}
                onLongPress={() => slotState[PLAYER_SLOT_ID].soundId && handleSlotTap(PLAYER_SLOT_ID)}
              />
            </div>
          </Crib>

          {/* Empty-state hint — only shown when nothing is assigned yet */}
          {assignedIds.size === 0 && (
            <div
              style={{
                position: "absolute",
                top: "20%",
                left: "50%",
                transform: "translateX(-50%)",
                textAlign: "center",
                pointerEvents: "none",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "rgba(255,255,255,0.55)",
                textShadow: "0 2px 0 rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ fontFamily: "'Lilita One', system-ui", fontSize: 22, color: "#fff", marginBottom: 6, letterSpacing: 1 }}>
                Drop a sound on a character to start
              </div>
              <div>← drag from the left rail</div>
            </div>
          )}

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
            return (
              <CharacterControls
                sound={sound}
                muted={state.muted}
                volume={state.volume}
                syncToBpm={state.syncToBpm}
                anchorLeft={controlAnchor.left}
                anchorTop={controlAnchor.top}
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
