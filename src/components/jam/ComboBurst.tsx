/**
 * ComboBurst — the one-shot fireworks that fire when a combo activates.
 *
 * Two layers:
 *   1. A full-stage flash in the combo's accent color — quick fade-in,
 *      slow fade-out (~700ms total). Sells the "punch" of the moment.
 *   2. A confetti rain — 32 small pixel squares spawn at the top, fall
 *      with a randomized rotation and X drift, fade out at the end.
 *
 * Mounts once per activation (the parent keys the component on the
 * combo id so a new combo retriggers a fresh mount). Self-unmounts via
 * a setTimeout so the parent doesn't have to manage a "burst is done"
 * state — just `{showBurst && <ComboBurst combo={...} onDone={...} />}`.
 */

import { useEffect, useMemo } from "react";
import type { JamCombo } from "../../data/jamCombos";

interface ComboBurstProps {
  combo:  JamCombo;
  onDone: () => void;
}

const PARTICLE_COUNT = 32;
const BURST_MS       = 1400;

export function ComboBurst({ combo, onDone }: ComboBurstProps) {
  // Pre-randomize particle parameters so they're stable across re-renders
  // within this mount. Each new mount = new randomization.
  const particles = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => makeParticle(i, combo.accent)),
    [combo.accent],
  );

  useEffect(() => {
    const t = window.setTimeout(onDone, BURST_MS);
    return () => window.clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 25,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Stage flash — full-bleed wash that punches in then slowly fades */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 50%, ${combo.accent}55 0%, ${combo.accent}11 50%, transparent 80%)`,
          mixBlendMode: "screen",
          animation: "comboFlashIn 0.7s ease-out forwards",
        }}
      />

      {/* Confetti rain */}
      {particles.map((p) => (
        <div
          key={p.key}
          style={{
            position: "absolute",
            top: -12,
            left: `${p.startX}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.shape === "square" ? 1 : "50%",
            opacity: 0,
            animation: `comboParticle ${p.duration}s ${p.delay}s ease-out forwards`,
            // The animation reads these custom props for its end-state offsets.
            // Fallbacks built into the keyframe so older browsers don't break.
            ["--end-x" as string]: `${p.endXDelta}px`,
            ["--end-y" as string]: `${p.endY}px`,
            ["--end-rot" as string]: `${p.endRot}deg`,
          } as React.CSSProperties}
        />
      ))}

      <style>{`
        @keyframes comboFlashIn {
          0%   { opacity: 0;   }
          18%  { opacity: 1;   }
          100% { opacity: 0;   }
        }
        @keyframes comboParticle {
          0%   { opacity: 0;   transform: translate(0, 0)         rotate(0deg); }
          12%  { opacity: 1;   }
          100% { opacity: 0;   transform: translate(var(--end-x, 0), var(--end-y, 600px)) rotate(var(--end-rot, 720deg)); }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

interface Particle {
  key:       number;
  startX:    number; // 0..100 (% of stage width)
  endXDelta: number; // px drift left/right by end of fall
  endY:      number; // px below the start (positive = down)
  endRot:    number; // total rotation in deg
  size:      number; // px
  color:     string;
  shape:     "square" | "circle";
  duration:  number; // s
  delay:     number; // s
}

/**
 * Generate a confetti particle. Mix the combo accent with white and a
 * couple of "festive" hues so the rain doesn't read as a single-color
 * blob.
 */
function makeParticle(i: number, accent: string): Particle {
  const shape: "square" | "circle" = i % 3 === 0 ? "circle" : "square";
  const palette = [accent, "#ffffff", "#facc15", "#22d3ee"];
  return {
    key:       i,
    startX:    Math.random() * 100,
    endXDelta: (Math.random() - 0.5) * 220,
    endY:      450 + Math.random() * 220,
    endRot:    (Math.random() * 1080 - 540),
    size:      6 + Math.random() * 6,
    color:     palette[i % palette.length],
    shape,
    duration:  0.9 + Math.random() * 0.5,
    delay:     Math.random() * 0.15,
  };
}
