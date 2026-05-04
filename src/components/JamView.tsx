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
import { C } from "../ui/burst/tokens";

/**
 * Sentinel id passed in via the palette's "MIC" tile. The slot's
 * SoundOption stays null in state (since it's not a catalog entry);
 * the slot value is the recorded buffer instead.
 */
const VOCAL_DROP_ID = "__vocal__";

/**
 * Three default characters, each with a distinct hoodie color so they
 * read as individuals on stage. Skin tones lightly varied too.
 */
const DEFAULT_SLOTS: { id: string; jacket: string; skin: string }[] = [
  { id: "slot-a", jacket: C.coral, skin: "#c08a5a" },
  { id: "slot-b", jacket: "#22d3ee", skin: "#a07050" },
  { id: "slot-c", jacket: C.gold,  skin: "#d4a988" },
];

/** Master BPM for the jam — drives all rate-stretching of the file loops. */
const JAM_BPM = 140;

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
           *  spotlights on hat, ambient tint on overall energy. Quiet
           *  when nothing is playing or the master is paused. */}
          <StagePulse active={playing && assignedIds.size > 0} />

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
            {DEFAULT_SLOTS.map((slot) => {
              const state = slotState[slot.id];
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
                  jacket={slot.jacket}
                  skin={slot.skin}
                  sound={sound}
                  muted={state.muted}
                  volume={state.volume}
                  onDropSound={(soundId) => handleDrop(slot.id, soundId)}
                  onTap={() => handleSlotTap(slot.id)}
                  dragOver={dragOverSlot === slot.id}
                  onDragEnter={() => setDragOverSlot(slot.id)}
                  onDragLeave={() => setDragOverSlot((s) => (s === slot.id ? null : s))}
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
        width: 130,
        height: 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        border: "2.5px dashed rgba(255,255,255,0.18)",
        borderRadius: 24,
        background: "rgba(0, 0, 0, 0.3)",
        opacity: 0.7,
      }}
      aria-label="locked slot — unlock more characters as you level up"
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
  );
}
