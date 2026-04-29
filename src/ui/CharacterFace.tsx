/**
 * CharacterFace — the GRVD pet, drawable at any size.
 *
 * Single source of truth for the character's visual treatment, used at
 * three scales today:
 *   - 56px in the AvatarPuck (HUD top-left)
 *   - 240px in the Pet portal page
 *   - 200-280px on Home's stage view (slice 2)
 *
 * Visuals consistent across scales:
 *   - Mood-tinted gradient disc (palette gradient pulled from MOOD_TINT)
 *   - Two SVG eyes whose pupils translate toward the cursor in real-time
 *   - Mouth path that morphs with mood + audio level
 *   - Optional idle bob animation (default on)
 *
 * Differences from AvatarPuck: this component is purely visual — no
 * level ring, no level badge, no tap-to-navigate behavior. The puck
 * keeps those affordances since it's a navigation control; this is the
 * face by itself for use as a hero element.
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
  /** Pupil tracking radius — how far pupils translate from center
   *  when the cursor is far away. Auto-scales with `size` if omitted. */
  trackRange?: number;
  /** Override the mood (otherwise uses store moodOverride ?? tamagotchi.mood). */
  mood?:    Mood;
  /** Render an overlay of big DJ headphones across the top of the disc.
   *  Used by the Home stage hero where the mascot is "in the studio". */
  headphones?: boolean;
  className?: string;
}

const MOUTH_PATH: Record<Mood, string> = {
  happy:   "M 8 15 Q 12 18 16 15",
  hyped:   "M 7 14 Q 12 19 17 14",
  chill:   "M 9 16 Q 12 17 15 16",
  sad:     "M 8 17 Q 12 14 16 17",
  lonely:  "M 9 17 Q 12 15 15 17",
  sleepy:  "M 10 16 L 14 16",
  asleep:  "M 10 16 L 14 16",
};

const EYE_OPEN: Record<Mood, number> = {
  happy:  1.0,
  hyped:  1.0,
  chill:  0.85,
  sad:    0.7,
  lonely: 0.7,
  sleepy: 0.35,
  asleep: 0.0,
};

const MOOD_TINT: Record<Mood, string> = {
  happy:  "from-grvd-purple to-grvd-magenta",
  hyped:  "from-grvd-magenta to-grvd-orange",
  chill:  "from-grvd-purple to-grvd-cyan",
  sad:    "from-grvd-line to-grvd-purple",
  lonely: "from-grvd-line to-grvd-purple",
  sleepy: "from-grvd-base to-grvd-line",
  asleep: "from-grvd-base to-grvd-base",
};

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

  const wrapperRef    = useRef<HTMLDivElement | null>(null);
  const leftPupilRef  = useRef<SVGCircleElement | null>(null);
  const rightPupilRef = useRef<SVGCircleElement | null>(null);
  const mouthRef      = useRef<SVGPathElement   | null>(null);

  const audioLevelRef = useAudioLevel();

  // Auto-scale the pupil-travel radius with size: a 56px puck pupils
  // travel 1.6 SVG units; a 240px face should travel proportionally.
  const effectiveTrackRange = trackRange ?? Math.max(1.6, size / 35);

  // Mouth amplitude RAF loop — pupils stay centered (cursor tracking
  // removed because the pupils were sliding past the eye-socket bounds
  // at every size, which broke the chunky cartoon look).
  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const level = audioLevelRef.current;
      const m     = mouthRef.current;
      if (m) {
        const base = MOUTH_PATH[mood];
        const ampPx = level * 2.5;
        const adjusted = base.replace(/Q\s+(\d+)\s+(\d+(?:\.\d+)?)/, (_match, x, y) => {
          const yNum = parseFloat(y);
          const direction = yNum >= 16 ? +1 : -1;
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
  // Reference unused params to keep the API stable for future re-enables.
  void wrapperRef;
  void effectiveTrackRange;
  void size;
  void leftPupilRef;
  void rightPupilRef;

  const eyeOpen = EYE_OPEN[mood];

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
      {/* Face disc — the rounded mood-tinted gradient */}
      <div
        className={[
          "absolute inset-0 rounded-full overflow-hidden",
          "bg-gradient-to-br", MOOD_TINT[mood],
          "shadow-chunky",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="absolute inset-0 w-full h-full">
          <ellipse cx="9"  cy="11" rx="2.4" ry={2.4 * eyeOpen} fill="#fff" />
          <ellipse cx="15" cy="11" rx="2.4" ry={2.4 * eyeOpen} fill="#fff" />
          {eyeOpen > 0 && (
            <>
              <circle ref={leftPupilRef}  cx="9"  cy="11" r="1.1" fill="#0a0814" />
              <circle ref={rightPupilRef} cx="15" cy="11" r="1.1" fill="#0a0814" />
            </>
          )}
          <path
            ref={mouthRef}
            d={MOUTH_PATH[mood]}
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {mood === "asleep" && (
            <text x="18" y="6" fontSize="6" fill="#fff" opacity="0.8">z</text>
          )}
        </svg>
      </div>

      {/* DJ headphones overlay — silver band over the top, two earcups
       *  on each side. SVG sized to the disc; rendered above the face. */}
      {headphones && (
        <svg
          viewBox="0 0 24 24"
          className="absolute -inset-y-[6%] -inset-x-[8%] pointer-events-none"
          style={{ width: `${size * 1.16}px`, height: `${size * 1.12}px` }}
        >
          {/* Headband — arc across the top */}
          <path
            d="M 4 11 Q 12 1.5 20 11"
            stroke="#3a3540"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
            opacity="0.95"
          />
          <path
            d="M 4 11 Q 12 1.5 20 11"
            stroke="#bcbcc6"
            strokeWidth="0.6"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left earcup */}
          <ellipse cx="3.4"  cy="13" rx="2.4" ry="3.2" fill="#3a3540" stroke="#1a161e" strokeWidth="0.4" />
          <ellipse cx="3.4"  cy="13" rx="1.4" ry="2.0" fill="#1a161e" />
          {/* Right earcup */}
          <ellipse cx="20.6" cy="13" rx="2.4" ry="3.2" fill="#3a3540" stroke="#1a161e" strokeWidth="0.4" />
          <ellipse cx="20.6" cy="13" rx="1.4" ry="2.0" fill="#1a161e" />
          {/* Highlight on the band */}
          <path
            d="M 5 11 Q 12 3 19 11"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.3"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
