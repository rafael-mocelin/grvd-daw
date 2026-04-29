/**
 * CookCTA — BURST hero-design primary call-to-action.
 *
 * Big chunky coral pill button with a mini MPC-pad icon (green-LCD
 * grid) on the left and "COOK A TRACK" in Lilita-One display caps.
 * Glossy top highlight, multi-layer shadow, outer coral halo, and a
 * subtle 2.6s pulse animation when idle.
 *
 * Press state shrinks the shadow and translates the button down 4px
 * with a slight scale-down — matches the rest of the BURST candy
 * press feel.
 */

import { useState } from "react";
import { C } from "./tokens";
import { Gloss } from "./Gloss";

interface CookCTAProps {
  /** Override the visible label — defaults to "COOK A TRACK". */
  label?:    string;
  onPress:   () => void;
}

export function CookCTA({ label = "COOK A TRACK", onPress }: CookCTAProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onClick={onPress}
      style={{
        position: "relative",
        width: "100%", height: 64,
        borderRadius: 999,
        border: "2.5px solid #0a0f1c",
        background: `linear-gradient(180deg, #ff7a8e 0%, ${C.coral} 50%, ${C.coralDeep} 100%)`,
        boxShadow: pressed
          ? [
              "inset 0 2px 0 rgba(255,255,255,0.4)",
              "0 1px 0 rgba(0,0,0,0.5)",
              "0 0 18px rgba(233,69,96,0.6)",
            ].join(", ")
          : [
              "inset 0 2px 0 rgba(255,255,255,0.55)",
              "inset 0 -4px 0 rgba(0,0,0,0.3)",
              "inset 0 0 0 2px rgba(255,255,255,0.22)",
              "0 6px 0 rgba(0,0,0,0.55)",
              "0 14px 28px rgba(0,0,0,0.55)",
              "0 0 30px rgba(233,69,96,0.65)",
            ].join(", "),
        transform: pressed ? "translateY(4px) scale(0.99)" : "translateY(0)",
        transition: "transform 0.08s, box-shadow 0.08s",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        animation: pressed ? "none" : "ctaPulse 2.6s ease-in-out infinite",
      }}
    >
      <Gloss radius={32} opacity={0.55} />

      {/* Mini MPC icon — green-LCD grid in a black plate */}
      <div
        aria-hidden
        style={{
          position: "relative", zIndex: 1,
          width: 36, height: 36, borderRadius: 8,
          background: "linear-gradient(180deg, #2a2a32, #0a0a12)",
          border: "2px solid #0a0f1c",
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1.5,
          padding: 4,
        }}
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            style={{
              background: i === 4 ? C.greenLcd : `${C.greenLcd}40`,
              borderRadius: 1,
              boxShadow: i === 4 ? `0 0 5px ${C.greenLcd}` : "none",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative", zIndex: 1,
          fontFamily: "'Lilita One', system-ui",
          fontSize: 26, letterSpacing: 1.2,
          color: "#fff",
          textShadow: "0 2.5px 0 rgba(0,0,0,0.55), 0 0 14px rgba(255,255,255,0.25)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      <style>{`
        @keyframes ctaPulse {
          0%, 100% { filter: brightness(1); }
          50%      { filter: brightness(1.08); }
        }
      `}</style>
    </button>
  );
}
