/**
 * CharacterFace — the BURST pet, drawable at any size.
 *
 * Inspired by the chubby coral creature reference: round body with two
 * rounded ears at the top, big almond eyes with a small white highlight,
 * a soft smile, subtle cheek blush, and a warm coral→peach gradient
 * with a soft inner glow. The face still mood-tints (happy default,
 * cool blue when chill, dim when sleepy, eyes shut when asleep) and
 * the mouth still pulses with audio level when the engine is playing.
 *
 * Used at three scales:
 *   - 52-56px in the LevelBadge (HUD top-left)
 *   - 240px in the Pet portal page
 *   - inline ad-hoc on the Crib welcome screen
 */

import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { useAudioLevel } from "../hooks/useAudioLevel";
import type { Mood } from "../data/types";

interface CharacterFaceProps {
  /** Diameter in px. */
  size?:    number;
  /** Idle vertical bob animation. Default true. */
  bob?:     boolean;
  /** Reserved — older HUD code passed a tracking range when pupils used
   *  to follow the cursor. Now ignored; pupils stay centered. */
  trackRange?: number;
  /** Override the mood (otherwise uses store moodOverride ?? tamagotchi.mood). */
  mood?:    Mood;
  /** Render an overlay of big DJ headphones across the top of the disc.
   *  Used by the Home stage hero where the mascot is "in the studio". */
  headphones?: boolean;
  className?: string;
}

/* -------------------------------------------------------------------------- */
/* Mood maps                                                                    */
/* -------------------------------------------------------------------------- */

/** SVG path for the mouth in each mood state. The viewBox is 0 0 28 28
 *  with the body centered at (14, 16) — mouth lives around y=18-19. */
const MOUTH_PATH: Record<Mood, string> = {
  happy:   "M 11 19 Q 14 21.5 17 19",
  hyped:   "M 10 18.5 Q 14 22 18 18.5",
  chill:   "M 11.5 19 Q 14 19.8 16.5 19",
  sad:     "M 11 20 Q 14 18 17 20",
  lonely:  "M 11.5 20 Q 14 18.6 16.5 20",
  sleepy:  "M 12 19.4 L 16 19.4",
  asleep:  "M 12 19.4 L 16 19.4",
};

/** Per-mood eye openness — 1 fully open, 0 closed. */
const EYE_OPEN: Record<Mood, number> = {
  happy:  1.0,
  hyped:  1.0,
  chill:  0.85,
  sad:    0.7,
  lonely: 0.7,
  sleepy: 0.35,
  asleep: 0.0,
};

/** Per-mood body gradient colors. Happy is the warm coral default
 *  (matches the reference); chill cools off to blue-coral; sad/lonely
 *  desaturate; sleepy/asleep dim. */
const BODY_GRAD: Record<Mood, { top: string; bottom: string }> = {
  happy:  { top: "#ff9a72", bottom: "#ed5c40" },
  hyped:  { top: "#ffb066", bottom: "#ff4d3d" },
  chill:  { top: "#ffa088", bottom: "#7baee8" },
  sad:    { top: "#a89bb5", bottom: "#5a4f75" },
  lonely: { top: "#a89bb5", bottom: "#5a4f75" },
  sleepy: { top: "#9a7f73", bottom: "#5a4838" },
  asleep: { top: "#5a4838", bottom: "#2a1f18" },
};

