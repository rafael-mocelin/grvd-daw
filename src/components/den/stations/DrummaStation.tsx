/**
 * DrummaStation — DRUMMA's tap-pattern mini-game.
 *
 * 16-step grid x 3 rows (KICK / SNARE / HAT). Tap a cell to toggle. The
 * pattern loops live via the den engine while the screen is open. A
 * playhead column sweeps left to right showing the current step.
 *
 * Lock-it pins the pattern as the session's drum stem and returns to
 * the lobby — that stem becomes the seed of a saved track in the library.
 *
 * Bare-bones rhythm-game challenge: there's a HEADNOD meter that fills
 * as the player adds satisfying patterns (heuristic — kick on 1, snare
 * on 3, hats on every 16th, etc). It's a vibe meter, not a punishing
 * grade.
 */

import { useEffect, useState } from "react";
import { useDenStore } from "../../../lib/denStore";
import { getCharacter } from "../../../data/denCharacters";
import {
  startDrumPattern,
  stopDrumPattern,
  updateDrumPattern,
  getCurrentStepIndex,
  type DrumPattern,
} from "../../../audio/denEngine";
import { Chibi } from "../Chibi";

interface DrummaStationProps {
  onExit: () => void;
}

const ROWS: { key: keyof DrumPattern; label: string; accent: string }[] = [
  { key: "kick",  label: "KICK",  accent: "#E94560" },
  { key: "snare", label: "SNARE", accent: "#22d3ee" },
  { key: "hat",   label: "HAT",   accent: "#facc15" },
];

const STEPS = 16;

const DEFAULT_PATTERN: DrumPattern = {
  kick:  Array(STEPS).fill(false).map((_, i) => i === 0 || i === 8),
  snare: Array(STEPS).fill(false).map((_, i) => i === 4 || i === 12),
  hat:   Array(STEPS).fill(false).map((_, i) => i % 2 === 0),
};

const BPM = 96;

export function DrummaStation({ onExit }: DrummaStationProps) {
  const character = getCharacter("mochi")!;
  const setDraft  = useDenStore((s) => s.setDraftDrumPattern);
  const draft     = useDenStore((s) => s.draftDrumPattern);
  const saveDraft = useDenStore((s) => s.saveDraftToLibrary);

  const [pattern, setPattern] = useState<DrumPattern>(() => draft ?? DEFAULT_PATTERN);
  const [playing, setPlaying] = useState(false);
  const [stepHead, setStepHead] = useState(-1);
  const [hypeLine, setHypeLine] = useState<string | null>(null);
  const [showSavedToast, setShowSavedToast] = useState(false);

  // Hype-line ticker — pull a random line every 7s while the loop is on.
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const line = character.hypeLines[Math.floor(Math.random() * character.hypeLines.length)];
      setHypeLine(line);
      window.setTimeout(() => setHypeLine(null), 1800);
    };
    tick();
    const id = window.setInterval(tick, 7000);
    return () => window.clearInterval(id);
  }, [playing, character.hypeLines]);

  // Playhead update — rAF reads the engine's current step.
  useEffect(() => {
    if (!playing) {
      setStepHead(-1);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setStepHead(getCurrentStepIndex());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [playing]);

  // Audio cleanup on unmount.
  useEffect(() => {
    return () => { stopDrumPattern(); };
  }, []);

  function toggleCell(row: keyof DrumPattern, step: number) {
    const next: DrumPattern = {
      kick:  [...pattern.kick],
      snare: [...pattern.snare],
      hat:   [...pattern.hat],
    };
    next[row][step] = !next[row][step];
    setPattern(next);
    if (playing) {
      // Live update so the pattern reflects the change immediately.
      updateDrumPattern(next);
    }
  }

  async function handleTogglePlay() {
    if (playing) {
      stopDrumPattern();
      setPlaying(false);
    } else {
      await startDrumPattern(pattern, BPM);
      setPlaying(true);
    }
  }

  function handleLockIt() {
    stopDrumPattern();
    setPlaying(false);
    setDraft(pattern);
    setShowSavedToast(true);
    window.setTimeout(() => {
      // Auto-save and exit. In a fuller flow the player would visit
      // more stations and combine stems — for the v1 prototype the
      // drum pattern alone becomes a track.
      saveDraft();
      setShowSavedToast(false);
      onExit();
    }, 1400);
  }

  const headnod = computeHeadnod(pattern);
  const accent  = "#E94560";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
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
          onClick={() => { stopDrumPattern(); onExit(); }}
          style={pill()}
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
          DRUMMA <span style={{ color: accent }}>· tap the pattern</span>
        </div>
        <div style={{ flex: 1 }} />
        <HeadnodMeter pct={headnod} />
      </div>

      {/* Character + speech bubble */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 14px 8px",
          display: "flex",
          alignItems: "flex-end",
          gap: 14,
        }}
      >
        <Chibi character={character} size={84} />
        <div style={{ flex: 1, position: "relative", paddingBottom: 14 }}>
          <SpeechBubble line={hypeLine ?? "lay it down. one bar."} accent={accent} />
        </div>
      </div>

      {/* Step grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {ROWS.map((row) => (
          <Row
            key={row.key}
            label={row.label}
            accent={row.accent}
            steps={pattern[row.key]}
            stepHead={stepHead}
            onToggle={(step) => toggleCell(row.key, step)}
          />
        ))}

        {/* CTA row */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button
            onClick={handleTogglePlay}
            style={{
              flex: 1,
              padding: "13px 14px",
              borderRadius: 14,
              border: "2px solid #0a0f1c",
              background: playing
                ? "linear-gradient(180deg, #facc15, #a07a0c)"
                : "linear-gradient(180deg, #6bf395, #16a34a)",
              color: "#0a0f1c",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 16,
              letterSpacing: 0.5,
              cursor: "pointer",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.5)",
            }}
          >
            {playing ? "❚❚ STOP" : "▶ PLAY"}
          </button>
          <button
            onClick={handleLockIt}
            style={{
              flex: 1.5,
              padding: "13px 14px",
              borderRadius: 14,
              border: "2.5px solid #0a0f1c",
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
            LOCK IT IN →
          </button>
        </div>
      </div>

      {showSavedToast && (
        <div
          style={{
            position: "absolute",
            bottom: 80, left: 0, right: 0,
            display: "flex",
            justifyContent: "center",
            zIndex: 60,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #6bf395, #16a34a)",
              border: "2px solid #0a0f1c",
              color: "#0a0f1c",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 14,
              letterSpacing: 0.5,
              boxShadow: "0 4px 0 rgba(0,0,0,0.5)",
              animation: "drummaSaved 0.5s ease-out",
            }}
          >
            ✓ saved to library
          </div>
        </div>
      )}

      <style>{`
        @keyframes drummaSaved {
          0%   { transform: translateY(20px); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

interface RowProps {
  label:    string;
  accent:   string;
  steps:    boolean[];
  stepHead: number;
  onToggle: (step: number) => void;
}

function Row({ label, accent, steps, stepHead, onToggle }: RowProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingLeft: 4,
        }}
      >
        <div
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            background: `${accent}20`,
            border: `1.5px solid ${accent}77`,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: accent,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(16, minmax(0, 1fr))",
          gap: 3,
        }}
      >
        {steps.map((on, i) => {
          const isHead = stepHead === i;
          const isBeat = i % 4 === 0;
          return (
            <button
              key={i}
              onClick={() => onToggle(i)}
              aria-pressed={on}
              style={{
                aspectRatio: "1 / 1.4",
                borderRadius: 6,
                border: `1.5px solid ${on ? "#0a0f1c" : "rgba(0,0,0,0.6)"}`,
                background: on
                  ? `linear-gradient(180deg, ${accent}, ${accent}99)`
                  : isBeat
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.025)",
                cursor: "pointer",
                padding: 0,
                boxShadow: on
                  ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(0,0,0,0.4)"
                  : "inset 0 1px 0 rgba(255,255,255,0.05)",
                outline: isHead ? "2px solid #fff" : "none",
                outlineOffset: -1,
                transition: "outline 0.05s",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function HeadnodMeter({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <div
      style={{
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.4)",
        border: "1.5px solid rgba(255,255,255,0.16)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.65)",
      }}
    >
      <span>headnod</span>
      <div
        style={{
          width: 60, height: 6,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${(clamped * 100).toFixed(0)}%`,
            height: "100%",
            background: "linear-gradient(90deg, #facc15, #E94560)",
            transition: "width 0.18s ease",
          }}
        />
      </div>
    </div>
  );
}

