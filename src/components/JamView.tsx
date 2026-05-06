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
import type { SoundOption } from "../data/types";
import { Crib } from "./jam/Crib";
import { JamCharacter } from "./jam/JamCharacter";
import { SoundPalette } from "./jam/SoundPalette";
import { CharacterControls } from "./jam/CharacterControls";
import { StageSpot } from "./jam/StageSpot";
import { PlayerAtMic } from "./jam/PlayerAtMic";
import { ComboBanner } from "./jam/ComboBanner";
import { ComboBurst } from "./jam/ComboBurst";
import { COMBOS, detectCombo, type JamCombo } from "../data/jamCombos";
import { JAM_CHARACTERS } from "../data/jamCharacters";
import { useJamAudioFrame } from "../hooks/useJamAudioFrame";
import { ComboCodex } from "./jam/ComboCodex";
import {
  assignSlot,
  clearSlot,
  setSlotVolume,
  setSlotMuted,
  clearAllSlots,
  pauseJam,
  resumeJam,
  assignVocalSlot,
} from "../audio/jamEngine";
import { ensureAudio, recordVocal } from "../audio/engine";
import { playJamComboSting } from "../audio/jamSfx";
import { C } from "../ui/burst/tokens";

/**
 * Sentinel id passed in via the palette's "MIC" tile. The slot's
 * SoundOption stays null in state (since it's not a catalog entry);
 * the slot value is the recorded buffer instead.
 */
const VOCAL_DROP_ID = "__vocal__";

/**
 * Band slots — characters standing on the Crib floor. Each has an iso
 * position expressed as a % of the contained backdrop image (NOT of
 * the stage area; see Crib.tsx for how the bounds are computed). The
 * player + mic at PLAYER_POS is rendered separately because it has no
 * sound assignment.
 *
 * Three-piece band positioned in a shallow arc behind the player:
 *   - drums  back-center  (deepest into the room)
 *   - bass   mid-right
 *   - guitar mid-left
 *
 * NEEMA was previously in slot-b at (78, 52) "behind the right desk
 * where the MPC sits" — but the chibi sprite paints over the desk
 * geometry rather than tucking behind it, so visually she looked like
 * she was standing ON the desk. Pulled out of the lineup; the
 * character config still exists for future use (e.g., once the iso
 * sprite art lands and depth-sorted placement becomes possible).
 */
const DEFAULT_SLOTS: {
  id: string;
  characterId: string;
  /** % of the contained image. (50, 50) is image center. */
  pos: { x: number; y: number };
}[] = [
  { id: "slot-a", characterId: "mochi", pos: { x: 50, y: 49 } },  // drums  — back-center
  { id: "slot-c", characterId: "royal", pos: { x: 60, y: 60 } },  // bass   — mid-right
  { id: "slot-d", characterId: "blu",   pos: { x: 33, y: 58 } },  // guitar — mid-left
];

/** Player + mic stand position — front-center of the floor, closer to
 *  the viewer than any band member. */
const PLAYER_POS = { x: 47, y: 73 };

/**
 * Look up the character config for a slot. Throws if the id is unknown
 * because that's a bug in the static config (caught at boot, not at
 * runtime).
 */
function characterFor(slotCharacterId: string) {
  const c = JAM_CHARACTERS.find((c) => c.id === slotCharacterId);
  if (!c) throw new Error(`unknown character id: ${slotCharacterId}`);
  return c;
}

