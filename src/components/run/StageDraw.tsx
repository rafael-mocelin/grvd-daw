/**
 * StageDraw — the 3-card draw screen at every non-boss stage.
 *
 * Shows the current stage's prompt + 3 cards. Tapping a card auditions
 * it (for vibe / sound stages); tapping its CONFIRM button locks the
 * pick and advances the run. A REROLL button shuffles the draw — limited
 * by run-state policy (free pre-vibe, costly later — TODO in prototype).
 *
 * Audio:
 *   - vibe stage: no audio (just BPM/key on the card)
 *   - drums/hat/melody: audition adds the layer; confirming locks it.
 *     If the player auditions a card and then picks a different one,
 *     the auditioned layer is removed.
 *   - polish: visual-only in the prototype.
 */

import { useEffect, useState } from "react";
import { useRunStore } from "../../lib/runStore";
import {
  type VibeCard,
  type SoundCard,
  type PolishCard,
  STAGE_LABEL,
} from "../../data/runDraws";
import { addLayer, removeLayer } from "../../audio/runEngine";

export function StageDraw() {
  const currentStage = useRunStore((s) => s.currentStage);
  const draw         = useRunStore((s) => s.draw);
  const pick         = useRunStore((s) => s.pick);
  const reroll       = useRunStore((s) => s.reroll);
  const masterBpm    = useRunStore((s) => s.getMasterBpm());

  // Tracks which card is currently being auditioned (for sound stages).
  const [auditioning, setAuditioning] = useState<string | null>(null);

  // Stop the audition layer when leaving the stage.
  useEffect(() => {
    return () => {
      if (auditioning) {
        const card = (draw as { id: string; soundId?: string }[]).find((c) => c.id === auditioning);
        const sid = (card as SoundCard | undefined)?.soundId;
        if (sid) removeLayer(sid);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStage]);

  function handleAudition(cardId: string) {
    if (currentStage === "vibe" || currentStage === "polish") return;

    const card = (draw as SoundCard[]).find((c) => c.id === cardId);
    if (!card) return;

    // Remove previous audition's layer
    if (auditioning && auditioning !== cardId) {
      const prev = (draw as SoundCard[]).find((c) => c.id === auditioning);
      if (prev) removeLayer(prev.soundId);
    }

    if (auditioning === cardId) {
      // tap-toggle off
      removeLayer(card.soundId);
      setAuditioning(null);
    } else {
      void addLayer(card.soundId, masterBpm);
      setAuditioning(cardId);
    }
  }

  function handleConfirm(cardId: string) {
    // For sound stages, leave the auditioned layer playing — it's now
    // our locked pick. For other audition cards, stop them.
    if (auditioning && auditioning !== cardId) {
      const prev = (draw as SoundCard[]).find((c) => c.id === auditioning);
      if (prev) removeLayer(prev.soundId);
    }
    setAuditioning(null);
    pick(cardId);
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "16px 14px 18px",
        gap: 14,
        minHeight: 0,
      }}
    >
      <StageHeading stage={currentStage} masterBpm={masterBpm} />

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {(draw as { id: string }[]).map((card) => {
          const isAuditioning = auditioning === (card as { id: string }).id;
          if (currentStage === "vibe") {
            return <VibeDrawCard
              key={card.id}
              card={card as VibeCard}
              onConfirm={() => handleConfirm(card.id)}
            />;
          }
          if (currentStage === "polish") {
            return <PolishDrawCard
              key={card.id}
              card={card as PolishCard}
              onConfirm={() => handleConfirm(card.id)}
            />;
          }
          return <SoundDrawCard
            key={card.id}
            card={card as SoundCard}
            auditioning={isAuditioning}
            onAudition={() => handleAudition(card.id)}
            onConfirm={() => handleConfirm(card.id)}
          />;
        })}
      </div>

      <button
        onClick={reroll}
        style={{
          padding: "10px 14px",
          borderRadius: 12,
          border: "1.5px solid rgba(255,255,255,0.18)",
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
        ↻ reroll draw
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function StageHeading({ stage, masterBpm }: { stage: string; masterBpm: number }) {
  const label = STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage;
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 14,
        background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
        border: "2px solid #0a0f1c",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), 0 3px 0 rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.32em",
          color: "#E94560",
          textTransform: "uppercase",
        }}
      >
        DRAW · 3 CARDS · PICK 1
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 18,
          color: "#fff",
          letterSpacing: 1,
        }}
      >
        {label}
      </div>
      {stage !== "vibe" && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
          }}
        >· {masterBpm} BPM</div>
      )}
    </div>
  );
}

