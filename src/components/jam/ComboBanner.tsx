/**
 * ComboBanner — the dramatic "you unlocked a combo" overlay that drops
 * from the top of the stage when a combo activates.
 *
 * Lifecycle:
 *   - Mounts when the parent says a combo just activated.
 *   - Drops in from above with a chunky pop, holds for ~2s while still,
 *     then floats back up and fades out by ~3.4s.
 *   - Parent unmounts the component when the combo de-activates or when
 *     the timer expires (whichever comes first).
 *
 * Pure presentation: takes a JamCombo and renders. The parent owns the
 * "is a combo currently active" state and decides whether to mount.
 */

import type { JamCombo } from "../../data/jamCombos";

interface ComboBannerProps {
  combo: JamCombo;
}

export function ComboBanner({ combo }: ComboBannerProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: "50%",
        marginLeft: -180,
        width: 360,
        zIndex: 30,
        pointerEvents: "none",
        animation: "comboBannerLifecycle 3.4s cubic-bezier(.34,1.56,.64,1) forwards",
      }}
    >
      <div
        style={{
          padding: "12px 20px 10px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: `2.5px solid ${combo.accent}`,
          boxShadow:
            `inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 12px 32px rgba(0,0,0,0.55), 0 0 32px ${combo.accent}99`,
          textAlign: "center",
        }}
      >
        {/* tiny eyebrow */}
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.32em",
            color: combo.accent,
            textTransform: "uppercase",
            marginBottom: 4,
            textShadow: `0 0 8px ${combo.accent}aa`,
          }}
        >
          ★ COMBO UNLOCKED ★
        </div>
        {/* combo name */}
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 26,
            color: "#fff",
            letterSpacing: 1,
            lineHeight: 1.05,
            textShadow: `0 2px 0 rgba(0,0,0,0.6), 0 0 18px ${combo.accent}cc`,
          }}
        >
          {combo.name}
        </div>
        {/* flavor */}
        <div
          style={{
            marginTop: 4,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 500,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.45,
            letterSpacing: "0.04em",
          }}
        >
          {combo.flavor}
        </div>
        {/* +XP pill */}
        <div
          style={{
            display: "inline-block",
            marginTop: 8,
            padding: "2px 10px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            border: `1px solid ${combo.accent}66`,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: combo.accent,
            textTransform: "uppercase",
          }}
        >
          +{combo.xpBonus} XP
        </div>
      </div>

      <style>{`
        @keyframes comboBannerLifecycle {
          0%   { transform: translateY(-80px) scale(0.85); opacity: 0; }
          14%  { transform: translateY(8px)   scale(1.04); opacity: 1; }
          22%  { transform: translateY(0)     scale(1);    opacity: 1; }
          78%  { transform: translateY(0)     scale(1);    opacity: 1; }
          100% { transform: translateY(-30px) scale(0.96); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
