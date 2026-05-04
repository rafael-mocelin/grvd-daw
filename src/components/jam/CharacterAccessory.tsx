/**
 * CharacterAccessory — renders a combo accessory over a JamCharacter's
 * head/chest. Pure HTML/CSS so it sits naturally on top of the existing
 * chibi art with no asset pipeline.
 *
 * Five variants:
 *   - sunglasses → black visor with two oval lenses + reflective stripe
 *   - halo       → glowing gold ring above the head
 *   - fire       → animated flame crown above the head
 *   - crown      → small gold zig-zag with red gem
 *   - chain      → chunky gold rope across the chest
 *
 * Centering note: each accessory uses `left: 50%, marginLeft: -W/2` for
 * horizontal centering rather than `transform: translateX(-50%)`. That
 * keeps the `transform` slot free for the pop-in animation (which scales
 * and translates Y without touching X).
 */

import type { Accessory } from "../../data/jamCombos";

interface CharacterAccessoryProps {
  accessory: Accessory;
}

export function CharacterAccessory({ accessory }: CharacterAccessoryProps) {
  switch (accessory) {
    case "sunglasses": return <Sunglasses />;
    case "halo":       return <Halo />;
    case "fire":       return <FireCrown />;
    case "crown":      return <Crown />;
    case "chain":      return <Chain />;
  }
}

/* -------------------------------------------------------------------------- */
/* Variants                                                                    */
/* -------------------------------------------------------------------------- */

const POP_ANIM = "comboAccessoryPop 0.32s cubic-bezier(.34,1.56,.64,1) both";

function Sunglasses() {
  // Sits across the eye row (chibi eyes live around top:50 in the head).
  return (
    <div
      style={{
        position: "absolute",
        top: 46, left: 18, right: 18,
        height: 18,
        zIndex: 5,
        pointerEvents: "none",
        animation: POP_ANIM,
        transformOrigin: "50% 50%",
      }}
    >
      {/* bridge bar */}
      <div style={{
        position: "absolute",
        top: "50%", left: 0, right: 0,
        height: 4,
        marginTop: -2,
        background: "#0a0f1c",
        borderRadius: 2,
      }} />
      <Lens left />
      <Lens right />
      <SharedAccessoryKeyframes />
    </div>
  );
}

function Lens({ left, right }: { left?: boolean; right?: boolean }) {
  return (
    <div style={{
      position: "absolute",
      top: 0,
      [left ? "left" : "right"]: 0,
      width: 36,
      height: 18,
      background: "linear-gradient(180deg, #1a1a22 0%, #0a0f1c 100%)",
      border: "2px solid #0a0f1c",
      borderRadius: left ? "10px 14px 14px 10px" : "14px 10px 10px 14px",
      boxShadow: "0 2px 0 rgba(0,0,0,0.5)",
    }}>
      {/* reflective stripe — sells the "glasses" silhouette */}
      <div style={{
        position: "absolute",
        top: 2, left: 4,
        width: 14, height: 4,
        background: "linear-gradient(90deg, rgba(255,255,255,0.65), rgba(255,255,255,0))",
        borderRadius: 2,
        transform: "skewX(-20deg)",
      }} />
    </div>
  );
}

function Halo() {
  // Ring above the head. Width 76 → marginLeft -38 to center.
  const W = 76;
  return (
    <div
      style={{
        position: "absolute",
        top: -18,
        left: "50%",
        marginLeft: -W / 2,
        width: W, height: 24,
        zIndex: 5,
        pointerEvents: "none",
        animation: POP_ANIM,
        transformOrigin: "50% 50%",
      }}
    >
      {/* outer ring */}
      <div style={{
        position: "absolute",
        inset: 0,
        borderRadius: "50%",
        border: "5px solid #f3c44a",
        boxShadow: "0 0 14px rgba(243, 196, 74, 0.85), inset 0 0 6px rgba(255,255,255,0.65)",
        background: "transparent",
      }} />
      {/* slow pulsing glow on top */}
      <div style={{
        position: "absolute",
        inset: -6,
        borderRadius: "50%",
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(255,233,140,0.65) 0%, rgba(255,233,140,0) 65%)",
        animation: "comboHaloGlow 1.6s ease-in-out infinite",
      }} />
      <SharedAccessoryKeyframes />
    </div>
  );
}

