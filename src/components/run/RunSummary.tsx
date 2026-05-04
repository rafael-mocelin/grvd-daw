/**
 * RunSummary — the boss-node screen.
 *
 * Shows the run's score, the picks taken, the score breakdown, and a
 * "another?" CTA. Records the run into career stats on mount.
 *
 * Audio policy: the engine is left running so the player can hear the
 * track they just built. Tapping ANOTHER or QUIT stops everything.
 */

import { useEffect } from "react";
import { useRunStore } from "../../lib/runStore";
import { addLayer, clearAllLayers } from "../../audio/runEngine";
import type { PolishCard, SoundCard, VibeCard } from "../../data/runDraws";

interface RunSummaryProps {
  onExit: () => void;
}

export function RunSummary({ onExit }: RunSummaryProps) {
  const score      = useRunStore((s) => s.score);
  const bestScore  = useRunStore((s) => s.bestScore);
  const runCount   = useRunStore((s) => s.runCount);
  const beginRun   = useRunStore((s) => s.beginRun);
  const endRun     = useRunStore((s) => s.endRun);
  const vibe       = useRunStore((s) => s.getVibe());
  const drums      = useRunStore((s) => s.getDrums());
  const hat        = useRunStore((s) => s.getHat());
  const melody     = useRunStore((s) => s.getMelody());
  const polish     = useRunStore((s) => s.getPolish());
  const masterBpm  = useRunStore((s) => s.getMasterBpm());

  // Record the run into career stats on mount. endRun is idempotent
  // because beginRun is what reopens a fresh run.
  useEffect(() => {
    endRun();
    // Make sure the full track is playing so the player hears their result.
    // Stems may have been auditioned only — if any aren't in the engine yet
    // because the player skipped audition, kick them on now.
    if (drums)  void addLayer(drums.soundId,  masterBpm);
    if (hat)    void addLayer(hat.soundId,    masterBpm);
    if (melody) void addLayer(melody.soundId, masterBpm);
    return () => { clearAllLayers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stars = score >= 850 ? 5
              : score >= 700 ? 4
              : score >= 550 ? 3
              : score >= 350 ? 2
              : score > 0    ? 1 : 0;

  const newBest = score >= bestScore && score > 0;

  function handleAnother() {
    clearAllLayers();
    beginRun();
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px 16px 18px",
        gap: 16,
        minHeight: 0,
        overflowY: "auto",
        background:
          "radial-gradient(ellipse at 50% -10%, rgba(233, 69, 96, 0.30) 0%, rgba(15, 24, 40, 0) 60%)",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.32em",
            color: "#facc15",
            textTransform: "uppercase",
          }}
        >
          ★ RUN COMPLETE — RUN #{runCount} ★
        </div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 56,
            color: "#fff",
            letterSpacing: 1,
            lineHeight: 1,
            marginTop: 10,
            textShadow: "0 3px 0 rgba(0,0,0,0.55), 0 0 28px rgba(233, 69, 96, 0.5)",
          }}
        >
          {score}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.12em",
            marginTop: 4,
          }}
        >
          / 1000 · BEST {bestScore}{newBest && " — NEW BEST"}
        </div>
        <div style={{ marginTop: 8, fontSize: 22, letterSpacing: 4 }}>
          {"★".repeat(stars)}<span style={{ opacity: 0.25 }}>{"★".repeat(5 - stars)}</span>
        </div>
      </div>

      {/* Track readout */}
      <div
        style={{
          padding: "14px 14px 12px",
          borderRadius: 16,
          background: "linear-gradient(180deg, rgba(36, 51, 88, 0.7), rgba(15, 24, 40, 0.7))",
          border: "2px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >YOUR TRACK</div>
        {vibe   && <SummaryRow label="VIBE"   card={vibe}   accent={vibe.accent} />}
        {drums  && <SummaryRow label="DRUMS"  card={drums}  accent="#E94560" />}
        {hat    && <SummaryRow label="HAT"    card={hat}    accent="#22d3ee" />}
        {melody && <SummaryRow label="MELODY" card={melody} accent="#4ade80" />}
        {polish.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {polish.map((p) => (
              <span
                key={p.id}
                style={{
                  padding: "3px 9px",
                  borderRadius: 999,
                  background: `${p.accent}25`,
                  border: `1.5px solid ${p.accent}77`,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: p.accent,
                  textTransform: "uppercase",
                }}
              >{p.glyph} {p.name}</span>
            ))}
          </div>
        )}
      </div>

      {/* CTA row */}
      <div style={{ display: "flex", gap: 10, marginTop: "auto" }}>
        <button
          onClick={onExit}
          style={{
            flex: 1,
            padding: "13px 14px",
            borderRadius: 14,
            border: "1.5px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          quit
        </button>
        <button
          onClick={handleAnother}
          style={{
            flex: 2,
            padding: "13px 14px",
            borderRadius: 14,
            border: "2.5px solid #0a0f1c",
            background: "linear-gradient(180deg, #ff7a8e, #b8253a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 17,
            letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.5)",
          }}
        >
          ANOTHER RUN →
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function SummaryRow({
  label, card, accent,
}: {
  label:  string;
  card:   VibeCard | SoundCard;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
        borderBottom: "1px dashed rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.14em",
          color: accent,
          textTransform: "uppercase",
          width: 60,
          flexShrink: 0,
        }}
      >{label}</div>
      <div style={{ fontSize: 18 }}>{card.glyph}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 14, color: "#fff", letterSpacing: 0.3,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >{card.name}</div>
      </div>
    </div>
  );
}
