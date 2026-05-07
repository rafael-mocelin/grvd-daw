/**
 * BandSlotV2 — single slot on the v2 jam stage.
 *
 * Differences from v1 BandSlot:
 *   - Empty by default. No character is bound to the slot ahead of
 *     time; the slot is just a dropzone that any character can land in.
 *   - When filled, renders the assigned character by cycling through
 *     its frame list at one frame per beat. Frame counts vary per
 *     character (2 / 3 / 4) — we just modulo into the array.
 *   - No accept-kind restriction. Any character / soundId is welcome.
 *     Drop on a filled slot replaces the assignment.
 *
 * Audio assignment + playback is still owned by JamView via the existing
 * jamEngine. This component is purely the visual + interaction shell.
 */

import { useEffect, useRef, useState } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";
import { getCharV2BySoundId } from "../../data/jamCharactersV2";

interface BandSlotV2Props {
  slotId:        string;
  /** Currently-assigned soundId for this slot, or null when empty.
   *  Resolves to a character via getCharV2BySoundId. */
  soundId:       string | null;
  muted:         boolean;
  volume:        number;
  /** True when the master transport is running. Drives the frame cycle. */
  playing:       boolean;
  /** Master BPM — drives the frame-swap cadence. */
  bpm:           number;
  /** Optional speech-bubble text. Parent owns the timer that clears it. */
  hypeLine?:     string | null;
  onDropSound:   (soundId: string) => void;
  onTap:         () => void;
  onLongPress:   () => void;
  dragOver:      boolean;
  onDragEnter:   () => void;
  onDragLeave:   () => void;
  /** Render size in px — square. Default 200. */
  size?:         number;
}

const LONG_PRESS_MS = 320;

export function BandSlotV2({
  slotId,
  soundId,
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
}: BandSlotV2Props) {
  const char    = soundId ? getCharV2BySoundId(soundId) : undefined;
  const filled  = !!char;
  const animating = filled && !muted && playing;
  const sparks  = volume > 1.2 && !muted;

  // ── Frame cycle ──
  // setInterval ticks at one beat (master BPM), advancing the frame
  // index. When animating stops we park on frame 0 (the idle pose,
  // or first frame for characters without an explicit idle).
  const [frameIdx, setFrameIdx] = useState(0);
  const frameCount = char?.frames.length ?? 1;
  useEffect(() => {
    if (!animating) {
      setFrameIdx(0);
      return;
    }
    const beatMs = (60 / bpm) * 1000;
    const id = window.setInterval(() => {
      setFrameIdx((i) => (i + 1) % frameCount);
    }, beatMs);
    return () => window.clearInterval(id);
  }, [animating, bpm, frameCount]);

  // ── Audio-reactive subtle bob ──
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
        const dy    = -o * 5;
        const scale = 1 + k * 0.05;
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

  // ── Tap vs long-press ──
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

  // ── Drag-drop ──
  // Accept any soundId; parent (JamView) decides what to do with it
  // (assign, replace, ignore vocal sentinel for band slots).
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
      onContextMenu={(e) => {
        // Block the browser's native menu; route right-click to
        // long-press semantics (open the controls popover) when filled.
        e.preventDefault();
        if (filled) onLongPress();
      }}
      style={{
        position: "relative",
        width:  size,
        height: size,
        cursor: filled ? "pointer" : "default",
        filter: dragOver
          ? "drop-shadow(0 0 18px rgba(34, 211, 238, 0.95)) drop-shadow(0 6px 8px rgba(0, 0, 0, 0.6))"
          : filled
            ? "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))"
            : "none",
        opacity: filled ? (muted ? 0.72 : 1) : 1,
        transition: "opacity 0.25s ease, filter 0.18s",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
      data-slot-id={slotId}
    >
      {filled && char ? (
        <img
          ref={imgRef}
          src={char.frames[frameIdx]}
          alt=""
          draggable={false}
          style={{
            width:  size,
            height: size,
            objectFit: "contain",
            // Always-on breathing idle.
            animation: "bandSlotV2Breathe 2.6s ease-in-out infinite",
            willChange: "transform",
            transform: "translate(0, 0) scale(1)",
            userSelect: "none",
            WebkitUserSelect: "none",
            pointerEvents: "none",
          }}
        />
      ) : (
        // Empty slot — clean dashed circle. No fake silhouette so the
        // player knows the slot is open and any character can land.
        <EmptyDropzone dragOver={dragOver} />
      )}

      {/* Loud-volume sparks */}
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

      <SharedBandV2Keyframes />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty dropzone visual                                                       */
/* -------------------------------------------------------------------------- */

function EmptyDropzone({ dragOver }: { dragOver: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width:  "78%",
          height: "78%",
          borderRadius: "50%",
          border: `2.5px dashed ${dragOver ? "rgba(34, 211, 238, 0.85)" : "rgba(255,255,255,0.22)"}`,
          background: dragOver
            ? "rgba(34, 211, 238, 0.06)"
            : "rgba(255, 255, 255, 0.02)",
          display: "grid",
          placeItems: "center",
          animation: dragOver ? undefined : "bandSlotV2Pulse 2.2s ease-in-out infinite",
          transition: "border-color 0.18s, background 0.18s",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: dragOver ? "#22d3ee" : "rgba(255,255,255,0.5)",
            textTransform: "uppercase",
            textAlign: "center",
            lineHeight: 1.4,
          }}
        >
          {dragOver ? "drop here" : "drag a\ncharacter"}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HypeBubble                                                                  */
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
        animation: "bandHypeV2Pop 1.6s cubic-bezier(.34,1.56,.64,1) forwards",
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

/* -------------------------------------------------------------------------- */
/* Shared keyframes                                                            */
/* -------------------------------------------------------------------------- */

function SharedBandV2Keyframes() {
  return (
    <style>{`
      @keyframes bandSlotV2Breathe {
        0%, 100% { transform: translate(0, 0)    scale(1);    }
        50%      { transform: translate(0, -3px) scale(1.01); }
      }
      @keyframes bandSlotV2Pulse {
        0%, 100% { opacity: 0.55; transform: scale(1);    }
        50%      { opacity: 0.95; transform: scale(1.03); }
      }
      @keyframes bandHypeV2Pop {
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