/** Per-mood cheek blush color. */
const BLUSH: Record<Mood, string> = {
  happy:  "rgba(255,150,170,0.45)",
  hyped:  "rgba(255,170,140,0.55)",
  chill:  "rgba(150,200,240,0.40)",
  sad:    "rgba(140,150,200,0.30)",
  lonely: "rgba(140,150,200,0.30)",
  sleepy: "rgba(0,0,0,0)",
  asleep: "rgba(0,0,0,0)",
};

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export function CharacterFace({
  size       = 200,
  bob        = true,
  trackRange,
  mood: moodProp,
  headphones = false,
  className  = "",
}: CharacterFaceProps) {
  const tamagotchi   = useStore((s) => s.tamagotchi);
  const moodOverride = useStore((s) => s.moodOverride);
  const mood: Mood   = moodProp ?? moodOverride ?? tamagotchi.mood;

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const mouthRef   = useRef<SVGPathElement   | null>(null);
  const audioLevelRef = useAudioLevel();

  // Mouth amplitude — pulses the mouth path's mid-control-point Y
  // proportional to live audio level so the pet feels alive when the
  // engine is playing.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const level = audioLevelRef.current;
      const m     = mouthRef.current;
      if (m) {
        const base = MOUTH_PATH[mood];
        const ampPx = level * 2;
        const adjusted = base.replace(/Q\s+([\d.]+)\s+([\d.]+)/, (_match, x, y) => {
          const yNum = parseFloat(y);
          const direction = yNum >= 19 ? +1 : -1;
          return `Q ${x} ${(yNum + direction * ampPx).toFixed(2)}`;
        });
        if (m.getAttribute("d") !== adjusted) {
          m.setAttribute("d", adjusted);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [mood, audioLevelRef]);
  void trackRange;
  void size;

  const eyeOpen = EYE_OPEN[mood];
  const grad    = BODY_GRAD[mood];
  const blush   = BLUSH[mood];
  const gradId  = `bgrad-${mood}`;
  const glowId  = `bglow-${mood}`;

  return (
    <div
      ref={wrapperRef}
      className={[
        "relative shrink-0 select-none",
        bob ? "animate-puck-bob" : "",
        className,
      ].join(" ")}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 28 28"
        className="absolute inset-0 w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <radialGradient id={gradId} cx="35%" cy="40%">
            <stop offset="0%"   stopColor={grad.top} />
            <stop offset="100%" stopColor={grad.bottom} />
          </radialGradient>
          <radialGradient id={glowId} cx="50%" cy="50%">
            <stop offset="0%"   stopColor="rgba(255,200,160,0.65)" />
            <stop offset="60%"  stopColor="rgba(255,200,160,0)" />
          </radialGradient>
        </defs>

        {/* Soft outer glow halo */}
        <circle cx="14" cy="16" r="14" fill={`url(#${glowId})`} opacity="0.7" />

        {/* Ears — rounded triangular bumps poking up from the body. Drawn
         *  BEFORE the body so the body's edge can overlap them slightly,
         *  which sells the "ears attached to the head" silhouette. */}
        <ellipse
          cx="6" cy="6.5" rx="2.6" ry="3.6"
          fill={`url(#${gradId})`}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="0.3"
          transform="rotate(-22 6 6.5)"
        />
        <ellipse
          cx="22" cy="6.5" rx="2.6" ry="3.6"
          fill={`url(#${gradId})`}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="0.3"
          transform="rotate(22 22 6.5)"
        />

        {/* Body */}
        <circle
          cx="14" cy="16" r="11"
          fill={`url(#${gradId})`}
          stroke="rgba(0,0,0,0.18)"
          strokeWidth="0.4"
        />

        {/* Top-light highlight on the body */}
        <ellipse
          cx="11" cy="11" rx="6" ry="4"
          fill="rgba(255,255,255,0.25)"
        />

        {/* Cheek blush */}
        {blush !== "rgba(0,0,0,0)" && (
          <>
            <ellipse cx="8.5"  cy="17" rx="2.2" ry="1.4" fill={blush} />
            <ellipse cx="19.5" cy="17" rx="2.2" ry="1.4" fill={blush} />
          </>
        )}

        {/* Eyes — big black almond ovals with a small white highlight
         *  near the top. Eyelid scales by mood (eyeOpen). */}
        {eyeOpen > 0 ? (
          <>
            <ellipse cx="10.5" cy="15" rx="1.6" ry={2.1 * eyeOpen} fill="#0a0814" />
            <ellipse cx="17.5" cy="15" rx="1.6" ry={2.1 * eyeOpen} fill="#0a0814" />
            <circle  cx="10.05" cy="14.2" r="0.55" fill="#fff" opacity={Math.min(1, eyeOpen + 0.2)} />
            <circle  cx="17.05" cy="14.2" r="0.55" fill="#fff" opacity={Math.min(1, eyeOpen + 0.2)} />
          </>
        ) : (
          // Closed eyes — gentle arc lines
          <>
            <path d="M 9 15 Q 10.5 16 12 15" stroke="#0a0814" strokeWidth="0.7" fill="none" strokeLinecap="round" />
            <path d="M 16 15 Q 17.5 16 19 15" stroke="#0a0814" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          </>
        )}

        {/* Mouth */}
        <path
          ref={mouthRef}
          d={MOUTH_PATH[mood]}
          stroke="#0a0814"
          strokeWidth="0.9"
          strokeLinecap="round"
          fill="none"
        />

        {/* "Z" floating above the head when asleep */}
        {mood === "asleep" && (
          <text x="22" y="6" fontSize="3" fill="#fff" opacity="0.85" fontFamily="'Lilita One', system-ui">z</text>
        )}
      </svg>

      {/* DJ headphones overlay — silver band over the top + two earcups. */}
      {headphones && (
        <svg
          viewBox="0 0 28 28"
          className="absolute inset-0 pointer-events-none"
          style={{ overflow: "visible" }}
        >
          <path
            d="M 5 13 Q 14 1.5 23 13"
            stroke="#3a3540"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 5 13 Q 14 2 23 13"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.4"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left earcup */}
          <ellipse cx="4" cy="15" rx="2.4" ry="3.2" fill="#3a3540" stroke="#1a161e" strokeWidth="0.4" />
          <ellipse cx="4" cy="15" rx="1.4" ry="2"   fill="#1a161e" />
          {/* Right earcup */}
          <ellipse cx="24" cy="15" rx="2.4" ry="3.2" fill="#3a3540" stroke="#1a161e" strokeWidth="0.4" />
          <ellipse cx="24" cy="15" rx="1.4" ry="2"   fill="#1a161e" />
        </svg>
      )}
    </div>
  );
}
