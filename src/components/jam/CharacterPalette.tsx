/**
 * CharacterPalette — popup roster for the v1 free-place model.
 *
 * Replaces the v1 SoundPalette sidebar. Click the floating "+" button
 * on the stage to toggle this open. The popup shows every (character ×
 * sound) tile from PLACEABLE_CHARS as a v2-style chunky tile (idle
 * icon + name). Drag a tile and drop anywhere in the room to place
 * the character there.
 *
 * Drag preview UX: when the user starts dragging, the browser cursor
 * shows the FULL-SIZE character sprite (not the tiny tile icon) so the
 * player can preview how the character will sit at the drop location.
 * This is wired via dataTransfer.setDragImage() pointing at a hidden
 * sprite image we keep at the actual placement size.
 */

import { useEffect, useRef, useState } from "react";
import { PLACEABLE_CHARS, type PlaceableChar } from "../../data/placeableChars";
import { CHARACTER_SKINS, type CharacterKind } from "../../data/characterSkins";
import { C } from "../../ui/burst/tokens";

interface CharacterPaletteProps {
  /** soundIds currently placed in the room — drives the "in use"
   *  glow on the tile so the player sees what's already on the floor. */
  placedSoundIds: Set<string>;
  /** Px-size used as the drag preview (matches the placement size in
   *  the room). Driven by JamView from the measured room. */
  dragPreviewSize: number;
  /** Called when the user TAPS a character tile (no drag). Hands the
   *  picked character off to JamView, which closes the popup and
   *  enters placement mode (cursor carries the sprite around the
   *  room). The classic drag flow still works via dataTransfer. */
  onPick: (char: PlaceableChar) => void;
  onClose: () => void;
}

const DRAG_MIME = "text/jam-place-char";

/** Sections to group the tiles by — same buddy framing as v2's sidebar. */
const SECTIONS: { kind: CharacterKind; label: string; accent: string }[] = [
  { kind: "drum-guy",   label: "DRUM BUDDIES",   accent: C.coral  },
  { kind: "beat-guy",   label: "808 BUDDIES",    accent: "#fb923c" },
  { kind: "guitar-guy", label: "SAMPLE BUDDIES", accent: C.green  },
];

export function CharacterPalette({
  placedSoundIds,
  dragPreviewSize,
  onPick,
  onClose,
}: CharacterPaletteProps) {
  // Esc closes the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      {/* Backdrop — capture outside-clicks to dismiss. */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 40,
          background: "rgba(8, 12, 24, 0.4)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          animation: "charPalFadeIn 0.16s ease-out",
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="characters"
        style={{
          position: "absolute",
          left: "50%",
          top:  "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(94vw, 480px)",
          maxHeight: "80vh",
          overflowY: "auto",
          padding: "16px 16px 18px",
          borderRadius: 22,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 16px 36px rgba(0,0,0,0.55)",
          animation: "charPalPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 20,
              color: "#fff",
              letterSpacing: 0.6,
              textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 14px rgba(233, 69, 96, 0.55)",
            }}
          >
            CHOOSE A CHARACTER
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 30, height: 30, borderRadius: 15,
              border: "2px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          tap one — then click the room to place
        </div>

        {/* Sections */}
        {SECTIONS.map((section) => {
          const tiles = PLACEABLE_CHARS.filter((c) => c.characterKind === section.kind);
          return (
            <div key={section.kind} style={{ marginBottom: 14 }}>
              <SectionLabel color={section.accent}>{section.label}</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                }}
              >
                {tiles.map((char) => (
                  <CharTile
                    key={char.id}
                    char={char}
                    inUse={placedSoundIds.has(char.soundId)}
                    accent={section.accent}
                    dragPreviewSize={dragPreviewSize}
                    onPick={onPick}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <style>{`
          @keyframes charPalFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes charPalPop {
            0%   { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionLabel — chunky game-y header above each grid (matches v2 style).    */
/* -------------------------------------------------------------------------- */

function SectionLabel({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "2px 4px 6px" }}>
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 15,
          color: "#fff",
          letterSpacing: 0.5,
          textTransform: "uppercase",
          lineHeight: 1.05,
          textShadow: `0 2px 0 rgba(0, 0, 0, 0.65), 0 0 12px ${color}aa`,
        }}
      >
        {children}
      </div>
      <div
        style={{
          marginTop: 3,
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
/* CharTile — one (character × sound) entry. Drag uses setDragImage so the    */
/* cursor preview is the FULL-SIZE character sprite, not the tile icon.       */
/* -------------------------------------------------------------------------- */

interface CharTileProps {
  char:            PlaceableChar;
  inUse:           boolean;
  accent:          string;
  dragPreviewSize: number;
  onPick:          (char: PlaceableChar) => void;
}

function CharTile({ char, inUse, accent, dragPreviewSize, onPick }: CharTileProps) {
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);

  // Use the same skin's right-pose as the drag preview — same image as
  // the tile icon, just rendered at full placement size offscreen.
  const previewSrc = CHARACTER_SKINS[char.characterKind][char.soundId].right;

  function onDragStart(e: React.DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData(DRAG_MIME, char.soundId);
    e.dataTransfer.effectAllowed = "copy";
    // Anchor the preview at its bottom-center on the cursor so the
    // sprite's "feet" sit where the user is pointing — matches the
    // translate(-50%, -100%) anchoring used when placing.
    if (previewRef.current) {
      e.dataTransfer.setDragImage(
        previewRef.current,
        dragPreviewSize / 2,
        dragPreviewSize,
      );
    }
    setDragging(true);
  }
  function onDragEnd() { setDragging(false); }

  /** Tap (no drag) → pick the character. The popup closes and we
   *  enter placement mode on the parent. The browser only fires
   *  click when there's no drag, so the two flows don't overlap. */
  function onClick() {
    if (inUse) return;
    onPick(char);
  }

  return (
    <>
      <div
        draggable={!inUse}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onClick={onClick}
        role="button"
        title={inUse
          ? `${char.name} — already on stage`
          : `${char.name} — tap to pick or drag`}
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
          cursor: inUse ? "not-allowed" : "grab",
          userSelect: "none",
          opacity: dragging ? 0.4 : (inUse ? 0.55 : 1),
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
            src={char.iconSrc}
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
          {char.name}
        </div>
        {inUse && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 8,
              fontWeight: 700,
              color: accent,
              letterSpacing: "0.18em",
              textAlign: "center",
              textTransform: "uppercase",
              marginTop: -2,
            }}
          >
            on stage
          </div>
        )}
      </div>

      {/* Hidden full-size sprite — used as the drag-preview image so
       *  the cursor shows the actual character at room size. Kept off-
       *  screen but loaded so the browser has it ready when drag
       *  starts. */}
      <img
        ref={previewRef}
        src={previewSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{
          position: "fixed",
          top: -10000,
          left: -10000,
          width:  dragPreviewSize,
          height: dragPreviewSize,
          objectFit: "contain",
          pointerEvents: "none",
          userSelect: "none",
        }}
      />
    </>
  );
}

/** Re-export the dataTransfer MIME so JamView's drop handler can read
 *  the same string. Single source of truth for the drag protocol. */
export const PLACE_CHAR_MIME = DRAG_MIME;