function FireCrown() {
  const W = 36;
  return (
    <div
      style={{
        position: "absolute",
        top: -28,
        left: "50%",
        marginLeft: -W / 2,
        width: W, height: 38,
        zIndex: 5,
        pointerEvents: "none",
        animation: POP_ANIM,
        transformOrigin: "50% 100%",
      }}
    >
      {/* glow halo behind the flame */}
      <div style={{
        position: "absolute",
        inset: -8,
        background:
          "radial-gradient(circle at 50% 65%, rgba(251, 146, 60, 0.65) 0%, rgba(251, 146, 60, 0) 60%)",
        filter: "blur(4px)",
        animation: "comboFireGlow 0.8s ease-in-out infinite",
      }} />
      {/* outer flame — orange */}
      <FlameLayer width={28} height={36} bottom={0}  color="#fb923c" speed="0.42s" />
      {/* inner flame — yellow */}
      <FlameLayer width={16} height={24} bottom={2}  color="#facc15" speed="0.55s" />
      {/* core — almost white */}
      <FlameLayer width={6}  height={12} bottom={4}  color="#fffbe5" speed="0.36s" />
      <SharedAccessoryKeyframes />
    </div>
  );
}

function FlameLayer({
  width, height, bottom, color, speed,
}: { width: number; height: number; bottom: number; color: string; speed: string }) {
  return (
    <div style={{
      position: "absolute",
      bottom,
      left: "50%",
      marginLeft: -width / 2,
      width, height,
      background: color,
      borderRadius: "50% 50% 50% 50% / 80% 80% 30% 30%",
      animation: `comboFireFlicker ${speed} ease-in-out infinite`,
      transformOrigin: "50% 100%",
    }} />
  );
}

function Crown() {
  const W = 56;
  return (
    <div
      style={{
        position: "absolute",
        top: -16,
        left: "50%",
        marginLeft: -W / 2,
        width: W, height: 24,
        zIndex: 5,
        pointerEvents: "none",
        animation: POP_ANIM,
        transformOrigin: "50% 100%",
      }}
    >
      <svg width={W} height="24" viewBox="0 0 56 24" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id="crownGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"  stopColor="#f3c44a" />
            <stop offset="100%" stopColor="#a07a0c" />
          </linearGradient>
        </defs>
        <path
          d="M2 22 L8 6 L16 16 L28 2 L40 16 L48 6 L54 22 Z"
          fill="url(#crownGrad)"
          stroke="#0a0f1c"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="28" cy="14" r="3" fill="#E94560" stroke="#0a0f1c" strokeWidth="1.2" />
      </svg>
      <SharedAccessoryKeyframes />
    </div>
  );
}

function Chain() {
  // Chunky gold rope across the chest, on top of the existing hoodie.
  const W = 78;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 90,
        left: "50%",
        marginLeft: -W / 2,
        width: W, height: 22,
        zIndex: 5,
        pointerEvents: "none",
        animation: POP_ANIM,
        transformOrigin: "50% 50%",
      }}
    >
      {/* chain — bumpy gold rope */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 12,
        background:
          "repeating-linear-gradient(90deg, #f3c44a 0px, #d4a017 4px, #f3c44a 8px)",
        border: "1.5px solid #0a0f1c",
        borderRadius: 999,
        boxShadow: "0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)",
      }} />
      {/* pendant */}
      <div style={{
        position: "absolute",
        top: 8,
        left: "50%",
        marginLeft: -9,
        width: 18, height: 22,
        background: "linear-gradient(180deg, #f3c44a 0%, #a07a0c 100%)",
        border: "2px solid #0a0f1c",
        borderRadius: "4px 4px 8px 8px",
        boxShadow: "0 0 12px rgba(212, 160, 23, 0.7)",
      }} />
      <SharedAccessoryKeyframes />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared keyframes — appended once per instance (CSS de-dupes).               */
/* -------------------------------------------------------------------------- */

function SharedAccessoryKeyframes() {
  return (
    <style>{`
      @keyframes comboAccessoryPop {
        0%   { transform: translateY(8px) scale(0.6);  opacity: 0; }
        70%  { transform: translateY(-3px) scale(1.08); opacity: 1; }
        100% { transform: translateY(0)    scale(1);    opacity: 1; }
      }
      @keyframes comboHaloGlow {
        0%, 100% { opacity: 0.55; transform: scale(1);    }
        50%      { opacity: 1.0;  transform: scale(1.08); }
      }
      @keyframes comboFireGlow {
        0%, 100% { opacity: 0.7; }
        50%      { opacity: 1;   }
      }
      @keyframes comboFireFlicker {
        0%, 100% { transform: scaleY(1)    skewX(0deg);  }
        25%      { transform: scaleY(1.08) skewX(-3deg); }
        75%      { transform: scaleY(0.95) skewX(3deg);  }
      }
    `}</style>
  );
}
