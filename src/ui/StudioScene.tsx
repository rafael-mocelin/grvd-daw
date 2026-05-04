/**
 * StudioScene — BURST hero-design studio room backdrop.
 *
 * Faithful port of the StudioRoom component from the Claude Design
 * handoff. Layered scene built from positioned divs:
 *
 *   1. Sunset-window left (orange→pink→purple gradient with cross frame)
 *   2. Brick back wall (repeating-linear-gradient brick pattern)
 *   3. BURST graffiti tag (Luckiest Guy display, green with magenta drop shadow)
 *   4. Pendant lamp + warm cone of light
 *   5. Floating dust motes (animated)
 *   6. Perspective wood floor (repeating-linear-gradient with rotateX(45deg))
 *   7. Speaker cabinets flanking the back wall
 *   8. Desk with MPC (16-pad green-LCD grid) + sampler/keyboard with BPM display
 *   9. Vinyl record on the wall
 *
 * Children render on top of the scene — used by Home for the Mascot
 * and SpeechBubble.
 *
 * Animations come from the global keyframes in PageShell's <style>
 * blocks (mote, lcdPulse). If those aren't present, the scene still
 * renders fine; it just doesn't twinkle.
 */

import type { ReactNode, CSSProperties } from "react";
import { C } from "./burst/tokens";

interface StudioSceneProps {
  children?: ReactNode;
  /** Optional className — keeps the wrapper compatible with the prior API. */
  className?: string;
  /** Hide the back-wall speaker cabinets. Used by the Jam stage where
   *  the wider viewport made the speakers clip into the character row. */
  hideSpeakers?: boolean;
  /** Hide the foreground desk + MPC + sampler. Same reason — on the
   *  Jam stage the desk landed on top of the characters. */
  hideDesk?: boolean;
}

