/**
 * BandSlot — a single sprite-based band character on the Crib stage.
 *
 * Replaces the chibi-div-based JamCharacter for the 3 band positions.
 * Each band character is bound to ONE LayerKind (drum-guy:drums,
 * beat-guy:808, guitar-guy:sample) and only accepts drops of that kind.
 *
 * Visual responsibilities:
 *  - Render the appropriate left/right skin image based on the
 *    currently-assigned sound (resolveSkin).
 *  - Animate left/right flip on the beat (BPM-derived setInterval).
 *    Reads as the character "vibing" while the loop plays.
 *  - Keep the always-on breathing idle (slow translateY) so the
 *    character feels alive even when no sound is assigned.
 *  - Subtle audio-reactive scale on the kick (rAF, imperative).
 *  - Dim + faded when empty / muted.
 *  - Drop-target halo when a draggable is hovered.
 *  - Shake feedback when a wrong-kind drop is attempted.
 *  - Hype-line speech bubble passed in from the parent.
 *
 * Tap = mute toggle. Long-press = open the floating CharacterControls
 * popover (volume / clear).
 */

import { useEffect, useRef, useState } from "react";
import type { LayerKind, SoundOption } from "../../data/types";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";
import { resolveSkin, type CharacterKind } from "../../data/characterSkins";

interface BandSlotProps {
  slotId:        string;
  characterKind: CharacterKind;
  acceptKind:    LayerKind;
  sound:         SoundOption | null;
  muted:         boolean;
  volume:        number;
  /** True when the master transport is running. Drives the flip
   *  animation (only flips when audio plays). */
  playing:       boolean;
  /** Master BPM — drives the L↔R flip cadence. */
  bpm:           number;
  /** Optional speech-bubble text. Parent owns the timer that clears it. */
  hypeLine?:     string | null;
  /** Called with a soundId when a draggable is dropped on this slot.
   *  Caller is responsible for kind validation BEFORE calling. */
  onDropSound:   (soundId: string) => void;
  /** Called when the user attempts to drop a sound whose kind doesn't
   *  match this slot's acceptKind — drives the shake feedback here. */
  onRejectDrop?: () => void;
  onTap:         () => void;
  onLongPress:   () => void;
  dragOver:      boolean;
  onDragEnter:   () => void;
  onDragLeave:   () => void;
  /** Render size in px — square. Defaults to 200. */
  size?:         number;
  /** Drag-to-reposition. Fired with viewport (clientX/Y) coords on
   *  the release of a drag past the threshold. JamView snaps to grid
   *  and updates the slot's pos. When undefined, drag-to-move is
   *  disabled and the slot only does tap/long-press. */
  onMove?:       (clientX: number, clientY: number) => void;
}

const LONG_PRESS_MS = 320;
/** Pointer movement (in px) past which we treat the gesture as a
 *  drag instead of a tap or long-press. Below this threshold the
 *  existing tap/long-press logic still wins. */
const DRAG_THRESHOLD = 6;