interface DrawCardShellProps {
  accent:    string;
  glyph:     string;
  title:     string;
  flavor:    string;
  meta:      string;
  active?:   boolean;
  onClick?:  () => void;
  onConfirm: () => void;
  hasAudition?: boolean;
  auditioning?: boolean;
}

function DrawCardShell({
  accent, glyph, title, flavor, meta,
  active, onClick, onConfirm,
  hasAudition, auditioning,
}: DrawCardShellProps) {
  return (
    <div
      style={{
        padding: "14px 14px 12px",
        borderRadius: 16,
        background: active
          ? "linear-gradient(180deg, rgba(36, 51, 88, 0.85), rgba(15, 24, 40, 0.85))"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.55), rgba(15, 24, 40, 0.55))",
        border: `2.5px solid ${accent}`,
        boxShadow: `0 4px 0 rgba(0,0,0,0.4), 0 0 ${active ? "20px" : "12px"} ${accent}55`,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 50, height: 50,
            borderRadius: 14,
            background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,0.4))`,
            border: "2px solid #0a0f1c",
            display: "grid", placeItems: "center",
            fontSize: 24,
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3)",
          }}
        >{glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 18, color: "#fff", letterSpacing: 0.5,
              lineHeight: 1.05,
            }}
          >{title}</div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
              color: accent,
              textTransform: "uppercase",
              marginTop: 4,
            }}
          >{meta}</div>
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui",
          fontSize: 12, color: "rgba(255,255,255,0.7)",
          fontStyle: "italic", lineHeight: 1.5,
        }}
      >{flavor}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {hasAudition && (
          <button
            onClick={onClick}
            style={{
              flex: 1,
              padding: "9px 10px",
              borderRadius: 10,
              border: "1.5px solid rgba(255,255,255,0.18)",
              background: auditioning
                ? "linear-gradient(180deg, rgba(34, 211, 238, 0.4), rgba(0,0,0,0.4))"
                : "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            {auditioning ? "■ stop" : "▶ audition"}
          </button>
        )}
        <button
          onClick={onConfirm}
          style={{
            flex: 1,
            padding: "9px 10px",
            borderRadius: 10,
            border: "2px solid #0a0f1c",
            background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,0.55))`,
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: "pointer",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 3px 0 rgba(0,0,0,0.4)",
          }}
        >
          PICK
        </button>
      </div>
    </div>
  );
}

function VibeDrawCard({ card, onConfirm }: { card: VibeCard; onConfirm: () => void }) {
  return (
    <DrawCardShell
      accent={card.accent}
      glyph={card.glyph}
      title={card.name}
      flavor={card.flavor}
      meta={`${card.bpm} BPM · ${card.key}`}
      onConfirm={onConfirm}
    />
  );
}

function PolishDrawCard({ card, onConfirm }: { card: PolishCard; onConfirm: () => void }) {
  return (
    <DrawCardShell
      accent={card.accent}
      glyph={card.glyph}
      title={card.name}
      flavor={card.flavor}
      meta="POLISH"
      onConfirm={onConfirm}
    />
  );
}

interface SoundDrawCardProps {
  card:        SoundCard;
  auditioning: boolean;
  onAudition:  () => void;
  onConfirm:   () => void;
}

function SoundDrawCard({ card, auditioning, onAudition, onConfirm }: SoundDrawCardProps) {
  const meta = card.key
    ? `${card.nativeBpm} BPM · ${card.key}`
    : `${card.nativeBpm} BPM`;
  return (
    <DrawCardShell
      accent={auditioning ? "#22d3ee" : "#E94560"}
      glyph={card.glyph}
      title={card.name}
      flavor={card.flavor}
      meta={meta}
      active={auditioning}
      hasAudition
      auditioning={auditioning}
      onClick={onAudition}
      onConfirm={onConfirm}
    />
  );
}
