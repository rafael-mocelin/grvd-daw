/**
 * XPFlash — global "+XP" floating animation overlay.
 *
 * Rendered via portal to document.body so it always floats above everything.
 * Each flash animates upward and fades out at the exact (x,y) position of
 * the action that earned XP (e.g. where the user clicked a sound card).
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";

/* -------------------------------------------------------------------------- */
/* Single flash item                                                            */
/* -------------------------------------------------------------------------- */

interface FlashItemProps {
  id: string;
  amount: number;
  label: string;
  x: number;
  y: number;
  onDone: (id: string) => void;
}

function FlashItem({ id, amount, label, x, y, onDone }: FlashItemProps) {
  // Remove from queue after animation completes
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 1100);
    return () => clearTimeout(t);
  }, [id, onDone]);

  return (
    <>
      <style>{`
        @keyframes xpFloat {
          0%   { opacity: 0;   transform: translate(-50%, -50%) scale(0.6); }
          12%  { opacity: 1;   transform: translate(-50%, -65%) scale(1.2); }
          35%  { opacity: 1;   transform: translate(-50%, -85%) scale(1.0); }
          100% { opacity: 0;   transform: translate(-50%,-145%) scale(0.85); }
        }
        @keyframes xpGlint {
          0%   { opacity: 0.6; }
          50%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Glow halo */}
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          width: 64,
          height: 64,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(250,204,21,0.35) 0%, transparent 70%)",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 99998,
          animation: "xpGlint 0.55s ease-out forwards",
        }}
      />

      {/* "+N XP" text */}
      <div
        style={{
          position: "fixed",
          left: x,
          top: y,
          pointerEvents: "none",
          zIndex: 99999,
          animation: "xpFloat 1.1s cubic-bezier(0.22,1,0.36,1) forwards",
          fontFamily: "'Lilita One', 'Plus Jakarta Sans', system-ui, sans-serif",
          letterSpacing: "0.02em",
          whiteSpace: "nowrap",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        <span
          style={{
            fontSize: 26,
            color: "#fbbf24",
            textShadow:
              "0 0 12px #fbbf24, 0 0 28px #fb923c, 0 3px 0 rgba(0,0,0,0.85)",
          }}
        >
          +{amount} XP
        </span>
        {label && (
          <span
            style={{
              display: "block",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontWeight: 700,
              fontSize: 9,
              color: "rgba(251,191,36,0.7)",
              marginTop: 3,
              textAlign: "center",
              textShadow: "0 0 6px rgba(251,146,60,0.6)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Container                                                                    */
/* -------------------------------------------------------------------------- */

export function XPFlash() {
  const { xpFlashQueue, clearXPFlash } = useStore();

  if (!xpFlashQueue.length) return null;

  return createPortal(
    <>
      {xpFlashQueue.map((flash) => (
        <FlashItem key={flash.id} {...flash} onDone={clearXPFlash} />
      ))}
    </>,
    document.body
  );
}