export function StudioScene({
  children,
  className = "",
  hideSpeakers = false,
  hideDesk = false,
}: StudioSceneProps) {
  return (
    <div
      className={className}
      style={{
        position: "relative",
        height: "100%", width: "100%",
        borderRadius: 22, overflow: "hidden",
        background: "linear-gradient(180deg, #2a1d3a 0%, #3a2540 35%, #4a2a3e 70%, #5a3a30 100%)",
      }}
    >
      {/* ── Sunset window (left side) ── */}
      <div
        style={{
          position: "absolute", left: 14, top: 28,
          width: 90, height: 110,
          background: "linear-gradient(180deg, #ffb066 0%, #ff7aa0 45%, #b14a8a 100%)",
          border: "4px solid #1a0e1c",
          borderRadius: 6,
          boxShadow: "0 0 40px rgba(255,140,180,0.45), inset 0 0 0 4px #2a1622",
        }}
      >
        {/* Window cross (vertical + horizontal mullion) */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 4, background: "#1a0e1c", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 4, background: "#1a0e1c", transform: "translateY(-50%)" }} />
        {/* Sun */}
        <div
          style={{
            position: "absolute", left: "50%", top: "62%",
            width: 30, height: 30, borderRadius: "50%",
            background: "#ffd070",
            transform: "translate(-50%,-50%)",
            boxShadow: "0 0 24px #ffd070",
          }}
        />
      </div>

      {/* ── Brick back wall ── */}
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, right: 0, top: 0, height: "62%",
          background: `
            linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 30%),
            repeating-linear-gradient(0deg, #4a2a2e 0 18px, #2a1416 18px 20px),
            repeating-linear-gradient(90deg, #4a2a2e 0 38px, #2a1416 38px 40px)
          `,
          opacity: 0.55,
          zIndex: 0,
        }}
      />

      {/* ── BURST graffiti tag ── */}
      <div
        style={{
          position: "absolute", right: 22, top: 40,
          fontFamily: "'Luckiest Guy', 'Lilita One', system-ui",
          fontSize: 30, letterSpacing: 1.5,
          color: C.green,
          textShadow: "3px 3px 0 #0a0f1c, 5px 5px 0 rgba(255,77,156,0.8), 0 0 20px rgba(74,222,128,0.5)",
          transform: "rotate(-8deg)",
          zIndex: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        BURST
      </div>

      {/* ── Pendant lamp + cone ── */}
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, zIndex: 1 }}>
        {/* Cord */}
        <div style={{ position: "absolute", left: -1, top: 0, width: 2, height: 36, background: "#0a0f1c" }} />
        {/* Lamp shade */}
        <div
          style={{
            position: "absolute", left: -16, top: 32, width: 32, height: 22,
            borderRadius: "50% 50% 30% 30% / 60% 60% 40% 40%",
            background: `radial-gradient(circle at 50% 30%, ${C.goldLight}, ${C.gold} 60%, #5a3e08)`,
            border: "2px solid #0a0f1c",
            boxShadow: "0 0 24px rgba(212,160,23,0.7)",
          }}
        />
        {/* Light cone */}
        <div
          style={{
            position: "absolute", left: -90, top: 50, width: 180, height: 240,
            background: "linear-gradient(180deg, rgba(255,200,100,0.55) 0%, rgba(255,160,80,0.18) 60%, rgba(255,160,80,0) 100%)",
            clipPath: "polygon(40% 0%, 60% 0%, 100% 100%, 0% 100%)",
            filter: "blur(2px)",
          }}
        />
      </div>

      {/* ── Dust motes (animated) ── */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${30 + (i * 7) % 50}%`,
            top:  `${20 + (i * 11) % 50}%`,
            width: 3, height: 3, borderRadius: "50%",
            background: "rgba(255,220,160,0.8)",
            boxShadow: "0 0 6px rgba(255,220,160,0.9)",
            animation: `studioMote ${4 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
            zIndex: 2,
          }}
        />
      ))}

      {/* ── Wood-plank perspective floor ── */}
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: "38%",
          background: `
            linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 30%),
            repeating-linear-gradient(90deg, #6b3a1a 0 18px, #4a2810 18px 20px, #5a311a 20px 38px, #3e2210 38px 40px)
          `,
          transform: "perspective(400px) rotateX(45deg)",
          transformOrigin: "top",
          zIndex: 0,
        }}
      />

      {/* ── Speakers (back wall, both sides) ── */}
      {!hideSpeakers && (
        <>
          <Speaker style={{ left: 18,  top: 130 }} />
          <Speaker style={{ right: 18, top: 130 }} />
        </>
      )}

      {/* ── Desk with MPC + sampler ── */}
      {!hideDesk && (
      <div
        style={{
          position: "absolute", left: "50%", bottom: "24%",
          transform: "translateX(-50%)",
          width: 200, height: 48,
          background: "linear-gradient(180deg, #5a3a22 0%, #3a2412 100%)",
          border: "2.5px solid #0a0f1c",
          borderRadius: 4,
          boxShadow: "0 8px 0 rgba(0,0,0,0.6), 0 14px 24px rgba(0,0,0,0.6)",
          zIndex: 3,
        }}
      >
        {/* MPC — 16-pad green-LCD grid */}
        <div
          style={{
            position: "absolute", left: 8, top: -34,
            width: 84, height: 38,
            background: "linear-gradient(180deg, #2a2a2e, #0e0e12)",
            border: "2px solid #0a0f1c",
            borderRadius: 4,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 0 rgba(0,0,0,0.5)",
            padding: 4,
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2,
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => {
            const lit = i % 5 === 0;
            return (
              <div
                key={i}
                style={{
                  background: lit ? C.greenLcd : `${C.greenLcd}25`,
                  border: "0.5px solid #082c18",
                  borderRadius: 1,
                  boxShadow: lit ? `0 0 6px ${C.greenLcd}` : "none",
                  animation: lit ? `studioLcdPulse ${1.2 + (i % 3) * 0.3}s ease-in-out infinite` : undefined,
                }}
              />
            );
          })}
        </div>
        {/* Sampler/keyboard with BPM display */}
        <div
          style={{
            position: "absolute", right: 8, top: -22,
            width: 86, height: 26,
            background: "linear-gradient(180deg, #d8d8e0, #8a8a92)",
            border: "2px solid #0a0f1c",
            borderRadius: 3,
            display: "flex",
          }}
        >
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: i % 3 === 2 ? "#1a1a22" : "#fafaff",
                borderRight: "1px solid #0a0f1c",
              }}
            />
          ))}
          {/* BPM LCD readout */}
          <div
            style={{
              position: "absolute", top: -6, right: 4,
              width: 24, height: 8,
              background: "#0e0e12",
              border: "1.5px solid #0a0f1c",
              borderRadius: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'VT323', monospace",
              fontSize: 10, color: C.greenLcd,
              textShadow: `0 0 4px ${C.greenLcd}`,
            }}
          >
            92
          </div>
        </div>
      </div>
      )}

      {/* ── Vinyl on wall ── */}
      <div
        style={{
          position: "absolute", left: 24, top: 28,
          width: 36, height: 36, borderRadius: "50%",
          background: "radial-gradient(circle, #1a0e0e 0%, #0a0506 30%, #2a1010 60%, #0a0506 100%)",
          border: "2px solid #0a0f1c",
          boxShadow: "0 4px 0 rgba(0,0,0,0.5)",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "absolute", inset: 12, borderRadius: "50%",
            background: C.coral,
            border: "1.5px solid #0a0f1c",
          }}
        />
      </div>

      {/* Children (mascot + speech bubble) render above the scene */}
      {children}

      {/* Inline keyframes so the scene's animations don't depend on global CSS. */}
      <style>{`
        @keyframes studioMote {
          0%, 100% { transform: translateY(0)    translateX(0); opacity: 0.4; }
          50%      { transform: translateY(20px) translateX(6px); opacity: 0.9; }
        }
        @keyframes studioLcdPulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Speaker — back-wall cabinet with woofer + tweeter                            */
/* -------------------------------------------------------------------------- */

function Speaker({ style }: { style: CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: 38, height: 64,
        background: "linear-gradient(180deg, #1a1a22 0%, #0a0a12 100%)",
        border: "2px solid #0a0f1c",
        borderRadius: 4,
        boxShadow: "0 4px 0 rgba(0,0,0,0.5), 0 8px 16px rgba(0,0,0,0.55)",
        padding: 4,
        display: "flex", flexDirection: "column", gap: 4,
        zIndex: 2,
        ...style,
      }}
    >
      <div
        style={{
          flex: 2, borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #4a4a52, #1a1a22)",
          border: "1.5px solid #000",
          boxShadow: "inset 0 0 6px rgba(0,0,0,0.8)",
        }}
      />
      <div
        style={{
          flex: 1, borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #3a3a42, #1a1a22)",
          border: "1.5px solid #000",
        }}
      />
    </div>
  );
}
