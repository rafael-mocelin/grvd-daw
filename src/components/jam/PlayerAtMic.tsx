/**
 * PlayerAtMic — the lead vocalist (the player) at the microphone.
 *
 * Renders the player-character.png sprite over a compact mic stand and
 * accepts mic / vocal drops. The actual recording-overlay flow is owned
 * by JamView (this component just signals the parent on drop).
 *
 * The player slot accepts only the VOCAL_DROP_ID sentinel from the
 * SoundPalette's MIC tile. Any other dropped soundId is silently
 * ignored. Once the player has a recorded vocal:
 *   - tap toggles mute
 *   - long-press opens the existing CharacterControls popover
 *
 * Asset path: /characters/player-guy/player-character.png (2000x2000 RGBA).
 */

import { useEffect, useRef } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface PlayerAtMicProps {
  /** When true, the player slot reacts to audio (subtle bob + pulse). */
  active:        boolean;
  /** True if a vocal recording is currently assigned to the player slot. */
  filled:        boolean;
  /** True while a draggable is hovered over the player. */
  dragOver:      boolean;
  /** Drop handler — receives the dragged soundId. Parent validates that
   *  it's the VOCAL_DROP_ID sentinel before opening the recorder. */
  onDropSound:   (soundId: string) => void;
  onDragEnter:   () => void;
  onDragLeave:   () => void;
  /** Tap = mute toggle (when filled). No-op when empty. */
  onTap:         () => void;
  /** Long-press = open the CharacterControls popover (when filled). */
  onLongPress:   () => void;
}

/** Sprite render size in px. The player should read as the star, so
 *  it sits visibly larger than the band slots (they default to 200). */
const PLAYER_HEIGHT = 250;
const PLAYER_WIDTH  = PLAYER_HEIGHT;

const LONG_PRESS_MS = 320;

export function PlayerAtMic({
  active,
  filled,
  dragOver,
  onDropSound,
  onDragEnter,
  onDragLeave,
  onTap,
  onLongPress,
}: PlayerAtMicProps) {
  const audioFrame = useJamAudioFrame();
  const spriteRef  = useRef<HTMLImageElement>(null!);

  // Subtle audio-reactive bob. Same imperative-rAF pattern as BandSlot.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = spriteRef.current;
      if (node) {
        const { overall, kick } = audioFrame.current;
        const o = active ? overall : 0;
        const k = active ? kick    : 0;
        const dy    = -o * 4;
        const scale = 1 + k * 0.04;
        node.style.transform = `translate(0, ${dy.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, active]);

  // ── Tap vs long-press — only relevant when a vocal is assigned. ──
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handlePointerDown() {
    if (!filled) return;
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function handlePointerUp() {
    if (!filled) return;
    clearLongPressTimer();
    if (!longPressFiredRef.current) onTap();
  }
  function handlePointerCancel() {
    clearLongPressTimer();
  }

  // ── Drag-drop wiring — accept any dataTransfer; JamView filters by
  //    sentinel id so only the MIC tile actually triggers a drop. ──
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/jam-sound-id");
    onDragLeave();
    if (id) onDropSound(id);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      style={{
        position: "relative",
        width:  PLAYER_WIDTH,
        // Extra height for the mic stand base + 'YOU' label below.
        height: PLAYER_HEIGHT + 28,
        // Drop-target halo when something's hovering over this slot.
        // JamView sets dragOver only when the dragged tile is the MIC,
        // so the halo also doubles as "yes this is the right slot."
        filter: dragOver
          ? "drop-shadow(0 0 18px rgba(255, 77, 156, 0.95)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))"
          : "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))",
        cursor: filled ? "pointer" : "default",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
      aria-label="player — drop the mic to record your voice"
    >
      {/* Mic stand — small, sits in front of the player sprite. */}
      <Mic />

      {/* Player sprite */}
      <img
        ref={spriteRef}
        src="/characters/player-guy/player-character.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          bottom:  28,
          left:    0,
          width:   PLAYER_WIDTH,
          height:  PLAYER_HEIGHT,
          objectFit: "contain",
          willChange: "transform",
          transform: "translate(0, 0) scale(1)",
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* "YOU" label */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: "50%",
          marginLeft: -28,
          width: 56,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255, 255, 255, 0.78)",
          textTransform: "uppercase",
          textShadow: "0 1px 0 rgba(0, 0, 0, 0.7)",
        }}
      >
        you
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mic — compact CSS mic stand placed in front of the player sprite.          */
/* -------------------------------------------------------------------------- */

function Mic() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 28,
        left:   "50%",
        marginLeft: -16,
        width:  32,
        height: 130,
        zIndex: 2,
        filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))",
        pointerEvents: "none",
      }}
    >
      <div style={{
        position: "absolute", bottom: 0, left: "50%", marginLeft: -14,
        width: 28, height: 10, borderRadius: "50%",
        background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
        border: "1.5px solid #0a0f1c",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18)",
      }} />
      <div style={{
        position: "absolute", bottom: 6, left: "50%", marginLeft: -1.5,
        width: 3, height: 100,
        background: "linear-gradient(90deg, #0a0a14 0%, #2a2a32 50%, #0a0a14 100%)",
        borderRadius: 1.5,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
      }} />
      <div style={{
        position: "absolute", top: 0, left: "50%", marginLeft: -10,
        width: 20, height: 26,
        background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
        border: "2px solid #0a0f1c",
        borderRadius: "11px 11px 50% 50% / 13px 13px 80% 80%",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), 0 2px 0 rgba(0,0,0,0.4)",
      }}>
        <div style={{
          position: "absolute", top: 2, left: 2, right: 2, height: 12,
          background: "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.28), rgba(255,255,255,0) 70%)",
          borderRadius: "10px 10px 50% 50% / 10px 10px 60% 60%",
        }} />
        <div style={{
          position: "absolute", bottom: 4, left: "50%", marginLeft: -2,
          width: 4, height: 4, borderRadius: "50%",
          background: "#E94560",
          boxShadow: "0 0 6px rgba(233, 69, 96, 0.85)",
          animation: "playerMicPulse 1.6s ease-in-out infinite",
        }} />
      </div>

      <style>{`
        @keyframes playerMicPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
