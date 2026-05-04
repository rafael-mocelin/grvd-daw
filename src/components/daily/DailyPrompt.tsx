/**
 * DailyPrompt — first sub-screen of Daily Drop.
 *
 * Shows today's brief: vibe, BPM, key, palette size, time limit. The
 * START button kicks off the timer and switches phase to "cook".
 *
 * If the player has already submitted today, the screen swaps the
 * primary CTA for "see today's submission" + a streak hero shot.
 */

import { useEffect } from "react";
import { TODAY_PROMPT } from "../../data/dailyPrompts";
import { useDailyStore } from "../../lib/dailyStore";

interface DailyPromptProps {
  onStart: () => void;
  onQuit:  () => void;
}

export function DailyPrompt({ onStart, onQuit }: DailyPromptProps) {
  const streak             = useDailyStore((s) => s.streak);
  const hasSubmittedToday  = useDailyStore((s) => s.hasSubmittedToday);
  const startTimer         = useDailyStore((s) => s.startTimer);
  const setPhase           = useDailyStore((s) => s.setPhase);
  const submitted          = hasSubmittedToday();

  // Reset cook-phase state every time we land here so re-entries are
  // clean.
  useEffect(() => {
    useDailyStore.getState().clearPicks();
    useDailyStore.getState().stopTimer();
  }, []);

  function handleStart() {
    startTimer(TODAY_PROMPT.timeLimitSec);
    setPhase("cook");
    onStart();
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "24px 18px 28px",
        gap: 18,
      }}
    >
      {/* Top bar — streak + back */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={onQuit}
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
        <StreakBadge streak={streak} />
      </div>

      {/* Hero card */}
      <div
        style={{
          flex: 1,
          padding: "28px 22px",
          borderRadius: 22,
          background:
            "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), inset 0 -3px 0 rgba(0,0,0,0.35), 0 4px 0 rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.55), 0 0 28px rgba(233, 69, 96, 0.30)",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 0,
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.34em",
            color: "#E94560",
            textTransform: "uppercase",
          }}
        >
          ★ TODAY'S DROP ★
        </div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 38,
            lineHeight: 1.05,
            color: "#fff",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(0,0,0,0.55), 0 0 24px rgba(233, 69, 96, 0.4)",
          }}
        >
          {TODAY_PROMPT.vibe}
        </div>
        <div
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui",
            fontSize: 14,
            color: "rgba(255,255,255,0.70)",
            fontStyle: "italic",
            lineHeight: 1.5,
          }}
        >
          {TODAY_PROMPT.flavor}
        </div>

        {/* Stat strip — chunky pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
          <Stat label="BPM"      value={String(TODAY_PROMPT.bpm)} />
          <Stat label="KEY"      value={TODAY_PROMPT.key} />
          <Stat label="PALETTE"  value={`pick ${TODAY_PROMPT.paletteCap}/${TODAY_PROMPT.palette.length}`} />
          <Stat label="TIME"     value={`${Math.floor(TODAY_PROMPT.timeLimitSec / 60)} min`} />
          {TODAY_PROMPT.modifier && (
            <Stat label="TWIST" value={TODAY_PROMPT.modifier} accent="#facc15" />
          )}
        </div>

        {/* Decorative footer flair */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 16,
            borderTop: "1.5px dashed rgba(255,255,255,0.12)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.06em",
          }}
        >
          {submitted
            ? "you already shipped today's drop — your streak is safe"
            : "everyone gets the same prompt today. ship a track that fits the vibe."}
        </div>
      </div>

      {/* Primary CTA */}
      <button
        onClick={submitted ? onQuit : handleStart}
        style={{
          padding: "16px 24px",
          borderRadius: 18,
          border: "2.5px solid #0a0f1c",
          background: submitted
            ? "linear-gradient(180deg, #4a4a4a, #2a2a2a)"
            : "linear-gradient(180deg, #ff7a8e, #b8253a)",
          color: "#fff",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 22,
          letterSpacing: 1,
          cursor: "pointer",
          boxShadow:
            "inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -3px 0 rgba(0,0,0,0.35), 0 5px 0 rgba(0,0,0,0.5)",
        }}
      >
        {submitted ? "ALREADY SUBMITTED — SEE YOU TOMORROW" : "START · 10:00"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        background: accent ? `${accent}20` : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${accent ? `${accent}77` : "rgba(255,255,255,0.14)"}`,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ color: accent ?? "rgba(255,255,255,0.45)" }}>{label}</span>
      <span style={{ color: accent ?? "#fff" }}>{value}</span>
    </div>
  );
}

function StreakBadge({ streak }: { streak: number }) {
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: streak > 0
          ? "linear-gradient(180deg, rgba(233, 69, 96, 0.22), rgba(212, 160, 23, 0.18))"
          : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${streak > 0 ? "rgba(233, 69, 96, 0.6)" : "rgba(255,255,255,0.16)"}`,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "#fff",
        textTransform: "uppercase",
      }}
    >
      🔥 {streak}-day streak
    </div>
  );
}
