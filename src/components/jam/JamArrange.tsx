/**
 * JamArrange — bottom-anchored timeline / arrange panel for the
 * jam stage. Inspired by the recipe DAW's ArrangeView but simpler:
 *
 *  - One row per placed character (band + player). Empty stage =
 *    panel hidden by the parent.
 *  - Left column = character icon + name, identical visual to the
 *    palette tiles so the player matches sound-to-character at a
 *    glance.
 *  - Right column = looped waveform-bar visualization showing the
 *    duration of one bar at the master BPM. Muted rows render in
 *    grey with an OFF chip; live rows render with the kind's accent.
 *  - Vertical playhead spans every row, position = the master
 *    transport's seconds (mod loopDur) projected onto the timeline.
 *  - Pointer-down + drag in the timeline area scrubs the master
 *    transport. On pointer-up we resync every slot player to the new
 *    position so the audio jumps too (instead of just the playhead).
 *
 * No section ribbon (the jam-stage has no intro / verse / hook
 * structure yet) — just a continuous loop view.
 */

import { useEffect, useRef, useState } from "react";
import {
  getJamMasterTransportSeconds,
  seekJamTransport,
  resyncJamSlotsToTransport,
} from "../../audio/jamEngine";
import { CHARACTER_SKINS, type CharacterKind } from "../../data/characterSkins";

const PLAYER_ICON = "/characters/player-guy/player-character.png";

/** One row in the arrange grid. */
export interface ArrangeRow {
  /** Stable id for React keying; matches the slotId used by the
   *  audio engine. */
  slotId: string;
  /** Display name on the left chip. */
  name: string;
  /** Image path used as the left chip icon. */
  iconSrc: string;
  /** Whether the slot is muted — drives the greyed-out style. */
  muted: boolean;
  /** Accent colour for the row (gradient + glow). */
  accent: string;
}

interface JamArrangeProps {
  rows: ArrangeRow[];
  /** Master BPM, used to size the visualised "one bar" window so the
   *  waveform bars + playhead motion match what the singer hears. */
  bpm: number;
}

/** How many BARS of master transport are visualised across the
 *  timeline strip. 4 bars = one phrase, the most-common loop length
 *  in trap / hip-hop. */
const BARS_IN_VIEW = 4;
/** Pixel height of each row. */
const ROW_H        = 56;
/** Width of the left character-chip column. */
const LABEL_W      = 110;
/** Height of the timeline header. */
const HEADER_H     = 28;

