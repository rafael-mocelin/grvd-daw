/**
 * RunMap — top-of-screen progression header for Studio Run.
 *
 * Renders the 6-node path (vibe → drums → hat → melody → polish → boss)
 * as a row of dots. Past stages show their picked card glyph. Current
 * stage glows. Future stages are dim.
 *
 * Slay-the-Spire-shaped UI but flatter — a single linear path for v1.
 * Branching paths are a Phase 2 build.
 */

import { useRunStore } from "../../lib/runStore";
import {
  STAGE_ORDER,
  STAGE_LABEL,
  type StageId,
  type SoundCard,
  type VibeCard,
  type PolishCard,
} from "../../data/runDraws";

interface RunMapProps {
  onQuit: () => void;
}

export function RunMap({ onQuit }: RunMapProps) {
  const currentStage = useRunStore((s) => s.currentStage);
  const picks        = useRunStore((s) => s.picks);
  const score        = useRunStore((s) => s.score);
  const bestScore    = useRunStore((s) => s.bestScore);

  return (
    <div
      style={{
        flexShrink: 0,
        padding: "10px 12px 12px",
        background:
          "linear-gradient(180deg, rgba(15, 24, 40, 0.95) 0%, rgba(15, 24, 40, 0.6) 100%)",
        borderBottom: "2px solid rgba(0, 0, 0, 0.6)",
      }}
    >
      {/* Top row — quit + best */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
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
          STUDIO <span style={{ color: "#E94560" }}>RUN</span>
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "5px 11px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1.5px solid rgba(255,255,255,0.16)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.85)",
          }}
        >
          BEST {bestScore} · NOW {score}
        </div>
      </div>

      {/* Map row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        {STAGE_ORDER.map((stage, i) => (
          <div key={stage} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <Node stage={stage} active={stage === currentStage} done={isDone(stage, currentStage)} pickGlyph={getPickGlyph(stage, picks)} />
            {i < STAGE_ORDER.length - 1 && (
              <Connector active={STAGE_ORDER.indexOf(currentStage) > i} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                        */
/* -------------------------------------------------------------------------- */

function isDone(stage: StageId, current: StageId): boolean {
  return STAGE_ORDER.indexOf(stage) < STAGE_ORDER.indexOf(current);
}

function getPickGlyph(
  stage: StageId,
  picks: ReturnType<typeof useRunStore.getState>["picks"],
): string | null {
  if (stage === "boss") return null;
  if (stage === "polish") {
    const polishes = picks.filter((p) => p.kind === "polish");
    if (polishes.length === 0) return null;
    return (polishes[0].card as PolishCard).glyph;
  }
  const found = picks.find((p) => p.kind === stage);
  if (!found) return null;
  if (found.kind === "vibe")   return (found.card as VibeCard).glyph;
  return (found.card as SoundCard).glyph;
}

function Node({
  stage, active, done, pickGlyph,
}: { stage: StageId; active: boolean; done: boolean; pickGlyph: string | null }) {
  const baseSize = 30;
  const isBoss = stage === "boss";
  const ringColor = active ? "#E94560" : done ? "#4ade80" : "rgba(255,255,255,0.18)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
      <div
        style={{
          width: baseSize, height: baseSize,
          borderRadius: isBoss ? 8 : "50%",
          border: `2.5px solid ${ringColor}`,
          background: active
            ? "linear-gradient(180deg, rgba(233, 69, 96, 0.35), rgba(15, 24, 40, 0.65))"
            : done
              ? "linear-gradient(180deg, rgba(74, 222, 128, 0.25), rgba(15, 24, 40, 0.65))"
              : "rgba(15, 24, 40, 0.65)",
          display: "grid",
          placeItems: "center",
          fontSize: 13,
          boxShadow: active ? `0 0 12px ${ringColor}99` : undefined,
          color: "#fff",
        }}
      >
        {pickGlyph ?? (isBoss ? "🏁" : null)}
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: active ? "#E94560" : done ? "#4ade80" : "rgba(255,255,255,0.4)",
          textTransform: "uppercase",
        }}
      >
        {STAGE_LABEL[stage]}
      </div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        height: 2,
        background: active ? "#4ade80" : "rgba(255,255,255,0.12)",
        marginTop: -14,  // pull line up to the node center
      }}
    />
  );
}
