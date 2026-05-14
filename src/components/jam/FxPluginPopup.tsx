/**
 * FxPluginPopup — branded plugin-style popup that opens when the
 * player taps an unlocked tile on the FxBoard.
 *
 * Each effect can have its own bespoke layout (different colour palette,
 * different control set, different brand chrome). For this commit only
 * SHIMMER (engine id `fresh-air`) has a fully-designed face — the rest
 * fall back to a generic single-knob shell so the player can still
 * twist them while we iterate.
 *
 * SHIMMER's look references real top-end "air" plugins (Slate's Fresh
 * Air, Goodhertz's Tiltshift) — pale cyan + chrome top bar, oversize
 * AMOUNT knob, small "AIR" meter, and a footer with the fictional
 * GRVD AUDIO brand the player will get used to seeing across the
 * effects we ship.
 */

import { useEffect, useRef, useState } from "react";
import type { FxDef } from "../../data/jamFx";
import { PluginKnob } from "./PluginKnob";

interface FxPluginPopupProps {
  /** Definition of the FX being tweaked — gives us id (for branding
   *  switch), name, icon, blurb, etc. */
  fx:        FxDef;
  /** Current wet/amount value 0..1. */
  amount:    number;
  /** Live updates while the player twists. */
  onChange:  (next: number) => void;
  /** Close the popup. The underlying FxBoard stays open behind it. */
  onClose:   () => void;
}