export function JamArrange({ rows, bpm }: JamArrangeProps) {
  /** Master transport seconds, repainted every frame while the
   *  panel is mounted so the playhead glides smoothly. */
  const [transportSec, setTransportSec] = useState(0);
  const rafRef       = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const lanesRef     = useRef<HTMLDivElement>(null);

  // Length of the visualised window, in seconds: 4 bars at the
  // master BPM. Loop modulo is taken against this so the playhead
  // wraps cleanly back to 0.
  const beatsInView = BARS_IN_VIEW * 4;
  const loopDur     = (60 / bpm) * beatsInView;

  useEffect(() => {
    const tick = () => {
      setTransportSec(getJamMasterTransportSeconds());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const phasedSec  = ((transportSec % loopDur) + loopDur) % loopDur;
  const headPct    = (phasedSec / loopDur) * 100;

  function seekFromClientX(clientX: number) {
    const lanes = lanesRef.current;
    if (!lanes) return;
    const rect = lanes.getBoundingClientRect();
    const x    = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const frac = rect.width > 0 ? x / rect.width : 0;
    const newSec = frac * loopDur;
    // The transport advances linearly; we project the scrub into the
    // current "window" of the master clock so the playhead lands at
    // the visual position the user clicked. Whichever loop window
    // they were in stays the same — we just shift inside it.
    const cur = getJamMasterTransportSeconds();
    const curWindowStart = Math.floor(cur / loopDur) * loopDur;
    seekJamTransport(curWindowStart + newSec);
    setTransportSec(curWindowStart + newSec);
  }

  function onLanesPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isSeekingRef.current = true;
    seekFromClientX(e.clientX);
  }
  function onLanesPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSeekingRef.current) return;
    seekFromClientX(e.clientX);
  }
  function onLanesPointerUp() {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;
    // Single audio commit on release — see resyncJamSlotsToTransport
    // for the rationale (don't stop/start dozens of times per second).
    resyncJamSlotsToTransport();
  }

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 7,
        padding: "8px 10px 10px",
        background: "linear-gradient(180deg, rgba(15, 24, 40, 0.55) 0%, rgba(8, 12, 24, 0.92) 60%, rgba(8, 12, 24, 0.96) 100%)",
        borderTop: "2px solid rgba(0, 0, 0, 0.55)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.05)",
        userSelect: "none",
        WebkitUserSelect: "none",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      {/* Header — title + transport time. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: HEADER_H,
          paddingLeft: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            color: "#fff",
            letterSpacing: 0.5,
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          🎚 ARRANGE
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          {fmtTime(phasedSec)} / {fmtTime(loopDur)} · {bpm} BPM
        </span>
      </div>

      {/* Rows + playhead. The lanes share the same horizontal axis so
       *  a single absolute playhead can sweep across them. */}
      <div
        style={{
          position: "relative",
          marginTop: 4,
          display: "flex",
        }}
      >
        {/* Left column — labels. */}
        <div
          style={{
            width: LABEL_W,
            flexShrink: 0,
          }}
        >
          {rows.map((row) => (
            <RowLabel key={row.slotId} row={row} />
          ))}
        </div>

        {/* Right column — lanes + waveform blocks + playhead. */}
        <div
          ref={lanesRef}
          onPointerDown={onLanesPointerDown}
          onPointerMove={onLanesPointerMove}
          onPointerUp={onLanesPointerUp}
          onPointerCancel={onLanesPointerUp}
          style={{
            position: "relative",
            flex: 1,
            cursor: "col-resize",
            touchAction: "none",
          }}
        >
          {rows.map((row) => (
            <RowLane key={row.slotId} row={row} />
          ))}

          {/* Vertical playhead — full height across rows. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${headPct}%`,
              width: 2,
              marginLeft: -1,
              background: "linear-gradient(180deg, #facc15, #fff)",
              boxShadow: "0 0 10px rgba(250, 204, 21, 0.95), 0 0 18px rgba(250, 204, 21, 0.5)",
              pointerEvents: "none",
              borderRadius: 1,
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RowLabel — character thumbnail + name in the left column.                  */
/* -------------------------------------------------------------------------- */

function RowLabel({ row }: { row: ArrangeRow }) {
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        gap: 8,
        paddingRight: 8,
        opacity: row.muted ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      {/* Accent stripe — same colour as the row's lane gradient. */}
      <div
        style={{
          width: 4,
          height: ROW_H - 14,
          borderRadius: 2,
          flexShrink: 0,
          background: row.accent,
          boxShadow: `0 0 6px ${row.accent}aa`,
        }}
      />
      {/* Circular thumbnail. */}
      <div
        style={{
          width: ROW_H - 18,
          height: ROW_H - 18,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          border: `1.5px solid ${row.accent}88`,
          background: `radial-gradient(ellipse at 50% 110%, ${row.accent}55, rgba(15, 24, 40, 0.7) 70%)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <img
          src={row.iconSrc}
          alt=""
          draggable={false}
          style={{
            width:  "130%",
            height: "130%",
            objectFit: "contain",
            objectPosition: "center 60%",
            pointerEvents: "none",
          }}
        />
      </div>
      {/* Name. */}
      <div style={{ minWidth: 0, lineHeight: 1.1 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 11,
            color: "#fff",
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          {row.name}
        </div>
        {row.muted && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.18em",
              marginTop: 1,
              textTransform: "uppercase",
            }}
          >
            muted
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RowLane — the waveform-bar block sitting in one row of the timeline.       */
/* -------------------------------------------------------------------------- */

function RowLane({ row }: { row: ArrangeRow }) {
  const NUM_BARS = 64;   // visual bars across the lane
  return (
    <div
      style={{
        position: "relative",
        height: ROW_H,
        marginBottom: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 4,
          right: 4,
          top:   7,
          bottom: 7,
          borderRadius: 8,
          overflow: "hidden",
          background: row.muted
            ? "rgba(255,255,255,0.04)"
            : `linear-gradient(135deg, ${row.accent}dd 0%, ${row.accent}88 100%)`,
          border: `1px solid ${row.muted ? "rgba(255,255,255,0.08)" : row.accent + "88"}`,
          boxShadow: row.muted
            ? "none"
            : `0 4px 0 rgba(0,0,0,0.25), 0 0 12px ${row.accent}44, inset 0 1px 0 rgba(255,255,255,0.22)`,
          opacity: row.muted ? 0.55 : 1,
          transition: "opacity 0.2s, background 0.2s",
        }}
      >
        {/* Stylised waveform bars — same trick the ArrangeView uses;
         *  cheap visual that reads as a real audio loop. Hidden when
         *  muted (replaced with an OFF label). */}
        {!row.muted &&
          Array.from({ length: NUM_BARS }).map((_, i) => {
            const h = 28 + 42 * Math.sin((i / NUM_BARS) * Math.PI * 2);
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(i / NUM_BARS) * 100}%`,
                  width: 2,
                  height: `${h}%`,
                  background: "rgba(255,255,255,0.35)",
                  borderRadius: 1.5,
                  top: "50%",
                  transform: "translateY(-50%)",
                }}
              />
            );
          })}
        {row.muted && (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            OFF
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* fmtTime — MM:SS string used in the header. seconds are floored.            */
/* -------------------------------------------------------------------------- */

function fmtTime(secs: number): string {
  if (!isFinite(secs)) return "00:00";
  const total = Math.max(0, Math.floor(secs));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* -------------------------------------------------------------------------- */
/* Convenience: build an ArrangeRow for the player slot. Exported so JamView  */
/* can compose rows without duplicating the icon path / styling here.         */
/* -------------------------------------------------------------------------- */

export function playerArrangeRow(opts: {
  slotId: string;
  muted:  boolean;
  filled: boolean;
}): ArrangeRow | null {
  if (!opts.filled) return null;
  return {
    slotId:  opts.slotId,
    name:    "YOU",
    iconSrc: PLAYER_ICON,
    muted:   opts.muted,
    accent:  "#ff4d9c",
  };
}

/** Accent colours per character kind — match the palette section
 *  accents so the arrange row's stripe / lane reads as "this is the
 *  drum buddy / 808 buddy / sample buddy". */
export const ARRANGE_ACCENT: Record<CharacterKind, string> = {
  "drum-guy":   "#22d3ee",
  "beat-guy":   "#fb923c",
  "guitar-guy": "#4ade80",
};

/** Resolve the still-pose icon path for a placed band character so
 *  the arrange row label shows the same art the palette tile uses. */
export function characterIconFor(kind: CharacterKind, soundId: string): string {
  const skinSet = CHARACTER_SKINS[kind];
  const skin    = skinSet[soundId] ?? skinSet[Object.keys(skinSet)[0]];
  return skin.right;
}
