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
import { StudioScene } from "../ui/StudioScene";
import { JamCharacter } from "./jam/JamCharacter";
import { SoundPalette } from "./jam/SoundPalette";
import { CharacterControls } from "./jam/CharacterControls";
import { StagePulse } from "./jam/StagePulse";
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
 * The three starter slots map 1:1 to the three character configs in
 * JAM_CHARACTERS. Slot id stays stable across sessions so the engine's
 * per-slot audio chain doesn't have to be torn down on a config swap.
 */
const DEFAULT_SLOTS: { id: string; characterId: string }[] = [
  { id: "slot-a", characterId: "mochi" },
  { id: "slot-b", characterId: "neema" },
  { id: "slot-c", characterId: "royal" },
];

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
          {/* Studio backdrop — same scene used on the home stage but
           *  with the speakers and desk hidden. They were clipping the
           *  character row on this wider viewport and adding clutter
           *  the player can't interact with. */}
          <div style={{ position: "absolute", inset: 0 }}>
            <StudioScene hideSpeakers hideDesk>
              {/* Don't render the home mascot — characters are placed
               *  manually below as a row on the stage floor. */}
              <div />
            </StudioScene>
          </div>

          {/* Audio-reactive stage layer — floor glow on kick, corner
           *  spotlights on hat, ambient tint on overall energy, crowd
           *  appears at 3 filled slots. Quiet when nothing is playing
           *  or the master is paused; baseline brightness scales with
           *  assignedCount so the stage builds with the mix. */}
          <StagePulse
            active={playing && assignedIds.size > 0}
            assignedCount={assignedIds.size}
          />

          {/* Character row — three slots + a locked 4th tile, anchored
           *  ~30% up from the stage floor so the characters sit on the
           *  perspective wood instead of pressing against the bottom
           *  edge. (User requested: position 30 on a 0=bottom→100=top
           *  scale.) */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "30%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 32,
              alignItems: "flex-end",
              zIndex: 4,
            }}
          >
            {DEFAULT_SLOTS.map((slot, slotIndex) => {
              const state = slotState[slot.id];
              const character = characterFor(slot.characterId);
              // The vocal sentinel id ("__vocal__") doesn't exist in the
              // catalog map — render a synthetic SoundOption so the
              // character UI shows "MIC" instead of "—".
              const sound = state.soundId === VOCAL_DROP_ID
                ? VOCAL_PSEUDO_SOUND
                : (state.soundId ? soundsById.get(state.soundId) ?? null : null);
              return (
                <JamCharacter
                  key={slot.id}
                  slotId={slot.id}
                  slotIndex={slotIndex}
                  character={character}
                  sound={sound}
                  muted={state.muted}
                  volume={state.volume}
                  hypeLine={hypeLines[slot.id] ?? null}
                  onDropSound={(soundId) => handleDrop(slot.id, soundId)}
                  // Tap = instant mute toggle (Incredibox-style — keeps
                  // mute usable as a rhythm tool). Long-press opens the
                  // floating control popover for volume / clear.
                  onTap={() => state.soundId && handleMuteToggle(slot.id)}
                  onLongPress={() => state.soundId && handleSlotTap(slot.id)}
                  dragOver={dragOverSlot === slot.id}
                  onDragEnter={() => setDragOverSlot(slot.id)}
                  onDragLeave={() => setDragOverSlot((s) => (s === slot.id ? null : s))}
                  accessory={activeCombo?.accessory ?? null}
                />
              );
            })}

            {/* Locked 4th slot — restored inline. The previous version
             *  (corner pill) read as a footnote; the inline placeholder
             *  makes the progression promise feel more tangible. */}
            <LockedSlot />
          </div>

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

/* -------------------------------------------------------------------------- */
/* LockedSlot — placeholder tile rendered at the end of the character row to  */
/* hint at progression. Same width/height as a real character so the row     */
/* maintains its rhythm; dashed border + lock glyph signal "not yet".        */
/* -------------------------------------------------------------------------- */

function LockedSlot() {
  return (
    <div
      style={{
        position: "relative",
        width: 130,
        height: 220,
        border: "2.5px dashed rgba(255,255,255,0.18)",
        borderRadius: 24,
        background: "rgba(0, 0, 0, 0.3)",
        opacity: 0.85,
        overflow: "hidden",
        animation: "jamLockedGentlePulse 4.6s ease-in-out infinite",
      }}
      aria-label="locked slot — unlock more characters as you level up"
    >
      {/* Silhouette tease — a generic chibi shape that fades in/out
       *  periodically to hint at what's coming. Pure CSS, no animation
       *  while not visible. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0,
          animation: "jamLockedTease 22s ease-in-out infinite",
          pointerEvents: "none",
        }}
      >
        {/* shoulder block */}
        <div style={{
          position: "absolute",
          bottom: 30, left: "50%", marginLeft: -36,
          width: 72, height: 60,
          background: "rgba(255,255,255,0.08)",
          borderRadius: "16px 16px 10px 10px",
        }} />
        {/* head */}
        <div style={{
          position: "absolute",
          top: 36, left: "50%", marginLeft: -34,
          width: 68, height: 68,
          background: "rgba(255,255,255,0.10)",
          borderRadius: "50%",
        }} />
        {/* shoes */}
        <div style={{
          position: "absolute",
          bottom: 8, left: "50%", marginLeft: -28,
          width: 56, height: 12,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
        }} />
      </div>

      {/* Lock + label sit centered on top of the silhouette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.6 }}>🔒</div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          unlock<br />at lv 5
        </div>
      </div>

      <style>{`
        @keyframes jamLockedGentlePulse {
          0%, 100% { box-shadow: 0 0 0 rgba(255, 255, 255, 0); }
          50%      { box-shadow: 0 0 18px rgba(255, 255, 255, 0.10); }
        }
        @keyframes jamLockedTease {
          0%, 80%, 100% { opacity: 0; }
          88%           { opacity: 0.7; }
          92%           { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
