/**
 * ComboCodex — discovery tracker for jam combos.
 *
 * A right-side slide-out panel that lists every combo. Discovered ones
 * show full art (name, flavor, accent, accessory). Undiscovered ones
 * show a silhouette + the count of how many discovered, teasing the
 * existence of more without giving the recipe away.
 *
 * Trigger from the JAM top bar. Persistence is the parent's job — this
 * component is pure presentation. The parent passes the Set of
 * discovered ids and decides when to mount/unmount.
 */

import type { Accessory, JamCombo } from "../../data/jamCombos";
import { COMBOS } from "../../data/jamCombos";

interface ComboCodexProps {
  discoveredIds: Set<string>;
  onClose:       () => void;
}

export function ComboCodex({ discoveredIds, onClose }: ComboCodexProps) {
  const total       = COMBOS.length;
  const discovered  = COMBOS.filter((c) => discoveredIds.has(c.id)).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 220,
        display: "flex",
        animation: "comboCodexIn 0.22s ease-out both",
      }}
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        style={{
          flex: 1,
          background: "rgba(8, 10, 24, 0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          cursor: "pointer",
        }}
      />

      {/* panel */}
      <div
        style={{
          width: "min(100%, 460px)",
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          borderLeft: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 2px 0 0 rgba(255,255,255,0.18), 0 0 32px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          animation: "comboCodexSlide 0.32s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* header */}
        <div
          style={{
            flexShrink: 0,
            padding: "16px 18px 12px",
            borderBottom: "1.5px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.32em",
              color: "#E94560",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            ★ COMBO CODEX ★
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 26,
                color: "#fff",
                letterSpacing: 1,
                lineHeight: 1.05,
                textShadow: "0 2px 0 rgba(0,0,0,0.6)",
              }}
            >
              YOUR FINDS
            </div>
            <button
              onClick={onClose}
              aria-label="close"
              style={{
                width: 28, height: 28, borderRadius: 14,
                border: "1.5px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.7)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14, fontWeight: 700,
                cursor: "pointer",
                padding: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.06em",
            }}
          >
            {discovered} / {total} discovered
          </div>
          {/* progress bar */}
          <div style={{
            marginTop: 8,
            height: 4,
            background: "rgba(255,255,255,0.08)",
            borderRadius: 2,
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${(discovered / total) * 100}%`,
              background: "linear-gradient(90deg, #E94560, #f3c44a)",
              transition: "width 0.4s cubic-bezier(.34,1.56,.64,1)",
            }} />
          </div>
        </div>

        {/* grid */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            alignContent: "start",
          }}
        >
          {COMBOS.map((combo) => {
            const found = discoveredIds.has(combo.id);
            return found
              ? <DiscoveredCard key={combo.id} combo={combo} />
              : <UndiscoveredCard key={combo.id} combo={combo} />;
          })}
        </div>

        <div
          style={{
            flexShrink: 0,
            padding: "10px 18px 14px",
            borderTop: "1.5px solid rgba(255,255,255,0.10)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "0.08em",
            textAlign: "center",
          }}
        >
          drop sounds on characters to discover combos
        </div>

        <style>{`
          @keyframes comboCodexIn {
            0%   { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes comboCodexSlide {
            0%   { transform: translateX(100%); }
            100% { transform: translateX(0);    }
          }
        `}</style>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Card variants                                                               */
/* -------------------------------------------------------------------------- */

function DiscoveredCard({ combo }: { combo: JamCombo }) {
  return (
    <div
      style={{
        padding: "12px 12px 10px",
        borderRadius: 14,
        background: "linear-gradient(180deg, rgba(36, 51, 88, 0.7) 0%, rgba(15, 24, 40, 0.7) 100%)",
        border: `2px solid ${combo.accent}`,
        boxShadow: `0 0 18px ${combo.accent}55, inset 0 1px 0 rgba(255,255,255,0.1)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <AccessoryDot accessory={combo.accessory} accent={combo.accent} />
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: combo.accent,
            textTransform: "uppercase",
          }}
        >
          +{combo.xpBonus} XP
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 16,
          color: "#fff",
          letterSpacing: 0.5,
          lineHeight: 1.05,
          textShadow: `0 0 10px ${combo.accent}88`,
          marginBottom: 4,
        }}
      >
        {combo.name}
      </div>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui",
          fontSize: 11,
          color: "rgba(255,255,255,0.65)",
          lineHeight: 1.45,
        }}
      >
        {combo.flavor}
      </div>
    </div>
  );
}

function UndiscoveredCard({ combo }: { combo: JamCombo }) {
  // Just show a silhouette + a pithy hint based on accessory category.
  return (
    <div
      style={{
        padding: "12px 12px 10px",
        borderRadius: 14,
        background: "rgba(0, 0, 0, 0.25)",
        border: "2px dashed rgba(255,255,255,0.12)",
        opacity: 0.85,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          border: "1.5px solid rgba(255,255,255,0.16)",
          display: "grid", placeItems: "center",
          fontSize: 12,
        }}>🔒</div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.14em",
            color: "rgba(255,255,255,0.45)",
            textTransform: "uppercase",
          }}
        >
          +{combo.xpBonus} XP
        </div>
      </div>
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 16,
          color: "rgba(255,255,255,0.4)",
          letterSpacing: 1,
          lineHeight: 1.05,
          marginBottom: 4,
        }}
      >
        ? ? ?
      </div>
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.35)",
          lineHeight: 1.4,
          letterSpacing: "0.04em",
        }}
      >
        recipe locked — discover to reveal
      </div>
    </div>
  );
}

function AccessoryDot({ accessory, accent }: { accessory: Accessory; accent: string }) {
  const glyph = ACCESSORY_GLYPH[accessory];
  return (
    <div
      style={{
        width: 22, height: 22,
        borderRadius: "50%",
        background: `linear-gradient(180deg, ${accent}, rgba(0,0,0,0.4))`,
        border: "1.5px solid #0a0f1c",
        display: "grid", placeItems: "center",
        fontSize: 12,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
      }}
    >
      {glyph}
    </div>
  );
}

const ACCESSORY_GLYPH: Record<Accessory, string> = {
  sunglasses: "😎",
  halo:       "👼",
  fire:       "🔥",
  crown:      "👑",
  chain:      "💎",
};
