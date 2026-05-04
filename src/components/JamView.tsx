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
import {
  assignSlot,
  clearSlot,
  setSlotVolume,
  setSlotMuted,
  clearAllSlots,
} from "../audio/jamEngine";
import { ensureAudio } from "../audio/engine";
import { C } from "../ui/burst/tokens";

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
    setSlotState((prev) => ({
      ...prev,
      [slotId]: { soundId, muted: false, volume: 1.0 },
    }));
    setDragOverSlot(null);
    // Make sure audio is unlocked (drag isn't a tap, but this mirrors
    // the click-to-play unlock; on iOS the drop event still counts as
    // user activation).
    try { await ensureAudio(); } catch { /* ignore */ }
    await assignSlot(slotId, soundId, JAM_BPM);
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
          {/* Studio backdrop — same scene used on the home stage. We
           *  point its bottomPct lower because the characters stand
           *  further from the bottom edge here. */}
          <div style={{ position: "absolute", inset: 0 }}>
            <StudioScene>
              {/* Don't render the home mascot — characters are placed
               *  manually below as a row on the stage floor. The
               *  StudioScene component renders backdrop + room art
               *  regardless of its children. */}
              <div />
            </StudioScene>
          </div>

          {/* Character row — three slots in a row, vertically anchored
           *  near the bottom-third where the stage floor lives. */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: "8%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 32,
              zIndex: 4,
            }}
          >
            {DEFAULT_SLOTS.map((slot) => {
              const state = slotState[slot.id];
              const sound = state.soundId ? soundsById.get(state.soundId) ?? null : null;
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

            {/* Locked 4th slot — visual hint that the player will
             *  eventually unlock more characters as they level up. */}
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
            const sound = state?.soundId ? soundsById.get(state.soundId) ?? null : null;
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LockedSlot — a visual placeholder showing future-progression slots.        */
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
