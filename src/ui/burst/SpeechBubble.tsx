/**
 * SpeechBubble — BURST hero-design talk bubble.
 *
 * White rounded rectangle with a black toon outline and a tail
 * pointing toward the speaker. Pop-in animation + idle float.
 * Anchored absolute by default; the parent positions it.
 *
 * Two tail variants:
 *   - tailSide="bottom" (default) — tail at bottom-left, points DOWN-left
 *     toward a speaker BELOW the bubble. Used historically when the
 *     bubble sat above the mascot.
 *   - tailSide="top"             — tail at top-left, points UP-left toward
 *     a speaker ABOVE the bubble. Used by Home where the mascot lives
 *     in the top banner and the bubble drops below it.
 *
 * Position props (left/right/top/bottom) are forwarded to the absolute
 * positioning so the parent decides where the bubble sits.
 */

import type { CSSProperties } from "react";
import { C } from "./tokens";

interface SpeechBubbleProps {
  text: string;
  /** Where the pointer tail attaches. Default bottom. */
  tailSide?: "top" | "bottom";
  /** Override max width to allow long lines to wrap nicely. Default 220. */
  maxWidth?: number;
  /** Absolute positioning offsets. Pass any subset. */
  left?:    number;
  right?:   number;
  top?:     number;
  bottom?:  number;
}

export function SpeechBubble({
  text,
  tailSide = "bottom",
  maxWidth = 220,
  left,
  right,
  top,
  bottom,
}: SpeechBubbleProps) {
  // Default placement (legacy callers): bottom-right of the stage.
  const pos: CSSProperties = {
    position: "absolute",
    right:  right  ?? (left  === undefined ? 14  : undefined),
    bottom: bottom ?? (top   === undefined ? 130 : undefined),
    left,
    top,
    zIndex: 6,
  };

  // Bubble shape: rounded corners on three sides, sharper on the corner
  // the tail attaches to so the join reads cleanly.
  const borderRadius =
    tailSide === "top"
      ? "4px 14px 14px 14px"   // tail top-left
      : "14px 14px 14px 4px";  // tail bottom-left

  return (
    <div
      style={{
        ...pos,
        animation: "burstBubblePop 0.5s cubic-bezier(.34,1.56,.64,1) both, burstBubbleFloat 3s ease-in-out infinite 0.5s",
      }}
      aria-live="polite"
      role="status"
    >
      <div
        style={{
          position: "relative",
          maxWidth,
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          borderRadius,
          padding: "8px 12px",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 14,
          color: C.navyDeep,
          letterSpacing: 0.3,
          lineHeight: 1.2,
          boxShadow: "0 4px 0 rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.4)",
        }}
      >
        {text}

        {/* Tail */}
        <div
          aria-hidden
          style={
            tailSide === "top"
              ? {
                  // Tail at top-left, pointing UP toward a speaker above.
                  position: "absolute",
                  left: -2,
                  top: -10,
                  width: 14,
                  height: 14,
                  background: "#fff",
                  border: "2.5px solid #0a0f1c",
                  borderBottom: "none",
                  borderRight: "none",
                  transform: "rotate(45deg) translate(-2px, 2px)",
                  clipPath: "polygon(0 0, 100% 0, 0 100%)",
                }
              : {
                  // Tail at bottom-left, pointing DOWN toward a speaker below.
                  position: "absolute",
                  left: -2,
                  bottom: -10,
                  width: 14,
                  height: 14,
                  background: "#fff",
                  border: "2.5px solid #0a0f1c",
                  borderTop: "none",
                  borderRight: "none",
                  transform: "rotate(-45deg) translate(2px, -2px)",
                  clipPath: "polygon(0 0, 100% 100%, 0 100%)",
                }
          }
        />
      </div>

      <style>{`
        @keyframes burstBubblePop {
          0%   { transform: scale(0.3) rotate(-6deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(2deg); opacity: 1; }
          100% { transform: scale(1)    rotate(0deg); opacity: 1; }
        }
        @keyframes burstBubbleFloat {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