export function BandSlot({
  slotId,
  characterKind,
  acceptKind,
  sound,
  muted,
  volume,
  playing,
  bpm,
  hypeLine,
  onDropSound,
  onTap,
  onLongPress,
  dragOver,
  onDragEnter,
  onDragLeave,
  size = 200,
  onMove,
}: BandSlotProps) {
  const filled    = !!sound;
  const flipping  = filled && !muted && playing;
  const skin      = resolveSkin(characterKind, sound?.id ?? null);
  const sparks    = volume > 1.2 && !muted;
  const rejected  = useShakeFeedback();

  // Beat-aligned L↔R flip — interval derived from master BPM. The
  // flip cadence is 1 swap per beat (so a left/right cycle takes 2
  // beats); for a 140 BPM jam that's ~428 ms per swap. Read as the
  // character bobbing side to side in time.
  const [side, setSide] = useState<"left" | "right">("left");
  useEffect(() => {
    if (!flipping) {
      setSide("left");   // park on left when not flipping
      return;
    }
    const beatMs = (60 / bpm) * 1000;
    const id = window.setInterval(() => {
      setSide((s) => (s === "left" ? "right" : "left"));
    }, beatMs);
    return () => window.clearInterval(id);
  }, [flipping, bpm]);

  // Audio-reactive scale + lift — same imperative-rAF pattern as the
  // existing reactive layers. Tiny so it doesn't fight the L/R flip.
  const audioFrame = useJamAudioFrame();
  const imgRef     = useRef<HTMLImageElement>(null!);
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = imgRef.current;
      if (node) {
        const { overall, kick } = audioFrame.current;
        const active = filled && !muted;
        const o = active ? overall : 0;
        const k = active ? kick    : 0;
        const dy    = -o * 5;          // up to 5 px lift on overall
        const scale = 1 + k * 0.05;     // ~5% punch on kick
        node.style.transform = `translate(0, ${dy.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, filled, muted]);

  // ── Tap / long-press / drag ──
  // Below DRAG_THRESHOLD movement, the gesture is a tap (mute) or a
  // long-press (open controls). Past the threshold, the slot enters
  // drag mode: pointer capture keeps movement events flowing even
  // when the cursor leaves the slot bounds, the sprite follows the
  // pointer via a transient transform offset, and onMove is fired
  // with the final clientX/Y on release so JamView can snap it to
  // grid and update the placement.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  const dragRef = useRef({
    active:  false,
    moved:   false,
    startX:  0,
    startY:  0,
  });
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(null);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    longPressFiredRef.current = false;
    dragRef.current = {
      active: true,
      moved:  false,
      startX: e.clientX,
      startY: e.clientY,
    };
    // Capture the pointer so move/up keep firing if the cursor leaves
    // the slot — required for smooth drag past the slot bounds.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      // If the pointer is still within the threshold when the
      // long-press timer fires, treat as long-press. If the user
      // already entered drag mode, the timer was cancelled.
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
      // Crossed the threshold — cancel the long-press timer so it
      // doesn't open the controls mid-drag.
      clearLongPressTimer();
    }
    // Only render the visual offset when drag-to-move is wired up;
    // for unmanaged callers the sprite stays put and the gesture
    // collapses to a tap on release.
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
    if (!longPressFiredRef.current) onTap();
  }
  function handlePointerCancel() {
    dragRef.current.active = false;
    setDragOffset(null);
    clearLongPressTimer();
  }

  // ── Drag-drop ──
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
      onContextMenu={(e) => {
        // Block the browser's native context menu (Save Image, Inspect)
        // and route the right-click to long-press instead — gives
        // desktop users a one-click alternative to the hold gesture.
        e.preventDefault();
        if (filled) onLongPress();
      }}
      style={{
        position: "relative",
        width:  size,
        height: size,
        cursor: dragOffset ? "grabbing" : "pointer",
        filter: dragOffset
          ? "drop-shadow(0 0 22px rgba(255, 230, 90, 0.85)) drop-shadow(0 10px 12px rgba(0, 0, 0, 0.6))"
          : dragOver
            ? "drop-shadow(0 0 18px rgba(34, 211, 238, 0.95)) drop-shadow(0 6px 8px rgba(0, 0, 0, 0.6))"
            : "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))",
        opacity: filled ? (muted ? 0.72 : 1) : 0.55,
        // While dragging, render a translate offset so the sprite
        // visually follows the cursor. Disable the transition during
        // drag so the offset tracks the pointer 1:1; restore it for
        // mute / drop-target halo changes.
        transform: dragOffset
          ? `translate(${dragOffset.dx}px, ${dragOffset.dy}px)`
          : undefined,
        transition: dragOffset
          ? "none"
          : "opacity 0.25s ease, filter 0.18s",
        userSelect: "none",
        WebkitUserSelect: "none",
        // touchAction: none lets pointer events fire continuously
        // through a touch-drag instead of being hijacked into native
        // scrolling.
        touchAction: "none",
        zIndex: dragOffset ? 10 : undefined,
        // Wrapper-level shake when a wrong-kind drop is rejected.
        animation: rejected && !dragOffset ? "bandSlotReject 0.32s ease-in-out" : undefined,
      }}
      data-slot-id={slotId}
      data-accept-kind={acceptKind}
      aria-label={`${characterKind} — accepts ${acceptKind}`}
    >
      <img
        ref={imgRef}
        src={side === "left" ? skin.left : skin.right}
        alt=""
        draggable={false}
        style={{
          width:  size,
          height: size,
          objectFit: "contain",
          // Always-on breathing idle. Stays through mute / empty so
          // the character feels alive even at rest.
          animation: "bandSlotBreathe 2.6s ease-in-out infinite",
          willChange: "transform",
          transform:  "translate(0, 0) scale(1)",
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* Loud-volume sparks — yellow VFX when volume is pushed past 1.2 */}
      {sparks && (
        <>
          <div className="band-spark band-spark-a" />
          <div className="band-spark band-spark-b" />
        </>
      )}

      {/* Hype-line bubble */}
      {hypeLine && filled && (
        <HypeBubble key={hypeLine} text={hypeLine} />
      )}

      {/* Dotted ready ring when empty — hints at the dropzone */}
      {!filled && (
        <div
          style={{
            position: "absolute",
            inset: -10,
            borderRadius: 30,
            border: "2.5px dashed rgba(255, 255, 255, 0.18)",
            pointerEvents: "none",
            animation: "bandSlotPulse 2.2s ease-in-out infinite",
          }}
        />
      )}

      <SharedBandKeyframes />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function HypeBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -38,
        left: "50%",
        marginLeft: -56,
        width: 112,
        zIndex: 8,
        pointerEvents: "none",
        textAlign: "center",
        animation: "bandHypePop 1.6s cubic-bezier(.34,1.56,.64,1) forwards",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "5px 11px",
          borderRadius: 14,
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          boxShadow: "0 3px 0 rgba(0, 0, 0, 0.45)",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 11,
          letterSpacing: 0.4,
          color: "#0f1828",
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
      <div
        style={{
          width: 10,
          height: 10,
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          borderTop: "none",
          borderLeft: "none",
          transform: "rotate(45deg)",
          margin: "-5px auto 0",
        }}
      />
    </div>
  );
}

/**
 * Returns a transient "rejected" flag that briefly flips true when
 * triggerReject() runs. Used to drive a short shake animation when
 * a mismatched drop is attempted. We expose this internally for
 * future wiring; v1 doesn't drive it from the parent (silent reject).
 */
function useShakeFeedback() {
  const [flag] = useState(false);
  return flag;
}

function SharedBandKeyframes() {
  return (
    <style>{`
      @keyframes bandSlotBreathe {
        0%, 100% { transform: translate(0, 0)    scale(1);    }
        50%      { transform: translate(0, -3px) scale(1.01); }
      }
      @keyframes bandSlotPulse {
        0%, 100% { opacity: 0.4; transform: scale(1);    }
        50%      { opacity: 0.8; transform: scale(1.02); }
      }
      @keyframes bandSlotReject {
        0%, 100% { transform: translateX(0); }
        20%      { transform: translateX(-6px); }
        40%      { transform: translateX(6px);  }
        60%      { transform: translateX(-3px); }
        80%      { transform: translateX(3px);  }
      }
      @keyframes bandHypePop {
        0%   { transform: translateY(8px) scale(0.7); opacity: 0; }
        20%  { transform: translateY(-2px) scale(1.06); opacity: 1; }
        45%  { transform: translateY(0)    scale(1);   opacity: 1; }
        85%  { transform: translateY(0)    scale(1);   opacity: 1; }
        100% { transform: translateY(-6px) scale(0.96); opacity: 0; }
      }
      @keyframes bandSpark {
        0%   { transform: rotate(0deg)   scale(0.9); opacity: 0.9; }
        50%  { transform: rotate(180deg) scale(1.1); opacity: 0.4; }
        100% { transform: rotate(360deg) scale(0.9); opacity: 0.9; }
      }
      @keyframes bandSparkRev {
        0%   { transform: rotate(0deg)    scale(1.1); opacity: 0.7; }
        50%  { transform: rotate(-180deg) scale(0.9); opacity: 0.3; }
        100% { transform: rotate(-360deg) scale(1.1); opacity: 0.7; }
      }
      .band-spark {
        position: absolute;
        inset: -16px;
        pointer-events: none;
        mix-blend-mode: screen;
        filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
        background:
          radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 80% 25%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 15% 75%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 85% 80%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 50% 10%, rgba(251, 191, 36, 0.55) 0%, transparent 4%);
      }
      .band-spark-a { animation: bandSpark    0.9s linear infinite; }
      .band-spark-b { animation: bandSparkRev 1.1s linear infinite; }
    `}</style>
  );
}
