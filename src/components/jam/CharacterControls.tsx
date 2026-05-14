/**
 * CharacterControls — floating popover above a tapped Jam character.
 *
 * Sound cycler at top (left/right arrow swipe through the sibling
 * variants for the character's kind), then mute / volume / sync /
 * clear below.
 *
 * Renders via React Portal to document.body so the popover can
 * escape the stage's overflow:hidden and never gets clipped at the
 * room edges. Anchor coords are viewport-fixed; a useLayoutEffect
 * measures the popover after mount and shifts it horizontally /
 * flips it below the character if it would overflow the viewport.
 *
 * Tapping outside dismisses (transparent fixed backdrop covers the
 * whole window).
 */

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SoundOption } from "../../data/types";

/** One option for the sound-cycler row — sibling sounds the placed
 *  character can swap to. */
export interface SiblingSound {
  soundId: string;
  /** Display name (e.g. "vanessa"). */
  name:    string;
  /** Path to a still pose used as the thumbnail. */
  iconSrc: string;
}

interface CharacterControlsProps {
  sound:    SoundOption | null;
  muted:    boolean;
  volume:   number;
  /** Vocal slots only: whether the recording follows the master BPM
   *  (true) or stays at its recorded tempo (false). The toggle is
   *  rendered only when sound.kind === "vocal". */
  syncToBpm?:    boolean;
  onSyncToggle?: () => void;
  onMuteToggle: () => void;
  onVolume:     (v: number) => void;
  onClear:      () => void;
  onClose:      () => void;
  /** Sibling sound options for the character's kind. When provided
   *  alongside `currentSoundId` and `onSwap`, a row of thumbnails
   *  appears at the top of the popover so the player can swap sounds
   *  in place (skin + audio bus refresh together). */
  siblings?:       SiblingSound[];
  currentSoundId?: string;
  onSwap?:         (soundId: string) => void;
  /** Vocal-slot only — current autotune state. When provided alongside
   *  `onAutotuneChange`, a Tune + Effect row appears in the popover. */
  autotunePitch?:  number;
  autotuneEffect?: number;
  onAutotuneChange?: (params: { pitch?: number; effect?: number }) => void;
  /** Optional — wires a TRAIN button into the popover. Tapping it
   *  opens the character's DEN training station (DRUMMA for the
   *  drum-guy, etc.). Hidden when undefined. */
  onTrain?:        () => void;
  /** Anchor position in the parent's coord space (px from top-left). */
  anchorLeft: number;
  anchorTop:  number;
}

const POPOVER_W   = 220;
const VIEW_PAD    = 12;
const ANCHOR_GAP  = 16;

