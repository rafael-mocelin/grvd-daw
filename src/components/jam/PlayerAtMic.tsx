/**
 * PlayerAtMic — the lead vocalist (the player) standing at the
 * microphone in the front-center of the Crib stage.
 *
 * Composition: rendered character sprite (PNG, transparent) above a
 * compact mic stand. The mic + sprite share a single anchor point so
 * JamView can position the whole unit by its feet via the standard
 * translate(-50%, -100%) pattern.
 *
 * Asset: public/characters/player-character.png — 2000x2000 RGBA, the
 * 3D-rendered chibi the user dropped in.
 *
 * If you swap the asset, keep the same proportions (full-body, feet at
 * bottom of the frame, transparent background) so the anchor + mic
 * stand placement underneath the chin still line up.
 */

import { useEffect, useRef } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface PlayerAtMicProps {
  /** When true, the player slot reacts to audio (subtle bob + pulse).
   *  When false (paused / nothing playing) the player holds still. */
  active: boolean;
}

/** How tall the player sprite renders, in px. The chibi proportions
 *  in the asset put the head about 50% of total height; we want the
 *  player visibly larger than the band slots (130x220) so the lead
 *  reads as the star. Bumped from 200 → 250 (+25%) per playtest:
 *  the previous size felt small against the rendered iso room. */
const PLAYER_HEIGHT = 250;
const PLAYER_WIDTH  = PLAYER_HEIGHT;   // square asset

export function PlayerAtMic({ active }: PlayerAtMicProps) {
  const audioFrame = useJamAudioFrame();
  const spriteRef  = useRef<HTMLImageElement>(null!);

  // Subtle audio-reactive bob — head nods up & down on overall energy
  // with a slight scale on kick. Never huge: the player is a static
  // sprite for now (no animation frames yet), so we want movement that
  // sells "alive" without giving away the lack of frames.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = spriteRef.current;
      if (node) {
        const { overall, kick } = audioFrame.current;
        const o = active ? overall : 0;
        const k = active ? kick    : 0;
        const dy = -o * 4;                  // up to 4px lift
        const scale = 1 + k * 0.04;          // tiny punch on kick
        node.style.transform = `translate(0, ${dy.toFixed(2)}px) scale(${scale.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, active]);

  return (
    <div
      style={{
        position: "relative",
        width:  PLAYER_WIDTH,
        // A little extra height below the sprite for the mic stand
        // base + the YOU label.
        height: PLAYER_HEIGHT + 28,
        pointerEvents: "none",
      }}
      aria-label="player — the lead at the mic"
    >
      {/* Mic stand — a compact version of the placeholder, rendered IN
       *  FRONT of the character so the silhouette of "person at mic"
       *  reads. zIndex above the sprite. */}
      <Mic />

      {/* Player sprite — anchored bottom-center of the inner box, image
       *  fills the box. */}
      <img
        ref={spriteRef}
        src="/characters/player-character.png"
        alt=""
        draggable={false}
        style={{
          position: "absolute",
          bottom:  28,
          left:    0,
          width:   PLAYER_WIDTH,
          height:  PLAYER_HEIGHT,
          objectFit: "contain",
          // Soft drop shadow so the sprite reads as "in the room"
          // instead of "stuck on top of the render."
          filter: "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.55))",
          willChange: "transform",
          // Initial transform (overwritten by rAF on first frame).
          transform: "translate(0, 0) scale(1)",
          // No selection / drag affordances — sprite is decorative.
          userSelect: "none",
          WebkitUserSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* "YOU" label below the unit so the player's slot is unambiguous. */}
      <div
        style={{
          position: "absolute",
          bottom:  6,
          left:    "50%",
          marginLeft: -28,
          width:   56,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255, 255, 255, 0.78)",
          textTransform: "uppercase",
          textShadow: "0 1px 0 rgba(0, 0, 0, 0.7)",
        }}
      >
        you
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mic — a small CSS mic stand placed in front of the player.                 */
/* -------------------------------------------------------------------------- */

function Mic() {
  return (
    <div
      style={{
        position: "absolute",
        // Centered under the sprite's chin: the chibi's mouth is
        // around 30% from the top of the asset, so we want the mic
        // head at around the same height. Render the stand from the
        // floor up to that point.
        bottom: 28,
        left:   "50%",
        marginLeft: -16,
        width:  32,
        height: 130,
        zIndex: 2,    // in front of the sprite
        filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.6))",
        pointerEvents: "none",
      }}
    >
      {/* Floor base — flat ellipse */}
      <div
        style={{
          position: "absolute",
          bottom:  0,
          left:    "50%",
          marginLeft: -14,
          width:   28,
          height:  10,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
          border: "1.5px solid #0a0f1c",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18)",
        }}
      />
      {/* Pole */}
      <div
        style={{
          position: "absolute",
          bottom:  6,
          left:    "50%",
          marginLeft: -1.5,
          width:   3,
          height:  100,
          background: "linear-gradient(90deg, #0a0a14 0%, #2a2a32 50%, #0a0a14 100%)",
          borderRadius: 1.5,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
        }}
      />
      {/* Mic head — capsule at top */}
      <div
        style={{
          position: "absolute",
          top:     0,
          left:    "50%",
          marginLeft: -10,
          width:   20,
          height:  26,
          background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
          border: "2px solid #0a0f1c",
          borderRadius: "11px 11px 50% 50% / 13px 13px 80% 80%",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), 0 2px 0 rgba(0,0,0,0.4)",
        }}
      >
        {/* foam highlight */}
        <div
          style={{
            position: "absolute",
            top:    2,
            left:   2,
            right:  2,
            height: 12,
            background:
              "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.28), rgba(255,255,255,0) 70%)",
            borderRadius: "10px 10px 50% 50% / 10px 10px 60% 60%",
          }}
        />
        {/* on-air dot */}
        <div
          style={{
            position: "absolute",
            bottom:  4,
            left:    "50%",
            marginLeft: -2,
            width:   4,
            height:  4,
            borderRadius: "50%",
            background: "#E94560",
            boxShadow: "0 0 6px rgba(233, 69, 96, 0.85)",
            animation: "playerMicPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes playerMicPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
