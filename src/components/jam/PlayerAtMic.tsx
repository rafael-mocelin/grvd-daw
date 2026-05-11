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

import { useEffect, useRef, useState } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface PlayerAtMicProps {
  /** When true, the player slot reacts to audio (subtle bob + pulse). */
  active:        boolean;
  /** True if a vocal recording is currently assigned to the player slot. */
  filled:        boolean;
  /** True if the player's vocal is currently muted — fades the sprite
   *  the same way the band slots fade when muted. */
  muted:         boolean;
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
  /** Sprite render size in px (square). The wrapper renders slightly
   *  taller than `size` to fit the mic stand base + label. Driven by
   *  JamView from the measured room size so the player scales with the
   *  viewport. Default 250 keeps prior behaviour for any caller that
   *  hasn't been migrated. */
  size?:         number;
  /** Drag-to-reposition. Fired on release of a drag past the
   *  threshold; JamView snaps to grid and updates playerPos. */
  onMove?:       (clientX: number, clientY: number) => void;
}

const LONG_PRESS_MS  = 320;
const DRAG_THRESHOLD = 6;

export function PlayerAtMic({
  active,
  filled,
  muted,
  dragOver,
  onDropSound,
  onDragEnter,
  onDragLeave,
  onTap,
  onLongPress,
  size = 250,
  onMove,
}: PlayerAtMicProps) {
  // Sprite is square at `size`. The wrapper extends slightly taller so
  // the mic stand base + "YOU" label sit below the sprite. All
  // downstream pixel constants (mic stand dims, label offset, etc.) are
  // derived from `size` so the player scales as a single unit.
  const playerW    = size;
  const playerH    = size;
  const labelLane  = Math.round(size * 0.11);             // ~ 28 at 250
  const wrapperH   = playerH + labelLane;
  const micWidth   = Math.round(size * 0.13);             // ~ 32 at 250
  const micHeight  = Math.round(size * 0.52);             // ~ 130 at 250
  const micBottom  = labelLane;                            // align mic base to label lane top
  const labelFont  = Math.max(8, Math.round(size * 0.036)); // ~ 9 at 250
  const labelWidth = Math.round(size * 0.22);             // ~ 56 at 250
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

  // ── Tap / long-press / drag-to-reposition ──
  // The player slot is always present once placed (no "empty"
  // state), so drag is gated only on having `onMove` wired. Below
  // DRAG_THRESHOLD movement, the gesture collapses to a tap (mute
  // toggle) or a long-press (open controls); past it, the player
  // sprite follows the pointer and lands wherever they release.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const dragRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    longPressFiredRef.current = false;
    dragRef.current = { active: true, moved: false, startX: e.clientX, startY: e.clientY };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    clearLongPressTimer();
    // Long-press fires whether or not a vocal is assigned — the
    // parent maps it to "open recorder" when empty and "open
    // controls" when filled.
    longPressTimerRef.current = window.setTimeout(() => {
      if (dragRef.current.active && !dragRef.current.moved) {
        longPressFiredRef.current = true;
        onLongPress();
      }
    }, LONG_PRESS_MS);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const ref = dragRef.current;
    if (!ref.active) return;
    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;
    if (!ref.moved && Math.hypot(dx, dy) <= DRAG_THRESHOLD) return;
    if (!ref.moved) {
      ref.moved = true;
      clearLongPressTimer();
    }
    if (onMove) setDragOffset({ dx, dy });
  }
  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    clearLongPressTimer();
    if (wasDrag) {
      setDragOffset(null);
      if (onMove) onMove(e.clientX, e.clientY);
      return;
    }
    // Tap always fires — parent maps it to "open recorder" when
    // empty and "toggle mute" when filled.
    if (!longPressFiredRef.current) onTap();
  }
  function handlePointerCancel() {
    dragRef.current.active = false;
    setDragOffset(null);
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
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: "relative",
        width:  playerW,
        // Extra height for the mic stand base + 'YOU' label below.
        height: wrapperH,
        // Drop-target halo when something's hovering over this slot,
        // or a brighter gold halo while the player is being dragged
        // around the room.
        filter: dragOffset
          ? "drop-shadow(0 0 22px rgba(255, 230, 90, 0.85)) drop-shadow(0 10px 12px rgba(0, 0, 0, 0.6))"
          : dragOver
            ? "drop-shadow(0 0 18px rgba(255, 77, 156, 0.95)) drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))"
            : "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))",
        cursor: dragOffset ? "grabbing" : (filled ? "pointer" : "default"),
        // Muted = faded same as band slots, so the player's mute state
        // reads at a glance.
        opacity: filled ? (muted ? 0.72 : 1) : 1,
        transform: dragOffset
          ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)`
          : undefined,
        transition: dragOffset
          ? "none"
          : "opacity 0.25s ease, filter 0.18s",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        zIndex: dragOffset ? 10 : undefined,
      }}
      onContextMenu={(e) => {
        // Block the browser's native context menu (Save Image, Inspect)
        // and route the right-click to long-press instead — handy
        // alternative to the existing pointer-hold gesture for desktop.
        // Fires regardless of `filled`: an empty player opens the
        // recorder (parent maps long-press to recordingForSlot), a
        // filled player opens the controls popover.
        e.preventDefault();
        onLongPress();
      }}
      aria-label="player — drop the mic to record your voice"
    >
      {/* Mic stand — small, sits in front of the player sprite. */}
      <Mic width={micWidth} height={micHeight} bottom={micBottom} />

      {/* Player sprite */}
      <img
        ref={spriteRef}
        src="/characters/player-guy/player-character.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          bottom:  labelLane,
          left:    0,
          width:   playerW,
          height:  playerH,
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
          bottom: Math.max(2, Math.round(labelLane * 0.22)),
          left: "50%",
          marginLeft: -labelWidth / 2,
          width: labelWidth,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: labelFont,
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
/* Mic — compact CSS mic stand placed in front of the player sprite. All      */
/* internal dimensions are computed as fractions of the prop-driven `width`   */
/* and `height` so the stand scales 1:1 with the player sprite.               */
/* -------------------------------------------------------------------------- */

interface MicProps {
  width:  number;
  height: number;
  /** Distance from the player wrapper's bottom edge — aligns the stand
   *  base with the label lane that sits beneath the sprite. */
  bottom: number;
}

function Mic({ width, height, bottom }: MicProps) {
  // Derived parts. Original constants @ 32×130 are the reference; we
  // keep the same proportional relationships at any size.
  const baseW   = Math.max(8,  Math.round(width  * 0.875));   // 28 / 32
  const baseH   = Math.max(4,  Math.round(height * 0.077));   // 10 / 130
  const shaftW  = Math.max(2,  Math.round(width  * 0.094));   // 3  / 32
  const shaftH  = Math.max(20, Math.round(height * 0.769));   // 100/ 130
  const headW   = Math.max(8,  Math.round(width  * 0.625));   // 20 / 32
  const headH   = Math.max(10, Math.round(height * 0.20));    // 26 / 130
  const dotSize = Math.max(3,  Math.round(height * 0.031));   // 4  / 130

  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left:   "50%",
        marginLeft: -width / 2,
        width,
        height,
        zIndex: 2,
        filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))",
        pointerEvents: "none",
      }}
    >
      <div style={{
        position: "absolute", bottom: 0, left: "50%", marginLeft: -baseW / 2,
        width: baseW, height: baseH, borderRadius: "50%",
        background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
        border: "1.5px solid #0a0f1c",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18)",
      }} />
      <div style={{
        position: "absolute", bottom: Math.round(baseH * 0.6),
        left: "50%", marginLeft: -shaftW / 2,
        width: shaftW, height: shaftH,
        background: "linear-gradient(90deg, #0a0a14 0%, #2a2a32 50%, #0a0a14 100%)",
        borderRadius: shaftW / 2,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
      }} />
      <div style={{
        position: "absolute", top: 0, left: "50%", marginLeft: -headW / 2,
        width: headW, height: headH,
        background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
        border: "2px solid #0a0f1c",
        borderRadius: "11px 11px 50% 50% / 13px 13px 80% 80%",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), 0 2px 0 rgba(0,0,0,0.4)",
      }}>
        <div style={{
          position: "absolute", top: 2, left: 2, right: 2, height: Math.round(headH * 0.46),
          background: "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.28), rgba(255,255,255,0) 70%)",
          borderRadius: "10px 10px 50% 50% / 10px 10px 60% 60%",
        }} />
        <div style={{
          position: "absolute", bottom: Math.round(headH * 0.15),
          left: "50%", marginLeft: -dotSize / 2,
          width: dotSize, height: dotSize, borderRadius: "50%",
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
