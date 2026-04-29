/**
 * Mascot — BURST Funko-style chibi character.
 *
 * Faithful port of the Mascot component from the Claude Design handoff.
 * 1:1.5 head-to-body proportions. Layered divs build the silhouette:
 *
 *   - Floor shadow ellipse
 *   - Hoodie body with hood collar, drawstrings, gold chain pendant,
 *     "BURST" chest text
 *   - Two arms with skin-tone hands
 *   - Two legs with sneakers (white sole, black upper)
 *   - Oversized head: shape, hat-shadow, two black O eyes (with white
 *     specular dot), small round mouth
 *   - DJ headphones overlay: black headband arc + two earcups, each
 *     with a coral inner cone
 *
 * Animated with the global `idleBob` keyframe (defined in PageShell or
 * inline below).
 */

import { C, lighten, darken } from "./tokens";

interface MascotProps {
  /** Hoodie / body color. Default coral red — matches the design doc's
   *  primary action color and the mascot's signature look. */
  jacket?:    string;
  /** Skin tone — warm tan by default. */
  skin?:      string;
  /** Override the bottom anchor — useful when the mascot sits inside a
   *  container with custom padding. Default 4% of stage. */
  bottomPct?: string;
}

export function Mascot({
  jacket    = C.coral,
  skin      = "#c08a5a",
  bottomPct = "4%",
}: MascotProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: "50%", bottom: bottomPct,
        transform: "translateX(-50%)",
        width: 150, height: 230,
        animation: "mascotIdleBob 2.6s ease-in-out infinite",
        zIndex: 5,
        filter: "drop-shadow(0 14px 14px rgba(0,0,0,0.5))",
      }}
      aria-hidden
    >
      {/* Floor shadow */}
      <div
        style={{
          position: "absolute", bottom: -6, left: "50%",
          transform: "translateX(-50%)",
          width: 100, height: 14, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      {/* ── Body / hoodie ── */}
      <div
        style={{
          position: "absolute", bottom: 28, left: "50%",
          transform: "translateX(-50%)",
          width: 100, height: 86,
          background: `linear-gradient(180deg, ${jacket} 0%, ${C.coralDeep} 100%)`,
          border: "2.5px solid #0a0f1c",
          borderRadius: "20px 20px 14px 14px",
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -4px 0 rgba(0,0,0,0.35)",
        }}
      >
        {/* Hood collar */}
        <div
          style={{
            position: "absolute", top: -4, left: "50%",
            transform: "translateX(-50%)",
            width: 70, height: 14,
            background: jacket,
            border: "2.5px solid #0a0f1c",
            borderRadius: "10px 10px 4px 4px",
          }}
        />
        {/* Drawstrings */}
        <div style={{ position: "absolute", top: 10, left: "46%", width: 2, height: 18, background: "#fff", borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 10, left: "54%", width: 2, height: 18, background: "#fff", borderRadius: 1 }} />
        {/* Gold chain (rendered with a radial mask so it reads as a loop) */}
        <div
          style={{
            position: "absolute", top: 16, left: "50%",
            transform: "translateX(-50%)",
            width: 60, height: 16,
            background: `linear-gradient(90deg, transparent 0%, ${C.gold} 20%, ${C.goldLight} 50%, ${C.gold} 80%, transparent 100%)`,
            borderRadius: "50%",
            maskImage: "radial-gradient(circle, #000 60%, transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle, #000 60%, transparent 70%)",
            opacity: 0.95,
          }}
        />
        {/* Chain pendant */}
        <div
          style={{
            position: "absolute", top: 26, left: "50%",
            transform: "translateX(-50%)",
            width: 14, height: 18, borderRadius: 4,
            background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
            border: "1.5px solid #0a0f1c",
            boxShadow: "0 0 10px rgba(212,160,23,0.6)",
          }}
        />
        {/* "BURST" chest text */}
        <div
          style={{
            position: "absolute", bottom: 16, left: "50%",
            transform: "translateX(-50%)",
            fontFamily: "'Luckiest Guy', system-ui",
            fontSize: 11, letterSpacing: 1,
            color: "#fff",
            textShadow: "1.5px 1.5px 0 #0a0f1c",
            whiteSpace: "nowrap",
          }}
        >
          BURST
        </div>
      </div>

      {/* ── Arms ── */}
      <div
        style={{
          position: "absolute", bottom: 32, left: 6,
          width: 22, height: 56,
          background: `linear-gradient(180deg, ${jacket}, ${C.coralDeep})`,
          border: "2.5px solid #0a0f1c",
          borderRadius: "14px 8px 12px 12px",
          transform: "rotate(8deg)",
        }}
      >
        {/* Left hand */}
        <div
          style={{
            position: "absolute", bottom: -10, left: "50%",
            transform: "translateX(-50%)",
            width: 22, height: 18, borderRadius: "50%",
            background: skin,
            border: "2.5px solid #0a0f1c",
          }}
        />
      </div>
      <div
        style={{
          position: "absolute", bottom: 32, right: 6,
          width: 22, height: 56,
          background: `linear-gradient(180deg, ${jacket}, ${C.coralDeep})`,
          border: "2.5px solid #0a0f1c",
          borderRadius: "8px 14px 12px 12px",
          transform: "rotate(-8deg)",
        }}
      >
        {/* Right hand */}
        <div
          style={{
            position: "absolute", bottom: -10, left: "50%",
            transform: "translateX(-50%)",
            width: 22, height: 18, borderRadius: "50%",
            background: skin,
            border: "2.5px solid #0a0f1c",
          }}
        />
      </div>

      {/* ── Legs / sneakers ── */}
      <div
        style={{
          position: "absolute", bottom: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 80, display: "flex", justifyContent: "space-between",
        }}
      >
        <div style={{ width: 34, height: 30 }}>
          <div style={{ width: "100%", height: 14, background: "#1a1a22", border: "2.5px solid #0a0f1c", borderRadius: "4px 4px 0 0" }} />
          <div
            style={{
              width: "110%", height: 18, marginLeft: -2,
              background: "linear-gradient(180deg, #fff, #d0d0d8)",
              border: "2.5px solid #0a0f1c", borderRadius: "4px 10px 6px 6px",
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            }}
          />
        </div>
        <div style={{ width: 34, height: 30 }}>
          <div style={{ width: "100%", height: 14, background: "#1a1a22", border: "2.5px solid #0a0f1c", borderRadius: "4px 4px 0 0" }} />
          <div
            style={{
              width: "110%", height: 18, marginLeft: -2,
              background: "linear-gradient(180deg, #fff, #d0d0d8)",
              border: "2.5px solid #0a0f1c", borderRadius: "10px 4px 6px 6px",
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            }}
          />
        </div>
      </div>

      {/* ── HEAD (oversized — Funko 1:1.5 ratio) ── */}
      <div
        style={{
          position: "absolute", top: 0, left: "50%",
          transform: "translateX(-50%)",
          width: 130, height: 130,
        }}
      >
        {/* Head shape */}
        <div
          style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(circle at 35% 30%, ${lighten(skin, 0.15)}, ${skin} 60%, ${darken(skin, 0.18)})`,
            border: "2.5px solid #0a0f1c",
            borderRadius: "50% 50% 46% 46% / 52% 52% 44% 44%",
            boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)",
          }}
        />
        {/* Hat-shadow on top of head (under the headphones) */}
        <div
          style={{
            position: "absolute", top: 14, left: 18, right: 18, height: 14,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.18)",
            filter: "blur(2px)",
          }}
        />

        {/* Eyes — round black O pupils with white specular dot */}
        <div
          style={{
            position: "absolute", top: 60, left: 32,
            width: 16, height: 16, borderRadius: "50%",
            background: "#0a0f1c",
            boxShadow: "inset 0 -2px 0 rgba(255,255,255,0.1)",
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 3, width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
        </div>
        <div
          style={{
            position: "absolute", top: 60, right: 32,
            width: 16, height: 16, borderRadius: "50%",
            background: "#0a0f1c",
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 3, width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />
        </div>
        {/* Mouth — small round dark cavity */}
        <div
          style={{
            position: "absolute", top: 86, left: "50%",
            transform: "translateX(-50%)",
            width: 9, height: 9, borderRadius: "50%",
            background: "#3a1818",
            border: "1.5px solid #0a0f1c",
          }}
        />

        {/* DJ headphones overlay */}
        <div
          style={{
            position: "absolute", top: -8, left: "50%",
            transform: "translateX(-50%)",
            width: 130, height: 60,
          }}
        >
          {/* Headband arc */}
          <div
            style={{
              position: "absolute", top: 0, left: 10, right: 10, height: 36,
              border: "6px solid #1a1a22",
              borderBottom: "none",
              borderRadius: "60px 60px 0 0",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), 0 0 0 2px #0a0f1c",
            }}
          />
          {/* Left earcup */}
          <div
            style={{
              position: "absolute", top: 24, left: -2,
              width: 36, height: 44,
              background: "linear-gradient(180deg, #2a2a32, #0a0a12)",
              border: "2.5px solid #0a0f1c",
              borderRadius: 10,
              boxShadow: "0 4px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                position: "absolute", inset: 6, borderRadius: 6,
                background: `radial-gradient(circle at 30% 30%, ${C.coral}, ${C.coralDeep})`,
                border: "1.5px solid #0a0f1c",
                boxShadow: "0 0 10px rgba(233,69,96,0.6)",
              }}
            />
          </div>
          {/* Right earcup */}
          <div
            style={{
              position: "absolute", top: 24, right: -2,
              width: 36, height: 44,
              background: "linear-gradient(180deg, #2a2a32, #0a0a12)",
              border: "2.5px solid #0a0f1c",
              borderRadius: 10,
              boxShadow: "0 4px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.2)",
            }}
          >
            <div
              style={{
                position: "absolute", inset: 6, borderRadius: 6,
                background: `radial-gradient(circle at 30% 30%, ${C.coral}, ${C.coralDeep})`,
                border: "1.5px solid #0a0f1c",
                boxShadow: "0 0 10px rgba(233,69,96,0.6)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Local idle-bob keyframe (kept inline so the mascot is portable). */}
      <style>{`
        @keyframes mascotIdleBob {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50%      { transform: translateX(-50%) translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
