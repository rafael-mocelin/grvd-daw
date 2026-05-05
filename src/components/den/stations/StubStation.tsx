/**
 * StubStation — placeholder station for characters whose mini-game is
 * not yet implemented. Tells the player it's coming and bumps friendship
 * for the visit.
 *
 * Matches DrummaStation's top-bar pattern so the back button is in the
 * same place and impossible to miss across stations. The previous
 * implementation had a loose button at the top of a flex column which
 * was easy to confuse with the page header — fixed by giving the stub a
 * sticky chunky-chrome bar identical to Drumma's.
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Sticky top bar — same shape as DrummaStation so back is in
       *  the same spot wherever the player is in the Den. */}
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
          onClick={onExit}
          style={{
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
            fontFamily: "'Lilita One', system-ui",
            fontSize: 17,
            color: "#fff",
            letterSpacing: 0.6,
          }}
        >
          {char.displayName}
        </div>
      </div>

      {/* Body — character + lore + coming-soon pill */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 18,
          padding: "20px 18px",
          overflowY: "auto",
        }}
      >
        <Chibi character={char} size={140} />
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

        {/* Big secondary back button at the bottom — ensures even players
         *  who miss the top bar can leave the station from the body. */}
        <button
          onClick={onExit}
          style={{
            marginTop: 8,
            padding: "12px 22px",
            borderRadius: 14,
            border: "2px solid #0a0f1c",
            background: "linear-gradient(180deg, #ff7a8e, #b8253a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 15,
            letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.5)",
          }}
        >
          ← BACK TO THE DEN
        </button>
      </div>
    </div>
  );
}