export function FxPluginPopup({ fx, amount, onChange, onClose }: FxPluginPopupProps) {
  return (
    <>
      {/* Backdrop — slightly darker than FxBoard's so the popup pops
       *  over it visually. Click outside to dismiss. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 600,
          background: "rgba(4, 8, 16, 0.55)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          animation: "fxPluginFadeIn 0.18s ease-out",
        }}
      />

      {/* Branded body — switch on fx id so each effect can wear its own
       *  skin. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left:  "50%",
          top:   "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 601,
          animation: "fxPluginPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {fx.id === "fresh-air"
          ? <ShimmerFace fx={fx} amount={amount} onChange={onChange} onClose={onClose} />
          : <GenericFace  fx={fx} amount={amount} onChange={onChange} onClose={onClose} />}
      </div>

      <style>{`
        @keyframes fxPluginFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes fxPluginPop {
          0%   { transform: translate(-50%, -50%) scale(0.92); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
        @keyframes shimmerSparkle {
          0%   { transform: translateY(0) scale(1);   opacity: 0.0; }
          30%  { opacity: 0.9; }
          100% { transform: translateY(-32px) scale(0.6); opacity: 0; }
        }
        @keyframes shimmerMeterGlow {
          0%, 100% { opacity: 0.45; }
          50%      { opacity: 1; }
        }
      `}</style>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared inner-frame chrome — used by every branded face.                     */
/* -------------------------------------------------------------------------- */

interface FaceProps {
  fx:       FxDef;
  amount:   number;
  onChange: (n: number) => void;
  onClose:  () => void;
}

/* -------------------------------------------------------------------------- */
/* SHIMMER — full bespoke face (cyan/ice with floating sparkle particles).     */
/* -------------------------------------------------------------------------- */

function ShimmerFace({ fx, amount, onChange, onClose }: FaceProps) {
  // Sparkle particles — a handful of stars float upward over the panel
  // so the "air" effect feels visually present even when the player
  // isn't currently twisting the knob.
  const sparkles = useRef(
    Array.from({ length: 10 }, (_, i) => ({
      id:    i,
      left:  10 + Math.random() * 80,    // %
      delay: Math.random() * 2.4,        // s
      dur:   2.2 + Math.random() * 1.6,  // s
      size:  4 + Math.random() * 7,
    }))
  ).current;

  // Air "meter" pulses harder as the wet rises — a vague nod to plugin
  // VU meters without claiming to display real audio levels.
  const meterFillPct = 14 + amount * 86;

  return (
    <div
      style={{
        width: "min(60vw, 275px)",
        padding: 0,
        borderRadius: 14,
        overflow: "hidden",
        background: "linear-gradient(180deg, #d8f3fb 0%, #a4d8eb 50%, #6aa9c8 100%)",
        border: "2px solid #0a0f1c",
        boxShadow:
          "inset 0 2px 0 rgba(255,255,255,0.7), 0 4px 0 rgba(0,0,0,0.5), 0 16px 32px rgba(0,0,0,0.65), 0 0 22px rgba(125, 249, 255, 0.45)",
        position: "relative",
      }}
    >
      {/* Top chrome bar — brand mark + close. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "7px 10px",
          background: "linear-gradient(180deg, #1a2438 0%, #0a1020 100%)",
          borderBottom: "1.5px solid rgba(0,0,0,0.5)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
        }}
      >
        <span style={{ fontSize: 11, marginRight: 6 }}>{fx.icon}</span>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            color: "#7df9ff",
            letterSpacing: 0.6,
            textShadow: "0 1px 0 rgba(0,0,0,0.7), 0 0 8px rgba(125, 249, 255, 0.7)",
          }}
        >
          {fx.name}
        </div>
        <div
          style={{
            marginLeft: 7,
            paddingLeft: 7,
            borderLeft: "1px solid rgba(255,255,255,0.20)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 6,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          GRVD AUDIO · v1.0
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 18, height: 18, borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.30)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8, fontWeight: 700,
            cursor: "pointer",
            padding: 0, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Main face — pale cyan with floating sparkles. */}
      <div
        style={{
          position: "relative",
          padding: "14px 12px 10px",
          minHeight: 170,
        }}
      >
        {/* Floating sparkles */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {sparkles.map((s) => (
            <div
              key={s.id}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${s.left}%`,
                fontSize: s.size,
                animation: `shimmerSparkle ${s.dur}s ease-out ${s.delay}s infinite`,
                opacity: 0.6 + amount * 0.35,
              }}
            >
              ✦
            </div>
          ))}
        </div>

        {/* AIR meter strip across the top of the face */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            marginBottom: 12,
            position: "relative",
            zIndex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 6,
              color: "rgba(10, 20, 36, 0.7)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            AIR
          </span>
          <div
            style={{
              flex: 1,
              height: 7,
              borderRadius: 4,
              background: "rgba(10, 20, 36, 0.25)",
              border: "1px solid rgba(10, 20, 36, 0.55)",
              boxShadow: "inset 0 1px 0 rgba(0,0,0,0.25)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${meterFillPct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #b8e8f5 0%, #7df9ff 60%, #ffffff 100%)",
                boxShadow: "0 0 7px rgba(125, 249, 255, 0.8)",
                animation: amount > 0 ? "shimmerMeterGlow 1.6s ease-in-out infinite" : undefined,
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 7,
              fontWeight: 700,
              color: "#0a1424",
              minWidth: 24,
              textAlign: "right",
            }}
          >
            {Math.round(amount * 100)}%
          </span>
        </div>

        {/* Big AMOUNT knob — centerpiece of the face. */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            marginBottom: 9,
          }}
        >
          <PluginKnob
            value={amount}
            onChange={onChange}
            size={118}
            accent="#7df9ff"
            body={["#1a2438", "#0a1020"]}
            label="AMOUNT"
          />
        </div>

        {/* Blurb panel at bottom — tape-deck style label. */}
        <div
          style={{
            background: "linear-gradient(180deg, rgba(10, 20, 36, 0.85) 0%, rgba(10, 20, 36, 0.65) 100%)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 7,
            padding: "5px 8px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 7,
            color: "#a4d8eb",
            letterSpacing: "0.06em",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
          }}
        >
          {fx.blurb.toUpperCase()}
        </div>
      </div>

      {/* Footer brand strip */}
      <div
        style={{
          padding: "4px 9px",
          background: "linear-gradient(180deg, #0a1020 0%, #06091a 100%)",
          borderTop: "1.5px solid rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <span style={{ fontSize: 7 }}>✦</span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 6,
            color: "rgba(125, 249, 255, 0.7)",
            letterSpacing: "0.30em",
            textTransform: "uppercase",
          }}
        >
          GRVD AUDIO · SHIMMER
        </span>
        <span style={{ fontSize: 7 }}>✦</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* GenericFace — fallback popup for any FX without a bespoke design yet.       */
/* Same chrome shape so the player still feels they opened a "plugin", but     */
/* uses the effect's tile colours instead of a bespoke palette.                */
/* -------------------------------------------------------------------------- */

function GenericFace({ fx, amount, onChange, onClose }: FaceProps) {
  // Body gradient is intentionally muted — placeholder until each FX
  // gets its own face.
  const [hovered, setHovered] = useState(false);
  useEffect(() => { /* keep eslint-deps happy */ }, [hovered]);

  return (
    <div
      style={{
        width: "min(60vw, 247px)",
        padding: 0,
        borderRadius: 12,
        overflow: "hidden",
        background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
        border: "2px solid #0a0f1c",
        boxShadow:
          "inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 16px 32px rgba(0,0,0,0.65), 0 0 16px rgba(250, 204, 21, 0.30)",
      }}
    >
      {/* Top chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "7px 10px",
          background: "linear-gradient(180deg, #1a2438 0%, #0a1020 100%)",
          borderBottom: "1.5px solid rgba(0,0,0,0.5)",
        }}
      >
        <span style={{ fontSize: 11, marginRight: 6 }}>{fx.icon}</span>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            color: "#facc15",
            letterSpacing: 0.6,
            textShadow: "0 1px 0 rgba(0,0,0,0.7), 0 0 8px rgba(250, 204, 21, 0.55)",
          }}
        >
          {fx.name}
        </div>
        <div
          style={{
            marginLeft: 7,
            paddingLeft: 7,
            borderLeft: "1px solid rgba(255,255,255,0.20)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 6,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          GRVD AUDIO · v1.0
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          aria-label="close"
          style={{
            width: 18, height: 18, borderRadius: 9,
            border: "1px solid rgba(255,255,255,0.30)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 8, fontWeight: 700,
            cursor: "pointer",
            padding: 0, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Face */}
      <div
        style={{
          padding: "14px 12px 12px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
        }}
      >
        <PluginKnob
          value={amount}
          onChange={onChange}
          size={104}
          accent="#facc15"
          body={["#2a3142", "#0c1119"]}
          label="AMOUNT"
        />
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 7,
            fontWeight: 700,
            color: amount > 0 ? "#facc15" : "rgba(255,255,255,0.5)",
            letterSpacing: "0.10em",
          }}
        >
          {Math.round(amount * 100)}%
        </div>

        <div
          style={{
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 7,
            padding: "5px 8px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 7,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.06em",
            textAlign: "center",
            width: "100%",
          }}
        >
          {fx.blurb.toUpperCase()}
        </div>
      </div>

      {/* Footer brand strip */}
      <div
        style={{
          padding: "4px 9px",
          background: "linear-gradient(180deg, #0a1020 0%, #06091a 100%)",
          borderTop: "1.5px solid rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 6,
            color: "rgba(250, 204, 21, 0.7)",
            letterSpacing: "0.30em",
            textTransform: "uppercase",
          }}
        >
          GRVD AUDIO · {fx.name}
        </span>
      </div>
    </div>
  );
}
