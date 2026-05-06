/**
 * SoundPalette — the left rail on the Jam stage.
 *
 * Lists every file-backed loop, grouped by recipe ingredient (drums,
 * hihat, 808, sample). Each tile is draggable — drop it on a
 * JamCharacter to assign that sound. Tap-and-drag also works on
 * touch via a long-press fallback (handled via React's pointer events).
 *
 * Visual: chunky chrome tiles with the sound's emoji as a giant glyph,
 * the sound's playful name underneath, color-coded per kind. Selected
 * (currently-assigned-anywhere) sounds get a glow ring so the player
 * can see what's already on stage.
 */

import { useState } from "react";
import type { LayerKind, SoundOption } from "../../data/types";
import { REAL_SOUNDS } from "../../data/sounds";
import { C } from "../../ui/burst/tokens";

/**
 * Visible sections in the palette. The hi-hat section was removed
 * because the new sprite-based band has no character for it (drum-guy
 * does drums, beat-guy does 808s, guitar-guy does samples). Hat sounds
 * still exist in REAL_SOUNDS so combos can reference them in future
 * updates, but they don't surface in the UI.
 */
const ORDER: LayerKind[] = ["drums", "808", "sample"];

/**
 * Specific soundIds to hide from the palette even when their kind is
 * visible. r-bells-Fm (paradise) is excluded because guitar-guy has no
 * skin for it; showing it would let the user drag a sound with no
 * character to land on.
 */
const HIDDEN_SOUND_IDS = new Set<string>([
  "r-bells-Fm",
]);

const KIND_LABEL: Record<LayerKind, string> = {
  drums:  "DRUMS",
  kick:   "KICK",
  snare:  "SNARE",
  hat:    "HI-HAT",
  "808":  "808",
  sample: "SAMPLE",
  melody: "MELODY",
  vocal:  "VOCAL",
};

/**
 * Each ingredient kind has its own accent color. Same hues used in the
 * main game for the recipe pills, so the visual language is consistent
 * across the recipe and jam screens.
 */
const KIND_COLOR: Record<LayerKind, string> = {
  drums:  C.coral,
  kick:   C.coral,
  snare:  C.coral,
  hat:    "#22d3ee",
  "808":  "#fb923c",
  sample: C.green,
  melody: C.gold,
  vocal:  C.pink,
};

interface SoundPaletteProps {
  /** Set of soundIds currently assigned to any character — drives the
   *  "in use" ring on the matching tiles. */
  assignedIds: Set<string>;
}

/** Sentinel id used by the special "MIC" tile. Drag-and-drop carries
 *  this string in the dataTransfer payload; JamView intercepts it and
 *  opens the recording overlay instead of looking up a catalog sound. */
const VOCAL_DROP_ID = "__vocal__";

export function SoundPalette({ assignedIds }: SoundPaletteProps) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflowY: "auto",
        padding: "12px 8px 16px",
        // Subtle gradient panel so the palette reads as a separate
        // surface from the studio backdrop.
        background: "linear-gradient(180deg, rgba(15, 24, 40, 0.85) 0%, rgba(15, 24, 40, 0.55) 100%)",
        borderRight: "2px solid rgba(0, 0, 0, 0.6)",
        boxShadow: "inset -2px 0 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* VOICE / MIC tile — special, locked-but-functional. Drop this
       *  on a character to open the recording overlay. The catalog
       *  doesn't carry it; JamView intercepts the sentinel id. */}
      <div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: C.pink,
            textTransform: "uppercase",
            padding: "0 4px 6px",
            opacity: 0.75,
          }}
        >
          VOICE
        </div>
        <MicTile />
      </div>

      {ORDER.map((kind) => {
        const sounds = REAL_SOUNDS.filter((s) => s.kind === kind && !HIDDEN_SOUND_IDS.has(s.id));
        if (sounds.length === 0) return null;
        return (
          <div key={kind}>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: KIND_COLOR[kind],
                textTransform: "uppercase",
                padding: "0 4px 6px",
                opacity: 0.75,
              }}
            >
              {KIND_LABEL[kind]}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sounds.map((sound) => (
                <SoundTile
                  key={sound.id}
                  sound={sound}
                  inUse={assignedIds.has(sound.id)}
                  accent={KIND_COLOR[kind]}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MicTile — special "drag me onto a character to record your voice" card.    */
/*                                                                             */
/* Currently functional but visually marked as "PRO" — keeps it discoverable   */
/* while we decide on the actual unlock gate. Drag opens VocalRecordingOverlay */
/* in JamView via the VOCAL_DROP_ID sentinel.                                  */
/* -------------------------------------------------------------------------- */

function MicTile() {
  const [dragging, setDragging] = useState(false);
  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/jam-sound-id", VOCAL_DROP_ID);
    e.dataTransfer.effectAllowed = "copy";
    setDragging(true);
  }
  function onDragEnd() { setDragging(false); }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      role="button"
      title="drag onto a character to record your voice"
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 12,
        background: dragging
          ? "rgba(255,255,255,0.10)"
          : `linear-gradient(180deg, ${C.pink}33 0%, rgba(15, 24, 40, 0.6) 100%)`,
        border: `2px solid ${C.pink}88`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35), 0 0 14px ${C.pink}55`,
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0.6 : 1,
        transition: "box-shadow 0.18s, opacity 0.15s",
      }}
    >
      <div
        style={{
          width: 36, height: 36,
          borderRadius: 10,
          background: `linear-gradient(180deg, ${C.pink} 0%, rgba(0,0,0,0.4) 100%)`,
          border: "1.5px solid #0a0f1c",
          display: "grid", placeItems: "center",
          fontSize: 20, flexShrink: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3)",
        }}
      >
        🎤
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            color: "#fff",
            letterSpacing: 0.3,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          your voice
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.55)",
            marginTop: 2,
            letterSpacing: "0.08em",
          }}
        >
          drop on a char
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SoundTile — individual draggable sound card.                                */
/* -------------------------------------------------------------------------- */

interface SoundTileProps {
  sound:  SoundOption;
  inUse:  boolean;
  accent: string;
}

function SoundTile({ sound, inUse, accent }: SoundTileProps) {
  const [dragging, setDragging] = useState(false);

  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    // Native HTML5 drag — we shove the soundId into the dataTransfer
    // payload under our own MIME so other drop targets ignore it.
    e.dataTransfer.setData("text/jam-sound-id", sound.id);
    e.dataTransfer.effectAllowed = "copy";
    setDragging(true);
  }
  function onDragEnd() { setDragging(false); }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      role="button"
      title={`${sound.name} — drag onto a character`}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 12,
        background: dragging
          ? "rgba(255,255,255,0.10)"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.6) 0%, rgba(15, 24, 40, 0.6) 100%)",
        border: `2px solid ${inUse ? accent : "rgba(0,0,0,0.55)"}`,
        boxShadow: inUse
          ? `0 0 0 1.5px ${accent}, inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(0,0,0,0.4), 0 0 18px ${accent}55`
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35)",
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0.6 : 1,
        transition: "box-shadow 0.18s, opacity 0.15s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `linear-gradient(180deg, ${accent} 0%, rgba(0,0,0,0.4) 100%)`,
          border: "1.5px solid #0a0f1c",
          display: "grid",
          placeItems: "center",
          fontSize: 20,
          flexShrink: 0,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.3)",
        }}
      >
        {sound.glyph}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            color: "#fff",
            letterSpacing: 0.3,
            lineHeight: 1.1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sound.name}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.45)",
            marginTop: 2,
          }}
        >
          {sound.nativeBpm} bpm
        </div>
      </div>
    </div>
  );
}
