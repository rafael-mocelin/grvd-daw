/**
 * SoundPaletteV2 — character roster grouped by buddy section.
 *
 * Each character is presented as a chunky tile with the idle thumbnail
 * up top and the creative name below. Sections are laid out as 2×2
 * grids — three characters per kind plus one locked "+" tile that
 * teases progression ("go out in the world to find more buddies").
 *
 * Drag a character → land them on any free slot. The drag payload is
 * the underlying soundId so the audio engine wiring is unchanged.
 *
 * VOICE section follows the same grid: tile 1 is the player character
 * (drag → player slot to record), tile 2 is a locked "+" that teases
 * inviting a friend to collab.
 */

import { useState } from "react";
import { JAM_CHARS_V2, type JamCharV2 } from "../../data/jamCharactersV2";
import { REAL_SOUNDS } from "../../data/sounds";
import type { LayerKind } from "../../data/types";
import { C } from "../../ui/burst/tokens";

interface SoundPaletteV2Props {
  /** Set of soundIds currently on stage. Cards with a matching soundId
   *  show a glowing "in use" ring. */
  assignedSoundIds: Set<string>;
}

/** Sentinel used by the special VOICE / MIC tile. JamView's handleDrop
 *  intercepts this string and opens the recorder for the player slot. */
const VOCAL_DROP_ID = "__vocal__";

/** Sections in palette order. The label is the player-facing name; the
 *  kind matches REAL_SOUNDS.kind so we can group characters by their
 *  underlying sound's kind. */
interface Section {
  label:  string;
  kind:   LayerKind;
  accent: string;
}

const SECTIONS: Section[] = [
  { label: "DRUM BUDDIES",   kind: "drums",  accent: C.coral },
  { label: "808 BUDDIES",    kind: "808",    accent: "#fb923c" },
  { label: "SAMPLE BUDDIES", kind: "sample", accent: C.green  },
];

/** Sound-id → kind lookup so we can group v2 characters into the
 *  three sections without storing kind on the character itself. */
const SOUND_KIND: Record<string, LayerKind> = Object.fromEntries(
  REAL_SOUNDS.map((s) => [s.id, s.kind]),
);