function SpeechBubble({ line, accent }: { line: string; accent: string }) {
  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "inline-block",
          padding: "6px 12px",
          borderRadius: 14,
          background: "#fff",
          border: `2.5px solid ${accent}`,
          color: "#0a0f1c",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 13,
          letterSpacing: 0.4,
          boxShadow: "0 3px 0 rgba(0,0,0,0.45)",
        }}
      >
        {line}
      </div>
      <div
        style={{
          width: 10, height: 10,
          background: "#fff",
          border: `2.5px solid ${accent}`,
          borderTop: "none",
          borderRight: "none",
          transform: "rotate(45deg)",
          marginTop: -5,
          marginLeft: 14,
        }}
      />
    </div>
  );
}

/**
 * Heuristic vibe meter. Rewards: kick on 1 + 9, snare on 5 + 13, hats
 * spread across the bar, total density not too low / too high.
 *
 * Returns 0..1.
 */
function computeHeadnod(p: DrumPattern): number {
  let score = 0;

  // Kick foundation — ideal kick on step 0 and 8
  if (p.kick[0])  score += 0.18;
  if (p.kick[8])  score += 0.12;
  // Bonus for offbeat kicks
  if (p.kick[6] || p.kick[14]) score += 0.05;

  // Snare backbeat — ideal on 4 and 12
  if (p.snare[4])  score += 0.16;
  if (p.snare[12]) score += 0.16;
  // Penalize snare on 1 (sounds wrong unless intended)
  if (p.snare[0])  score -= 0.05;

  // Hat density — sweet spot is 6–12 of 16
  const hatCount = p.hat.filter(Boolean).length;
  if (hatCount >= 6 && hatCount <= 12) score += 0.18;
  else if (hatCount >= 4 && hatCount <= 14) score += 0.08;

  // Total density check — avoid empty / overstuffed bars
  const total = p.kick.filter(Boolean).length + p.snare.filter(Boolean).length + hatCount;
  if (total >= 8 && total <= 22) score += 0.10;
  if (total === 0) score = 0;

  return Math.max(0, Math.min(1, score));
}

function pill(): React.CSSProperties {
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
