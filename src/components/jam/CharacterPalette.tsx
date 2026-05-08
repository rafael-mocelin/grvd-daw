/**
 * CharacterPalette — thin side strip with 3 character-type tiles.
 *
 * Anchored to the right edge of the viewport, OUTSIDE the room area
 * so the player can still see the floor while choosing. No backdrop,
 * no darkening — the popup is non-modal and can sit alongside the
 * room with a click-catcher.
 *
 * Layout: a single column with 3 tiles, one per CHARACTER TYPE:
 *   - blue  : drum-guy    (drums)
 *   - green : beat-guy    (808)
 *   - purple: guitar-guy  (sample)
 *
 * Tapping a tile picks the FIRST sound for that kind that isn't yet
 * on stage and enters placement mode (handled by JamView). When all
 * three sounds for a kind are placed, the tile shows "ALL ON STAGE"
 * and is disabled.
 *
 * The (character × sound) granularity still exists at the audio /
 * skin level — every sound has its own art and own audio bus — but
 * the player only sees the type roster here. Picking the same tile
 * twice spawns the next variant; clear an instance to free up a slot
 * for a re-pick.
 */

import { useEffect } from "react";
import { PLACEABLE_CHARS, type PlaceableChar } from "../../data/placeableChars";
import { CHARACTER_SKINS, type CharacterKind } from "../../data/characterSkins";
import { C } from "../../ui/burst/tokens";

interface CharacterPaletteProps {
  /** Character kinds currently on stage (one per kind in the new
   *  model). Drives the "ON STAGE" state on each tile. */
  placedKinds: Set<CharacterKind>;
  /** Whether the player has been placed at the mic — drives the
   *  "ON STAGE" state on the VOICE tile. */
  playerOnStage: boolean;
  /** Picked a band character (drum-guy/beat-guy/guitar-guy) — JamView
   *  closes the popup and enters placement mode (cursor carries the
   *  sprite). */
  onPick: (char: PlaceableChar) => void;
  /** Picked the player — JamView snaps them to the fixed mic position
   *  and closes the popup. No placement-mode cursor for the player
   *  since the mic is anchored to the floor. */
  onPickPlayer: () => void;
  onClose: () => void;
}

/** Section metadata, ordered top-to-bottom in the strip. */
const KIND_SECTIONS: { kind: CharacterKind; label: string; accent: string }[] = [
  { kind: "drum-guy",   label: "DRUMS",  accent: C.coral  },   // blue character
  { kind: "beat-guy",   label: "808",    accent: "#fb923c" },  // green character
  { kind: "guitar-guy", label: "SAMPLE", accent: C.green  },   // purple character
];

/** Image used as the icon on the VOICE / player tile. Same asset
 *  PlayerAtMic renders so the popup matches what lands in the room. */
const PLAYER_ICON = "/characters/player-guy/player-character.png";

export function CharacterPalette({
  placedKinds,
  playerOnStage,
  onPick,
  onPickPlayer,
  onClose,
}: CharacterPaletteProps) {
  // Esc closes the strip.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-label="characters"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        right: 14,
        top:  "50%",
        transform: "translateY(-50%)",
        zIndex: 60,
        width: 92,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderRadius: 18,
        background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
        border: "2.5px solid #0a0f1c",
        boxShadow:
          "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 0 22px rgba(233,69,96,0.35)",
        animation: "charPalSlideIn 0.22s cubic-bezier(.34,1.56,.64,1) both",
      }}
    >
      {/* VOICE — special player tile. Placement is fixed (the mic
       *  stand sits at PLAYER_POS); tapping just snaps them in. */}
      <KindTile
        label="VOICE"
        accent={C.pink}
        iconSrc={PLAYER_ICON}
        onStage={playerOnStage}
        onPick={() => {
          if (playerOnStage) return;
          onPickPlayer();
        }}
      />

      {KIND_SECTIONS.map((section) => {
        // One slot per kind in the new model — sound cycling lives in
        // the placed character's controls popover. Tile is "ON STAGE"
        // if the kind is already placed, else "TAP TO PLACE". Picking
        // the tile spawns the kind with its DEFAULT (first) sound; the
        // player can swap to a different variant inside the popover.
        const tilesForKind = PLACEABLE_CHARS.filter((c) => c.characterKind === section.kind);
        const defaultChar  = tilesForKind[0];
        const onStage      = placedKinds.has(section.kind);
        const iconSrc      = defaultChar.iconSrc;

        return (
          <KindTile
            key={section.kind}
            label={section.label}
            accent={section.accent}
            iconSrc={iconSrc}
            onStage={onStage}
            onPick={() => {
              if (onStage) return;
              onPick(defaultChar);
            }}
          />
        );
      })}

      <style>{`
        @keyframes charPalSlideIn {
          0%   { transform: translate(20px, -50%) scale(0.92); opacity: 0; }
          100% { transform: translate(0,    -50%) scale(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* KindTile — one of the three character-type tiles in the side strip.        */
/* -------------------------------------------------------------------------- */

interface KindTileProps {
  label:   string;
  accent:  string;
  iconSrc: string;
  onStage: boolean;
  onPick:  () => void;
}

function KindTile({ label, accent, iconSrc, onStage, onPick }: KindTileProps) {
  return (
    <button
      onClick={onPick}
      disabled={onStage}
      title={
        onStage
          ? `${label} — already on stage (open their menu to swap sounds)`
          : `${label} — tap to spawn`
      }
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 6,
        borderRadius: 12,
        background: onStage
          ? "rgba(0, 0, 0, 0.35)"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.65) 0%, rgba(15, 24, 40, 0.65) 100%)",
        border: `2px solid ${onStage ? "rgba(255,255,255,0.10)" : accent}`,
        boxShadow: onStage
          ? "inset 0 1px 0 rgba(255,255,255,0.04)"
          : `inset 0 1px 0 rgba(255,255,255,0.10), 0 3px 0 rgba(0,0,0,0.4), 0 0 14px ${accent}55`,
        cursor: onStage ? "not-allowed" : "pointer",
        opacity: onStage ? 0.45 : 1,
        userSelect: "none",
        transition: "transform 0.12s ease, box-shadow 0.18s",
      }}
    >
      {/* Big square icon */}
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
          src={iconSrc}
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

      {/* Label below the icon */}
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 10,
          color: "#fff",
          letterSpacing: 0.4,
          textAlign: "center",
          textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          lineHeight: 1.05,
        }}
      >
        {label}
      </div>

      {/* State chip — "ON STAGE" when placed, otherwise hidden. Sound
       *  cycling now lives inside the placed character's popover, so
       *  no variant counter is shown here. */}
      {onStage && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 22,
            height: 18,
            padding: "0 6px",
            borderRadius: 9,
            background: "rgba(255,255,255,0.10)",
            border: "1.5px solid #0a0f1c",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.08em",
            display: "grid",
            placeItems: "center",
            textTransform: "uppercase",
          }}
        >
          ON STAGE
        </div>
      )}
    </button>
  );
}

/** Re-export the dataTransfer MIME so JamView's drop handler can read
 *  the same string. We no longer drag from the palette in this design,
 *  but JamView still listens for it from any other source — kept for
 *  future use and to avoid an import churn. */
export const PLACE_CHAR_MIME = "text/jam-place-char";