/** Pick a random line from a character's hype pool. */
function randomHypeFor(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Master BPM for the jam — drives all rate-stretching of the file loops. */
const JAM_BPM = 140;

/** localStorage key for combo-discovery persistence. Bumping the suffix
 *  is a clean way to wipe stored discoveries during a schema migration. */
const DISCOVERED_KEY = "grvd:jam:discovered-combos:v1";

interface SlotState {
  soundId: string | null;
  muted:   boolean;
  volume:  number;
}

const EMPTY_SLOT: SlotState = { soundId: null, muted: false, volume: 1.0 };

export function JamView() {
  const setStage = useStore((s) => s.setStage);

  // Per-slot state, keyed by the slot id.
  const [slotState, setSlotState] = useState<Record<string, SlotState>>(
    () => Object.fromEntries(DEFAULT_SLOTS.map((s) => [s.id, { ...EMPTY_SLOT }])),
  );

  // Which slot has its control panel open (null = none).
  const [openControls, setOpenControls] = useState<string | null>(null);
  const [controlAnchor, setControlAnchor] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // Track which slot is being dragged-over for the cyan halo.
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Master play/pause state for the whole jam. Defaults to true (playing)
  // so the audio reacts the moment the first sound is dropped — same
  // behaviour as before, just now with an explicit toggle.
  const [playing, setPlaying] = useState(true);

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
        // Combo activation also fires a hype line on every filled slot
        // — every character celebrates simultaneously.
        const next: Record<string, string | null> = {};
        for (const slot of DEFAULT_SLOTS) {
          const st = slotState[slot.id];
          if (!st?.soundId) continue;
          const character = characterFor(slot.characterId);
          next[slot.id] = randomHypeFor(character.hypeLines);
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
      const filledSlots = DEFAULT_SLOTS.filter((s) => {
        const st = current[s.id];
        return st?.soundId && !st.muted;
      });
      if (filledSlots.length === 0) return;
      const slot = filledSlots[Math.floor(Math.random() * filledSlots.length)];
      const character = characterFor(slot.characterId);
      const line = randomHypeFor(character.hypeLines);
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

    // Special-case the mic drop: open the recorder instead of trying
    // to play a non-existent catalog entry. The recorder closes the
    // overlay and assigns the resulting buffer to this slot.
    if (soundId === VOCAL_DROP_ID) {
      setRecordingForSlot(slotId);
      return;
    }

    setSlotState((prev) => ({
      ...prev,
      [slotId]: { soundId, muted: false, volume: 1.0 },
    }));
    // Make sure audio is unlocked (drag isn't a tap, but this mirrors
    // the click-to-play unlock; on iOS the drop event still counts as
    // user activation).
    try { await ensureAudio(); } catch { /* ignore */ }
    await assignSlot(slotId, soundId, JAM_BPM);
    // Auto-resume if we're currently paused — dropping a sound
    // implies the user wants to hear it.
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
    await assignVocalSlot(slotId, buffer, JAM_BPM);
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

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.16em",
          }}
        >
          {JAM_BPM} BPM
        </div>
      </div>

      {/* Main area — palette on left, stage on right */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sound palette */}
        <div
          style={{
            width: 200,
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
            {/* Per-character stage spots — soft circular spotlights on
             *  the floor under each character, brightening with audio.
             *  Rendered behind the characters so the chibis paint over
             *  the glow rather than the other way around. */}
            {DEFAULT_SLOTS.map((slot) => {
              const state = slotState[slot.id];
              return (
                <StageSpot
                  key={`spot-${slot.id}`}
                  pos={slot.pos}
                  active={playing && !!state.soundId && !state.muted}
                />
              );
            })}
            {/* Player spot — slightly bigger so the lead reads as the
             *  star, even when the band is hot. */}
            <StageSpot pos={PLAYER_POS} active={playing} size="large" accent="#facc15" />

            {/* Band — 4 iso-positioned characters on the room floor. */}
            {DEFAULT_SLOTS.map((slot, slotIndex) => {
              const state = slotState[slot.id];
              const character = characterFor(slot.characterId);
              const sound = state.soundId === VOCAL_DROP_ID
                ? VOCAL_PSEUDO_SOUND
                : (state.soundId ? soundsById.get(state.soundId) ?? null : null);
              return (
                <div
                  key={slot.id}
                  style={{
                    position: "absolute",
                    left: `${slot.pos.x}%`,
                    top:  `${slot.pos.y}%`,
                    // Anchor the character's feet at (x, y) — the chibi
                    // is 130x220, so shift up-left by half-width and
                    // full-height to land on the floor at the position.
                    transform: "translate(-50%, -100%)",
                    zIndex: 4,
                  }}
                >
                  <JamCharacter
                    slotId={slot.id}
                    slotIndex={slotIndex}
                    character={character}
                    sound={sound}
                    muted={state.muted}
                    volume={state.volume}
                    hypeLine={hypeLines[slot.id] ?? null}
                    onDropSound={(soundId) => handleDrop(slot.id, soundId)}
                    onTap={() => state.soundId && handleMuteToggle(slot.id)}
                    onLongPress={() => state.soundId && handleSlotTap(slot.id)}
                    dragOver={dragOverSlot === slot.id}
                    onDragEnter={() => setDragOverSlot(slot.id)}
                    onDragLeave={() => setDragOverSlot((s) => (s === slot.id ? null : s))}
                    accessory={activeCombo?.accessory ?? null}
                  />
                </div>
              );
            })}

            {/* Player + mic stand — the lead vocalist. Renders the
             *  player-character.png sprite over a compact mic stand.
             *  Slightly larger than the band slots so the lead reads
             *  as the star. Audio-reactive bob driven by the master
             *  audio frame. */}
            <div
              style={{
                position: "absolute",
                left: `${PLAYER_POS.x}%`,
                top:  `${PLAYER_POS.y}%`,
                transform: "translate(-50%, -100%)",
                zIndex: 5,   // in front of the band
              }}
            >
              <PlayerAtMic active={playing} />
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
                anchorLeft={controlAnchor.left}
                anchorTop={controlAnchor.top}
                onMuteToggle={() => handleMuteToggle(openControls)}
                onVolume={(v) => handleVolume(openControls, v)}
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
          bpm={JAM_BPM}
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
  const [phase,   setPhase]   = useState<"ready" | "recording" | "scoring" | "error">("ready");
  const [error,   setError]   = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // 4 bars at the master BPM = recordSecs. Quick capture; long enough
  // to phrase a hook, short enough to feel snappy.
  const recordSecs = (60 / bpm) * 4 * 4; // beats × bars

  async function handleStart() {
    setError(null);
    setPhase("recording");
    setElapsed(0);
    const startMs = Date.now();
    const tick = setInterval(() => {
      const s = (Date.now() - startMs) / 1000;
      setElapsed(s);
      if (s >= recordSecs) clearInterval(tick);
    }, 50);

    try {
      const { buffer } = await recordVocal(recordSecs, () => { /* no VU for now */ });
      clearInterval(tick);
      setPhase("scoring");
      onRecorded(buffer);
    } catch (e) {
      clearInterval(tick);
      setPhase("error");
      setError(e instanceof Error ? e.message : "recording failed");
    }
  }

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
        <div style={{ fontSize: 48, marginBottom: 8 }}>🎤</div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 22,
            color: "#fff",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          {phase === "ready"     ? "RECORD YOUR VOICE"
            : phase === "recording" ? "RECORDING…"
            : phase === "scoring"   ? "DONE!"
            : "OOPS"}
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
          {phase === "ready"
            ? `we'll capture ${recordSecs.toFixed(1)}s @ ${bpm} bpm — sing or rap, then it loops on your character`
            : phase === "recording"
              ? `${Math.max(0, recordSecs - elapsed).toFixed(1)}s left`
              : phase === "scoring"
                ? "looping it onto the character now…"
                : (error ?? "couldn't access the microphone")}
        </p>

        {phase === "recording" && (
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 2,
              overflow: "hidden",
              margin: "0 0 16px",
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
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {phase === "ready" && (
            <>
              <button
                onClick={handleStart}
                style={{
                  padding: "10px 18px",
                  borderRadius: 14,
                  border: "2px solid #0a0f1c",
                  background: "linear-gradient(180deg, #ff7a8e, #b8253a)",
                  color: "#fff",
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 14,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45)",
                }}
              >
                START RECORDING
              </button>
              <button
                onClick={onCancel}
                style={{
                  padding: "10px 16px",
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
                }}
              >
                cancel
              </button>
            </>
          )}
          {phase === "error" && (
            <button
              onClick={onCancel}
              style={{
                padding: "10px 18px",
                borderRadius: 14,
                border: "2px solid #0a0f1c",
                background: "linear-gradient(180deg, #4a4a4a, #2a2a2a)",
                color: "#fff",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 14,
                letterSpacing: 0.5,
                cursor: "pointer",
              }}
            >
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* LockedSlot was removed when the band became 4-of-4 in the Crib layout.
 * Future progression (additional characters / unlocks) will use a
 * different visual treatment that fits the iso room — likely a fade-in
 * silhouette pre-spawning at its floor position rather than a separate
 * placeholder tile. */
