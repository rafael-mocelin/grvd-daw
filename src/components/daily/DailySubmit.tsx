/**
 * DailySubmit — the post-cook wrap-up screen.
 *
 * Shows: a celebratory header, the streak after this submission,
 * a mock feed of "other players' Dailies" to demonstrate the
 * comparison-without-competition loop. Tapping a feed card just
 * shows a flash of the entry — full audio playback of others'
 * tracks is server work (out of scope for prototype).
 */

import { useEffect, useState } from "react";
import { useDailyStore } from "../../lib/dailyStore";
import { TODAY_PROMPT } from "../../data/dailyPrompts";
import { REAL_SOUNDS } from "../../data/sounds";
import { clearAllLayers } from "../../audio/dailyEngine";

interface DailySubmitProps {
  onExit: () => void;
}

/**
 * Mock feed of other players' submissions. In production these come
 * from Supabase via a "submissions today" query. The prototype just
 * hardcodes a few so the comparison loop is demonstrable.
 */
const MOCK_FEED: { id: string; name: string; picks: string[]; hearts: number; emoji: string }[] = [
  {
    id:     "feed-1",
    name:   "@miloblue",
    picks:  ["r-drums-150", "r-808-144-Fm", "r-bells-Fm", "r-hat-128"],
    hearts: 142,
    emoji:  "🌌",
  },
  {
    id:     "feed-2",
    name:   "@nyx.99",
    picks:  ["r-drums-165-Fm", "r-808-150-Dsm", "r-hat-150"],
    hearts: 88,
    emoji:  "🪐",
  },
  {
    id:     "feed-3",
    name:   "@rida_x",
    picks:  ["r-drums-150", "r-melodic-Gm", "r-hat-150", "r-808-144-Fm"],
    hearts: 207,
    emoji:  "🌃",
  },
  {
    id:     "feed-4",
    name:   "@_oliv_",
    picks:  ["r-drums-165-Fm", "r-bells-Fm", "r-hat-128"],
    hearts: 51,
    emoji:  "🚇",
  },
];

export function DailySubmit({ onExit }: DailySubmitProps) {
  const picks            = useDailyStore((s) => s.picks);
  const recordSubmission = useDailyStore((s) => s.recordSubmission);
  const streak           = useDailyStore((s) => s.streak);
  const [hearted, setHearted] = useState<Set<string>>(new Set());

  // Stop the live audio mix on entry to this phase. In a real app the
  // submission would be the rendered WAV; the prototype just kills the
  // engine.
  useEffect(() => {
    clearAllLayers();
  }, []);

  // Record the submission once on mount. recordSubmission is idempotent
  // for same-day re-entries.
  useEffect(() => {
    recordSubmission();
  }, [recordSubmission]);

  function toggleHeart(id: string) {
    setHearted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Hero */}
      <div
        style={{
          flexShrink: 0,
          padding: "26px 18px 18px",
          textAlign: "center",
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(233, 69, 96, 0.30) 0%, rgba(15, 24, 40, 0) 60%)",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.34em",
            color: "#facc15",
            textTransform: "uppercase",
          }}
        >
          ★ DAILY DROP COMPLETE ★
        </div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 32,
            color: "#fff",
            letterSpacing: 1,
            marginTop: 6,
            textShadow: "0 2px 0 rgba(0,0,0,0.5), 0 0 24px rgba(233, 69, 96, 0.4)",
          }}
        >
          {streak}-day streak 🔥
        </div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui",
            fontSize: 13,
            color: "rgba(255,255,255,0.65)",
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          you shipped today's drop. see what everyone else made.
        </div>
      </div>

      {/* Your submission */}
      <div style={{ padding: "0 14px" }}>
        <div
          style={{
            padding: "14px 14px 12px",
            borderRadius: 16,
            background: "linear-gradient(180deg, rgba(36, 51, 88, 0.7), rgba(15, 24, 40, 0.7))",
            border: "2px solid #E94560",
            boxShadow: "0 0 18px rgba(233, 69, 96, 0.4)",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.18em",
              color: "#E94560",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >YOUR DROP — {TODAY_PROMPT.vibe}</div>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 16,
              color: "#fff",
              letterSpacing: 0.4,
            }}
          >{picks.length} sounds · {TODAY_PROMPT.bpm} BPM · {TODAY_PROMPT.key}</div>
          <SoundChips ids={picks} />
        </div>
      </div>

      {/* Feed header */}
      <div style={{ padding: "20px 14px 8px" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
          }}
        >
          today's feed · same prompt, everyone
        </div>
      </div>

      {/* Mock feed */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0 14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {MOCK_FEED.map((entry) => (
          <FeedCard
            key={entry.id}
            entry={entry}
            hearted={hearted.has(entry.id)}
            onHeart={() => toggleHeart(entry.id)}
          />
        ))}
      </div>

      {/* Exit CTA */}
      <div style={{ padding: "0 14px 18px", flexShrink: 0 }}>
        <button
          onClick={onExit}
          style={{
            width: "100%",
            padding: "14px 18px",
            borderRadius: 14,
            border: "2px solid #0a0f1c",
            background: "linear-gradient(180deg, #ff7a8e, #b8253a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 16,
            letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.5)",
          }}
        >
          DONE — SEE YOU TOMORROW
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function SoundChips({ ids }: { ids: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {ids.map((id) => {
        const s = REAL_SOUNDS.find((r) => r.id === id);
        if (!s) return null;
        return (
          <div
            key={id}
            style={{
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.45)",
              border: "1.5px solid rgba(255,255,255,0.12)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.8)",
              textTransform: "uppercase",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            <span>{s.glyph}</span>
            <span>{s.name}</span>
          </div>
        );
      })}
    </div>
  );
}

interface FeedCardProps {
  entry:   typeof MOCK_FEED[number];
  hearted: boolean;
  onHeart: () => void;
}

function FeedCard({ entry, hearted, onHeart }: FeedCardProps) {
  const heartCount = entry.hearts + (hearted ? 1 : 0);
  return (
    <div
      style={{
        padding: "12px 12px 10px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(36, 51, 88, 0.55), rgba(15, 24, 40, 0.55))",
        border: "1.5px solid rgba(255,255,255,0.10)",
        display: "flex",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 50, height: 50,
          borderRadius: 12,
          background: "linear-gradient(180deg, rgba(167, 139, 250, 0.25), rgba(34, 211, 238, 0.25))",
          border: "1.5px solid rgba(255,255,255,0.18)",
          display: "grid",
          placeItems: "center",
          fontSize: 28,
          flexShrink: 0,
        }}
      >{entry.emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 15, color: "#fff", letterSpacing: 0.3,
          }}
        >{entry.name}</div>
        <div style={{ marginTop: 2 }}><SoundChips ids={entry.picks} /></div>
      </div>
      <button
        onClick={onHeart}
        style={{
          background: hearted ? "rgba(233, 69, 96, 0.85)" : "transparent",
          border: `1.5px solid ${hearted ? "#0a0f1c" : "rgba(255,255,255,0.18)"}`,
          borderRadius: 999,
          padding: "5px 11px",
          color: "#fff",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          alignSelf: "center",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span>{hearted ? "♥" : "♡"}</span>
        <span>{heartCount}</span>
      </button>
    </div>
  );
}
