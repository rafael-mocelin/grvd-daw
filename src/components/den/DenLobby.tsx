/**
 * DenLobby — the home room of the DEN.
 *
 * 4 character stations laid out as cards. Each shows the chibi, a
 * specialty pill, friendship dots, and an enter button. A "library"
 * pill in the top bar opens the saved-tracks panel.
 *
 * v1 prototype: only DRUMMA (mochi) leads to a working mini-game; the
 * others go to a stub screen.
 */

import { DEN_ROSTER } from "../../data/denCharacters";
import type { DenCharacter, Specialty } from "../../data/denCharacters";
import { useDenStore } from "../../lib/denStore";
import type { StationId } from "../../lib/denStore";
import { Chibi } from "./Chibi";

interface DenLobbyProps {
  onQuit:        () => void;
  onOpenLibrary: () => void;
}

const SPECIALTY_LABEL: Record<Specialty, string> = {
  drums:  "DRUMS",
  melody: "MELODY",
  vocals: "LYRICS",
  mix:    "MIX",
};
const SPECIALTY_ACCENT: Record<Specialty, string> = {
  drums:  "#E94560",
  melody: "#22d3ee",
  vocals: "#facc15",
  mix:    "#a78bfa",
};

export function DenLobby({ onQuit, onOpenLibrary }: DenLobbyProps) {
  const enterStation = useDenStore((s) => s.enterStation);
  const friendship   = useDenStore((s) => s.friendship);
  const library      = useDenStore((s) => s.library);

  const visible = DEN_ROSTER.filter((c) => c.unlocked);
  const lockedCount = DEN_ROSTER.length - visible.length;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 14px",
          background: "linear-gradient(180deg, rgba(15, 24, 40, 0.95), rgba(15, 24, 40, 0.6))",
          borderBottom: "2px solid rgba(0, 0, 0, 0.6)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          onClick={onQuit}
          style={pillStyle()}
        >
          ✕ quit
        </button>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 18,
            color: "#fff",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(0,0,0,0.5)",
          }}
        >
          THE <span style={{ color: "#E94560" }}>DEN</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onOpenLibrary}
          style={{
            ...pillStyle(),
            background:
              "linear-gradient(180deg, rgba(167, 139, 250, 0.25), rgba(0,0,0,0.4))",
            borderColor: "rgba(167, 139, 250, 0.55)",
            color: "#fff",
          }}
        >
          📓 library {library.length > 0 && `· ${library.length}`}
        </button>
      </div>

      {/* Studio room backdrop hint */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 14px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        tap a door — every character makes one part of a song
      </div>

      {/* Stations grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 14px 18px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          alignContent: "start",
        }}
      >
        {visible.map((char) => (
          <StationCard
            key={char.id}
            character={char}
            friendship={friendship[char.id] ?? 0}
            onEnter={() => enterStation(char.id as Exclude<StationId, null>)}
          />
        ))}
        {lockedCount > 0 && (
          <LockedSlot count={lockedCount} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Station card                                                                */
/* -------------------------------------------------------------------------- */

interface StationCardProps {
  character:  DenCharacter;
  friendship: number;
  onEnter:    () => void;
}

function StationCard({ character, friendship, onEnter }: StationCardProps) {
  const accent = SPECIALTY_ACCENT[character.specialty];
  return (
    <button
      onClick={onEnter}
      style={{
        position: "relative",
        padding: "10px 10px 12px",
        borderRadius: 18,
        background:
          "linear-gradient(180deg, rgba(36, 51, 88, 0.7), rgba(15, 24, 40, 0.7))",
        border: `2.5px solid ${accent}`,
        boxShadow: `0 4px 0 rgba(0,0,0,0.4), 0 0 14px ${accent}55`,
        color: "#fff",
        cursor: "pointer",
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        font: "inherit",
      }}
    >
      <div
        style={{
          alignSelf: "stretch",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <span
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            background: `${accent}33`,
            border: `1.5px solid ${accent}`,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: accent,
            textTransform: "uppercase",
          }}
        >
          {SPECIALTY_LABEL[character.specialty]}
        </span>
        <FriendshipDots count={friendship} />
      </div>

      <div style={{ marginTop: 4 }}>
        <Chibi character={character} size={88} />
      </div>

      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 17,
          letterSpacing: 0.5,
          color: "#fff",
          marginTop: 2,
        }}
      >
        {character.displayName}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.55)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {character.miniGame.replace("-", " ")}
      </div>
    </button>
  );
}

function FriendshipDots({ count }: { count: number }) {
  // Show up to 5 hearts, dim ones for un-earned levels.
  const max = 5;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            fontSize: 10,
            opacity: i < count ? 1 : 0.18,
            color: i < count ? "#E94560" : "rgba(255,255,255,0.3)",
          }}
        >♥</span>
      ))}
    </div>
  );
}

function LockedSlot({ count }: { count: number }) {
  return (
    <div
      style={{
        padding: "10px 10px 12px",
        borderRadius: 18,
        background: "rgba(0, 0, 0, 0.25)",
        border: "2px dashed rgba(255,255,255,0.18)",
        opacity: 0.85,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 200,
      }}
    >
      <div style={{ fontSize: 32, opacity: 0.6 }}>🔒</div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, fontWeight: 700,
          letterSpacing: "0.12em",
          color: "rgba(255,255,255,0.55)",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        {count} more<br/>to discover
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function pillStyle(): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: "1.5px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    cursor: "pointer",
  };
}