export function CharacterControls({
  sound, muted, volume, syncToBpm,
  onMuteToggle, onVolume, onSyncToggle, onClear, onClose,
  siblings, currentSoundId, onSwap,
  autotunePitch, autotuneEffect, onAutotuneChange,
  onTrain,
  anchorLeft, anchorTop,
}: CharacterControlsProps) {
  const isVocal = sound?.kind === "vocal";
  const showCycler = !isVocal && siblings && siblings.length > 1 && onSwap;

  // Active variant index — drives the arrow cycler. Falls back to 0
  // if the current soundId isn't found in the siblings list (rare;
  // happens during a transient state right after a swap).
  const currentIdx = showCycler
    ? Math.max(0, siblings!.findIndex((s) => s.soundId === currentSoundId))
    : 0;
  const totalVariants = showCycler ? siblings!.length : 0;
  const cyclerCurrent = showCycler ? siblings![currentIdx] : null;

  function cycleSwap(delta: 1 | -1) {
    if (!showCycler || !onSwap) return;
    const nextIdx = (currentIdx + delta + totalVariants) % totalVariants;
    onSwap(siblings![nextIdx].soundId);
  }

  // ── Viewport-clamp ──
  // After the popover renders, measure it and figure out where it
  // would land. Shift horizontally so it stays inside the viewport;
  // if anchored too close to the top, flip it BELOW the character.
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = rect.width  || POPOVER_W;
      const h = rect.height || 240;

      // Default: above the anchor, horizontally centered.
      let left = anchorLeft - w / 2;
      let top  = anchorTop - h - ANCHOR_GAP;
      let below = false;

      // Horizontal clamp.
      const minLeft = VIEW_PAD;
      const maxLeft = window.innerWidth - w - VIEW_PAD;
      if (left < minLeft) left = minLeft;
      else if (left > maxLeft) left = maxLeft;

      // If above the viewport, flip below the anchor (using the
      // anchor's slot height isn't known here; we approximate with a
      // small constant gap below the anchor's top).
      if (top < VIEW_PAD) {
        top = anchorTop + ANCHOR_GAP;
        below = true;
      }
      // Final vertical clamp.
      const maxTop = window.innerHeight - h - VIEW_PAD;
      if (top > maxTop) top = Math.max(VIEW_PAD, maxTop);

      setPos({ left, top, below });
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [anchorLeft, anchorTop, showCycler, totalVariants]);

  return createPortal(
    <>
      {/* Backdrop — captures outside-clicks to dismiss. Fully
       *  transparent so the room stays visible. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
        }}
      />

      <div
        ref={popRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: pos?.left ?? anchorLeft - POPOVER_W / 2,
          top:  pos?.top  ?? anchorTop - 240,
          // Avoid flicker on first paint before useLayoutEffect runs.
          visibility: pos ? "visible" : "hidden",
          zIndex: 210,
          width: POPOVER_W,
          padding: "12px 14px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 12px 28px rgba(0,0,0,0.5)",
          animation: "jamPanelPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* Header — sound name + remove + close. The trash button is
         *  prominent (red tint) so removal is discoverable; the X
         *  closes the popover without removing the character. */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{sound?.glyph ?? "🎵"}</span>
          <span
            style={{
              flex: 1,
              fontFamily: "'Lilita One', system-ui",
              fontSize: 14,
              color: "#fff",
              letterSpacing: 0.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sound?.name ?? "EMPTY SLOT"}
          </span>
          <button
            onClick={onClear}
            disabled={!sound}
            aria-label="remove character from room"
            title="remove from room"
            style={{
              width: 24, height: 24, borderRadius: 12,
              border: "1.5px solid rgba(233, 69, 96, 0.55)",
              background: "rgba(233, 69, 96, 0.18)",
              color: "#ff7a8e",
              fontSize: 13,
              cursor: sound ? "pointer" : "not-allowed",
              opacity: sound ? 1 : 0.4,
              padding: 0, lineHeight: 1,
              display: "grid",
              placeItems: "center",
              transition: "background 0.15s, border-color 0.15s, transform 0.1s",
            }}
            onMouseEnter={(e) => {
              if (sound) {
                e.currentTarget.style.background   = "rgba(233, 69, 96, 0.32)";
                e.currentTarget.style.borderColor  = "rgba(233, 69, 96, 0.85)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background  = "rgba(233, 69, 96, 0.18)";
              e.currentTarget.style.borderColor = "rgba(233, 69, 96, 0.55)";
            }}
          >
            🗑
          </button>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 24, height: 24, borderRadius: 12,
              border: "1.5px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Sound cycler — left arrow, big current thumbnail, right
         *  arrow. Cyclic. Scales to N variants without growing the
         *  popover. Hidden for vocal slots and kinds with only one
         *  option. */}
        {showCycler && cyclerCurrent && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.55)",
                  textTransform: "uppercase",
                }}
              >
                swap sound
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.10em",
                }}
              >
                {currentIdx + 1}/{totalVariants}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CycleArrow direction="prev" onClick={() => cycleSwap(-1)} />
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <div
                  key={cyclerCurrent.soundId}
                  style={{
                    width: 86,
                    aspectRatio: "1 / 1",
                    borderRadius: 12,
                    overflow: "hidden",
                    background: "radial-gradient(ellipse at 50% 110%, rgba(250, 204, 21, 0.22), rgba(15, 24, 40, 0.7) 70%)",
                    border: "2px solid #facc15",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 0 14px rgba(250, 204, 21, 0.45)",
                    display: "grid",
                    placeItems: "center",
                    animation: "jamCyclerSwap 0.22s ease-out both",
                  }}
                >
                  <img
                    src={cyclerCurrent.iconSrc}
                    alt=""
                    draggable={false}
                    style={{
                      width:  "120%",
                      height: "120%",
                      objectFit: "contain",
                      objectPosition: "center 65%",
                      pointerEvents: "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "'Lilita One', system-ui",
                    fontSize: 12,
                    color: "#facc15",
                    letterSpacing: 0.3,
                    textAlign: "center",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                    textShadow: "0 1px 0 rgba(0,0,0,0.6)",
                  }}
                >
                  {cyclerCurrent.name}
                </div>
              </div>
              <CycleArrow direction="next" onClick={() => cycleSwap(+1)} />
            </div>
          </div>
        )}

        {/* TRAIN button — opens the character's DEN training station.
         *  Only rendered when the parent wires onTrain (currently the
         *  drum-guy slot in JamView). Sits above mute so it reads as
         *  the "main action" once the player has a character placed. */}
        {onTrain && (
          <button
            onClick={onTrain}
            style={{
              width: "100%",
              padding: "10px 10px",
              marginBottom: 10,
              borderRadius: 12,
              border: "2px solid #0a0f1c",
              background: "linear-gradient(180deg, #c084fc, #7e22ce)",
              color: "#fff",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 13,
              letterSpacing: 0.6,
              cursor: "pointer",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 3px 0 rgba(0,0,0,0.45), 0 0 14px rgba(192, 132, 252, 0.6)",
            }}
          >
            🎮 TRAIN
          </button>
        )}

        {/* Mute toggle — chunky pill */}
        <button
          onClick={onMuteToggle}
          disabled={!sound}
          style={{
            width: "100%",
            padding: "9px 10px",
            marginBottom: 10,
            borderRadius: 12,
            border: "2px solid #0a0f1c",
            background: muted
              ? "linear-gradient(180deg, #4a4a4a, #2a2a2a)"
              : "linear-gradient(180deg, #ff7a8e, #b8253a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: sound ? "pointer" : "not-allowed",
            opacity: sound ? 1 : 0.4,
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.3), 0 3px 0 rgba(0,0,0,0.45)",
          }}
        >
          {muted ? "🙈 MUTED — TAP TO UNMUTE" : "🎤 MUTE"}
        </button>

        {/* Volume slider with VFX threshold marker */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Volume
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: volume > 1.2 ? "#facc15" : "#fff",
              }}
            >
              {volume > 1.2 ? "⚡ LOUD" : Math.round(volume * 100) + "%"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={volume}
            disabled={!sound}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            style={{
              width: "100%",
              accentColor: volume > 1.2 ? "#facc15" : "#E94560",
              opacity: sound ? 1 : 0.4,
            }}
          />
        </div>

        {/* Sync to BPM — vocal slots only. Toggles whether the
         *  recording rate-stretches with the master BPM (ON, pitch
         *  shifts) or stays at its recorded tempo (OFF). Default off
         *  so existing recordings don't change unexpectedly when the
         *  player nudges the master BPM. */}
        {/* AUTOTUNE — vocal-only. TUNE (-12..+12 semitones) shifts the
         *  pitch; EFFECT (0..1) blends in the chorus wash that gives
         *  the produced / autotuned character. Hidden when the slot
         *  isn't a vocal or the parent didn't wire the handler. */}
        {isVocal && onAutotuneChange && (
          <div
            style={{
              marginBottom: 10,
              padding: "8px 10px",
              borderRadius: 12,
              border: "2px solid rgba(192, 132, 252, 0.45)",
              background: "linear-gradient(180deg, rgba(192, 132, 252, 0.18), rgba(15, 24, 40, 0.55))",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 0 12px rgba(192, 132, 252, 0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 12,
                  color: "#e9d5ff",
                  letterSpacing: 0.4,
                }}
              >
                🎚 AUTOTUNE
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  letterSpacing: "0.10em",
                }}
              >
                T {((autotunePitch ?? 0) >= 0 ? "+" : "") + (autotunePitch ?? 0)}  ·  FX {Math.round((autotuneEffect ?? 0) * 100)}%
              </span>
            </div>
            {/* Tune (semitones) */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              tune
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={autotunePitch ?? 0}
              onChange={(e) => onAutotuneChange({ pitch: parseInt(e.target.value, 10) })}
              style={{
                width: "100%",
                accentColor: "#c084fc",
                marginBottom: 4,
              }}
            />
            {/* Effect (chorus wet) */}
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.55)",
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              effect
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={autotuneEffect ?? 0}
              onChange={(e) => onAutotuneChange({ effect: parseFloat(e.target.value) })}
              style={{
                width: "100%",
                accentColor: "#c084fc",
              }}
            />
          </div>
        )}

        {isVocal && onSyncToggle && (
          <button
            onClick={onSyncToggle}
            style={{
              width: "100%",
              padding: "9px 10px",
              marginBottom: 8,
              borderRadius: 12,
              border: "2px solid #0a0f1c",
              background: syncToBpm
                ? "linear-gradient(180deg, #6bf395, #16a34a)"
                : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
              color: syncToBpm ? "#0a0f1c" : "rgba(255,255,255,0.85)",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 12,
              letterSpacing: 0.5,
              cursor: "pointer",
              boxShadow: syncToBpm
                ? "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.45)"
                : "inset 0 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.35)",
            }}
            aria-pressed={syncToBpm}
          >
            {syncToBpm ? "🔗 SYNC TO BPM — ON" : "🔓 SYNC TO BPM — OFF"}
          </button>
        )}

        {/* Removal moved to the header trash icon — keeps the menu
         *  shorter and removal discoverable from where the eye lands
         *  first. */}

        {/* Tail pointer — only when the popover sits ABOVE the
         *  anchor (default position). Hidden when flipped below to
         *  avoid pointing the wrong way. */}
        {pos && !pos.below && (
          <div
            style={{
              position: "absolute",
              bottom: -10,
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 16, height: 16,
              background: "#0f1828",
              border: "2.5px solid #0a0f1c",
              borderTop: "none",
              borderLeft: "none",
            }}
          />
        )}

        <style>{`
          @keyframes jamPanelPop {
            0%   { transform: scale(0.9); opacity: 0; }
            100% { transform: scale(1);   opacity: 1; }
          }
          @keyframes jamCyclerSwap {
            0%   { transform: scale(0.85) rotate(-3deg); opacity: 0; }
            70%  { transform: scale(1.05) rotate(0deg);  opacity: 1; }
            100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
          }
        `}</style>
      </div>
    </>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* CycleArrow — chunky round arrow button used by the sound cycler.           */
/* -------------------------------------------------------------------------- */

function CycleArrow({ direction, onClick }: { direction: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={direction === "prev" ? "previous sound" : "next sound"}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        flexShrink: 0,
        border: "2px solid #0a0f1c",
        background: "linear-gradient(180deg, rgba(36, 51, 88, 0.85), rgba(15, 24, 40, 0.85))",
        color: "#fff",
        fontFamily: "'Lilita One', system-ui",
        fontSize: 18,
        lineHeight: 1,
        cursor: "pointer",
        padding: 0,
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.20), 0 3px 0 rgba(0,0,0,0.45)",
        transition: "transform 0.12s ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "translateY(1px) scale(0.96)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "")}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
}
