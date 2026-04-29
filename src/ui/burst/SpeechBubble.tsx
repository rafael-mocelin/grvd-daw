/**
 * SpeechBubble — BURST hero-design talk bubble.
 *
 * White rounded rectangle with a black toon outline and a downward-left
 * pointing tail. Pop-in animation + idle float. Anchored absolute by
 * default; the parent stage positions it next to the mascot.
 *
 * Used by Home (the big home stage) and any other screen that wants
 * the same chunky speech-bubble look.
 */

import { C } from "./tokens";

interface SpeechBubbleProps {
  text: string;
  /** Right offset (px) from the parent's right edge. Default 14. */
  right?:  number;
  /** Bottom offset (px) from the parent's bottom edge. Default 130 —
   *  tuned to land just above the mascot's head. */
  bottom?: number;
}

export function SpeechBubble({ text, right = 14, bottom = 130 }: SpeechBubbleProps) {
  return (
    <div
      style={{
        position: "absolute",
        right, bottom,
        zIndex: 6,
        animation: "burstBubblePop 0.5s cubic-bezier(.34,1.56,.64,1) both, burstBubbleFloat 3s ease-in-out infinite 0.5s",
      }}
      aria-live="polite"
      role="status"
    >
      <div
        style={{
          position: "relative",
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          borderRadius: "14px 14px 14px 4px",
          padding: "8px 12px",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 16,
          color: C.navyDeep,
          letterSpacing: 0.3,
          boxShadow: "0 4px 0 rgba(0,0,0,0.4), 0 8px 18px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap",
        }}
      >
        {text}
        {/* Tail pointing down-left toward the mascot */}
        <div
          aria-hidden
          style={{
            position: "absolute", left: -2, bottom: -10,
            width: 14, height: 14,
            background: "#fff",
            border: "2.5px solid #0a0f1c",
            borderTop: "none",
            borderRight: "none",
            transform: "rotate(-45deg) translate(2px, -2px)",
            clipPath: "polygon(0 0, 100% 100%, 0 100%)",
          }}
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
