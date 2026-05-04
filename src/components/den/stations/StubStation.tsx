/**
 * StubStation — placeholder station for characters whose mini-game is
 * not yet implemented. Tells the player it's coming and bumps friendship
 * for the visit.
 */

import { getCharacter } from "../../../data/denCharacters";
import { Chibi } from "../Chibi";

interface StubStationProps {
  characterId: string;
  onExit:      () => void;
}

export function StubStation({ characterId, onExit }: StubStationProps) {
  const char = getCharacter(characterId);
  if (!char) return null;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "18px 14px",
        gap: 18,
      }}
    >
      <button
        onClick={onExit}
        style={{
          alignSelf: "flex-start",
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
        }}
      >
        ← back
      </button>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 18,
        }}
      >
        <Chibi character={char} size={140} />
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 28,
            color: "#fff",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(0,0,0,0.5)",
          }}
        >
          {char.displayName}
        </div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui",
            fontStyle: "italic",
            fontSize: 14,
            color: "rgba(255,255,255,0.65)",
            maxWidth: 320,
            lineHeight: 1.5,
          }}
        >
          {char.lore}
        </div>
        <div
          style={{
            padding: "10px 18px",
            borderRadius: 14,
            background: "rgba(167, 139, 250, 0.18)",
            border: "1.5px dashed rgba(167, 139, 250, 0.55)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {char.miniGame.replace("-", " ")} · coming soon
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.1em",
            marginTop: -6,
          }}
        >
          friendship +1 for the visit
        </div>
      </div>
    </div>
  );
}