export function SoundPaletteV2({ assignedSoundIds }: SoundPaletteV2Props) {
  // Toast that pops when the player taps a locked "find more buddies"
  // tile. Auto-clears via a setTimeout in the handler.
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        overflowY: "auto",
        padding: "12px 8px 16px",
        background: "linear-gradient(180deg, rgba(15, 24, 40, 0.85) 0%, rgba(15, 24, 40, 0.55) 100%)",
        borderRight: "2px solid rgba(0, 0, 0, 0.6)",
        boxShadow: "inset -2px 0 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* VOICE — same 2-col grid rhythm as the buddy sections.
       *  Tile 1 is the player character (drag → player slot triggers
       *  the recorder via the VOCAL_DROP_ID sentinel). Tile 2 is a
       *  locked "+" that teases the invite-a-friend collab feature. */}
      <div>
        <SectionLabel color={C.pink}>VOICE</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          <PlayerCharTile accent={C.pink} />
          <LockedBuddyTile
            accent={C.pink}
            caption="invite"
            onClick={() => showToast("invite a friend to collab on your song")}
          />
        </div>
      </div>

      {/* CHARACTER SECTIONS — one 2×2 grid each */}
      {SECTIONS.map((section) => {
        const chars = JAM_CHARS_V2.filter((c) => SOUND_KIND[c.soundId] === section.kind);
        return (
          <div key={section.kind}>
            <SectionLabel color={section.accent}>{section.label}</SectionLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {chars.map((char) => (
                <CharTile
                  key={char.id}
                  char={char}
                  inUse={assignedSoundIds.has(char.soundId)}
                  accent={section.accent}
                />
              ))}
              {/* 4th tile — locked "find more buddies" placeholder.
               *  We always pad to 4 tiles per section regardless of
               *  how many characters the section has, so the grid
               *  rhythm is consistent. */}
              {Array.from({ length: Math.max(0, 4 - chars.length) }).map((_, i) => (
                <LockedBuddyTile
                  key={`locked-${section.kind}-${i}`}
                  accent={section.accent}
                  caption="find one"
                  onClick={() =>
                    showToast("go out in the world to find more buddies")
                  }
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Toast — pops when the player taps a locked tile, auto-fades. */}
      {toast && (
        <div
          style={{
            position: "sticky",
            bottom: 8,
            alignSelf: "center",
            marginTop: "auto",
            padding: "9px 14px",
            borderRadius: 14,
            background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
            border: "2px solid #f3c44a",
            boxShadow: "0 4px 0 rgba(0,0,0,0.5), 0 0 18px rgba(243, 196, 74, 0.5)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            letterSpacing: 0.4,
            textAlign: "center",
            maxWidth: "100%",
            animation: "paletteToastIn 0.22s ease-out",
            zIndex: 5,
            pointerEvents: "none",
          }}
        >
          🌍 {toast}
          <style>{`
            @keyframes paletteToastIn {
              0%   { transform: translateY(8px); opacity: 0; }
              100% { transform: translateY(0);   opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionLabel — chunky game-y header above each grid. Uses the canonical    */
/* BURST display font (Lilita One per the design manifesto), with a layered  */
/* drop-shadow + accent glow so it reads as a hand-painted sign instead of a */
/* tiny technical strap. A thin accent rule underneath caps it off.           */
/* -------------------------------------------------------------------------- */

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "2px 4px 8px" }}>
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 17,
          color: "#fff",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          lineHeight: 1.05,
          // Chunky-chrome text treatment: hard 2px drop, then a soft
          // accent halo so the label feels like a sign in the room.
          textShadow: `
            0 2px 0 rgba(0, 0, 0, 0.65),
            0 0 12px ${color}aa
          `,
        }}
      >
        {children}
      </div>
      {/* Thin accent rule — fades right so it reads as a stylized ribbon
       *  rather than a hard divider line. */}
      <div
        style={{
          marginTop: 4,
          height: 2,
          borderRadius: 1,
          background: `linear-gradient(90deg, ${color} 0%, ${color}55 60%, transparent 100%)`,
          boxShadow: `0 0 6px ${color}66`,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PlayerCharTile — first tile in the VOICE section. Same shape as CharTile   */
/* but the icon is the player-character portrait and the drag payload is the  */
/* VOCAL_DROP_ID sentinel so JamView routes it to the mic-recording flow on   */
/* the player slot.                                                            */
/* -------------------------------------------------------------------------- */

const PLAYER_PORTRAIT = "/characters/player-guy/player-character.png";

function PlayerCharTile({ accent }: { accent: string }) {
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
      title="drag onto the player to record your voice"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: dragging
          ? "rgba(255,255,255,0.10)"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.6) 0%, rgba(15, 24, 40, 0.6) 100%)",
        border: `2px solid ${accent}88`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35), 0 0 12px ${accent}44`,
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0.6 : 1,
        transition: "box-shadow 0.18s, opacity 0.15s",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: `radial-gradient(ellipse at 50% 110%, ${accent}55, rgba(15, 24, 40, 0.7) 70%)`,
          border: "1.5px solid #0a0f1c",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <img
          src={PLAYER_PORTRAIT}
          alt=""
          draggable={false}
          style={{
            width:  "120%",
            height: "120%",
            objectFit: "contain",
            objectPosition: "center 65%",
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>

      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 11,
          color: "#fff",
          letterSpacing: 0.3,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: "0 1px 0 rgba(0,0,0,0.55)",
        }}
      >
        YOU
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CharTile — square tile with the character's idle thumb + name below.       */
/* Drag transfers the soundId.                                                 */
/* -------------------------------------------------------------------------- */

interface CharTileProps {
  char:   JamCharV2;
  inUse:  boolean;
  accent: string;
}

function CharTile({ char, inUse, accent }: CharTileProps) {
  const [dragging, setDragging] = useState(false);
  const idleSrc = char.frames[0];

  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/jam-sound-id", char.soundId);
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
      title={`${char.name} — drag onto a free slot`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: dragging
          ? "rgba(255,255,255,0.10)"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.6) 0%, rgba(15, 24, 40, 0.6) 100%)",
        border: `2px solid ${inUse ? accent : "rgba(0,0,0,0.55)"}`,
        boxShadow: inUse
          ? `0 0 0 1.5px ${accent}, inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.4), 0 0 14px ${accent}77`
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35)",
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0.6 : 1,
        transition: "box-shadow 0.18s, opacity 0.15s",
      }}
    >
      {/* Big icon — fills most of the tile. Backdrop gradient gives the
       *  transparent character art a tiny stage-lit look. */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: `radial-gradient(ellipse at 50% 110%, ${accent}55, rgba(15, 24, 40, 0.7) 70%)`,
          border: "1.5px solid #0a0f1c",
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        <img
          src={idleSrc}
          alt=""
          draggable={false}
          style={{
            width:  "120%",
            height: "120%",
            objectFit: "contain",
            objectPosition: "center 65%",
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>

      {/* Name below the icon, no subtitle. */}
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 11,
          color: "#fff",
          letterSpacing: 0.3,
          textAlign: "center",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          textShadow: "0 1px 0 rgba(0,0,0,0.55)",
        }}
      >
        {char.name}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LockedBuddyTile — grey + dashed, shows a "+" and pops a toast on click.    */
/* Caption text is configurable so the VOICE section's invite-a-friend tile   */
/* can reuse the same component with a different sub-label.                   */
/* -------------------------------------------------------------------------- */

interface LockedBuddyTileProps {
  accent:  string;
  caption: string;
  onClick: () => void;
}

function LockedBuddyTile({ accent, caption, onClick }: LockedBuddyTileProps) {
  return (
    <button
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: "rgba(0, 0, 0, 0.25)",
        border: `2px dashed ${accent}55`,
        cursor: "pointer",
        font: "inherit",
        color: "inherit",
        userSelect: "none",
      }}
      aria-label={`locked — ${caption}`}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: "1.5px dashed rgba(255,255,255,0.18)",
          display: "grid",
          placeItems: "center",
          color: `${accent}aa`,
          fontSize: 28,
          fontFamily: "'Lilita One', system-ui",
          lineHeight: 1,
        }}
      >
        +
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.10em",
          color: "rgba(255,255,255,0.45)",
          textAlign: "center",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {caption}
      </div>
    </button>
  );
}
