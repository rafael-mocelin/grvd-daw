/**
 * SoundPaletteV2 — character-based palette for jam-stage v2.
 *
 * In v2 the palette is a flat roster of character cards instead of
 * sound-grouped tiles. Each card shows the character's idle frame as
 * a thumbnail + a creative name + a one-line blurb. Drag the card to
 * land the character on any free slot in the Crib. The drag payload
 * is the underlying soundId so the existing audio engine wiring
 * (assignSlot etc) stays unchanged.
 *
 * Voice / mic tile is kept at the top — only target is the player
 * slot, same as v1.
 */

import { useState } from "react";
import { JAM_CHARS_V2, type JamCharV2 } from "../../data/jamCharactersV2";
import { C } from "../../ui/burst/tokens";

interface SoundPaletteV2Props {
  /** Set of soundIds currently occupying a band slot. Cards with a
   *  matching soundId show a "in use" ring so the player can see at
   *  a glance who's already on stage. */
  assignedSoundIds: Set<string>;
}

/** Sentinel id used by the special VOICE / MIC tile. Mirrors the v1
 *  contract — JamView intercepts this string in handleDrop and opens
 *  the recorder instead of treating it as a catalog sound. */
const VOCAL_DROP_ID = "__vocal__";

export function SoundPaletteV2({ assignedSoundIds }: SoundPaletteV2Props) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflowY: "auto",
        padding: "12px 8px 16px",
        background: "linear-gradient(180deg, rgba(15, 24, 40, 0.85) 0%, rgba(15, 24, 40, 0.55) 100%)",
        borderRight: "2px solid rgba(0, 0, 0, 0.6)",
        boxShadow: "inset -2px 0 0 rgba(255, 255, 255, 0.05)",
      }}
    >
      {/* VOICE / MIC tile — special, drops to the player slot only. */}
      <SectionLabel color={C.pink}>VOICE</SectionLabel>
      <MicCard />

      {/* CHARACTERS — flat roster, one card per character. Replaces
       *  the v1 kind-grouped tiles. */}
      <SectionLabel color={C.coral}>CAST</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {JAM_CHARS_V2.map((char) => (
          <CharCard
            key={char.id}
            char={char}
            inUse={assignedSoundIds.has(char.soundId)}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section label                                                               */
/* -------------------------------------------------------------------------- */

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.18em",
        color,
        textTransform: "uppercase",
        padding: "0 4px",
        opacity: 0.75,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MicCard — drag onto the player to record a vocal. Same v1 sentinel.        */
/* -------------------------------------------------------------------------- */

function MicCard() {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/jam-sound-id", VOCAL_DROP_ID);
        e.dataTransfer.effectAllowed = "copy";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      role="button"
      title="drag onto the player to record your voice"
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
            fontSize: 13, color: "#fff", letterSpacing: 0.3, lineHeight: 1.1,
            whiteSpace: "nowrap",
          }}
        >
          your voice
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, color: "rgba(255,255,255,0.55)",
            marginTop: 2, letterSpacing: "0.08em",
          }}
        >
          drop on the lead
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CharCard — one row per character. Idle thumb on the left, name + blurb     */
/* on the right. Drag transfers the soundId.                                   */
/* -------------------------------------------------------------------------- */

interface CharCardProps {
  char:  JamCharV2;
  inUse: boolean;
}

function CharCard({ char, inUse }: CharCardProps) {
  const [dragging, setDragging] = useState(false);
  const idleSrc = char.frames[0];
  const accent  = inUse ? "#22d3ee" : "rgba(0,0,0,0.55)";

  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    // Reuse the v1 wire format — JamView's handleDrop reads this. The
    // payload is the soundId so the audio engine doesn't have to know
    // about character ids.
    e.dataTransfer.setData("text/jam-sound-id", char.soundId);
    e.dataTransfer.effectAllowed = "copy";
    setDragging(true);
  }
  function onDragEnd() {
    setDragging(false);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      role="button"
      title={`${char.name} — drag onto a free slot`}
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
        border: `2px solid ${accent}`,
        boxShadow: inUse
          ? `0 0 0 1.5px ${accent}, inset 0 1px 0 rgba(255,255,255,0.08), 0 4px 0 rgba(0,0,0,0.4), 0 0 18px ${accent}55`
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35)",
        cursor: "grab",
        userSelect: "none",
        opacity: dragging ? 0.6 : 1,
        transition: "box-shadow 0.18s, opacity 0.15s",
      }}
    >
      {/* Character idle thumbnail — image asset, scaled to fit a small
       *  square. Background gradient gives it a tiny stage look behind
       *  the cutout so the transparent PNG reads cleanly. */}
      <div
        style={{
          width: 40, height: 40,
          borderRadius: 10,
          background: "radial-gradient(ellipse at 50% 110%, rgba(233, 69, 96, 0.45), rgba(15, 24, 40, 0.7) 70%)",
          border: "1.5px solid #0a0f1c",
          flexShrink: 0,
          overflow: "hidden",
          display: "grid", placeItems: "center",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18)",
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
            // The character art has the body taking maybe 60% of its
            // square frame; pull up slightly so the head is centered
            // in the thumbnail rather than drifting to the bottom.
            objectPosition: "center 65%",
            pointerEvents: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13, color: "#fff", letterSpacing: 0.3, lineHeight: 1.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {char.name}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, color: "rgba(255,255,255,0.55)",
            marginTop: 2, letterSpacing: "0.04em",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {char.blurb}
        </div>
      </div>
    </div>
  );
}
