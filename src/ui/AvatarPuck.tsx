/**
 * AvatarPuck — UI v1 HUD-corner pet.
 *
 * The tamagotchi got demoted from "framing the entire game" (DeviceShell)
 * to "puck in the top-left corner of the page". To keep the pet alive at
 * small scale, this single component absorbs the three life-elements that
 * used to live in the DeviceShell:
 *
 *   1. CornerEye   → tiny SVG eyes with pupils that track the cursor
 *   2. MouthWave   → mouth shape that morphs with mood + audio level
 *   3. talk bubble → handled separately in <TalkBubble> so it floats
 *                    OUTSIDE the puck (pops next to it on sayLine)
 *
 * Plus new HUD-specific affordances:
 *   - Level ring: conic-gradient stroke around the puck circle
 *   - Idle bob: gentle 2.4s vertical bob animation
 *   - Tap target: the whole puck navigates to the pet portal stage
 *
 * Imperative animations for cursor tracking + audio level so we don't
 * trigger React re-renders every frame. Mood + level changes are reads
 * from the zustand store via subscriptions inside the rAF loop.
 */

import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { useAudioLevel } from "../hooks/useAudioLevel";
import type { Mood } from "../data/types";

interface AvatarPuckProps {
  /** Diameter in px. Default 56 — tuned for the HUD ribbon. */
  size?:    number;
  /** Optional click handler. Defaults to opening the pet portal stage. */
  onClick?: () => void;
}

/**
 * Mouth shape per mood, expressed as an SVG path `d`. The viewBox is 24x24
 * with the mouth occupying the lower third (y ≈ 14-19). Audio level
 * stretches the path's amplitude at runtime — the shapes here are
 * "neutral" baselines.
 */
const MOUTH_PATH: Record<Mood, string> = {
  // Slightly open contented smile
  happy:   "M 8 15 Q 12 18 16 15",
  // Big open excited smile
  hyped:   "M 7 14 Q 12 19 17 14",
  // Closed line with a soft upturn
  chill:   "M 9 16 Q 12 17 15 16",
  // Sad downturn
  sad:     "M 8 17 Q 12 14 16 17",
  // Lonely — slight frown
  lonely:  "M 9 17 Q 12 15 15 17",
  // Sleepy — small horizontal line
  sleepy:  "M 10 16 L 14 16",
  // Asleep — tiny "z" shape implied via dash
  asleep:  "M 10 16 L 14 16",
};

/** Per-mood eye expressions: open/squinted/closed. Renders as height of
 *  the eye sclera ellipse. 1.0 = fully open, 0.2 = squint, 0 = closed. */
const EYE_OPEN: Record<Mood, number> = {
  happy:  1.0,
  hyped:  1.0,
  chill:  0.85,
  sad:    0.7,
  lonely: 0.7,
  sleepy: 0.35,
  asleep: 0.0,
};

/** Per-mood face background tint (the puck's gradient base). */
const MOOD_TINT: Record<Mood, string> = {
  happy:  "from-grvd-purple to-grvd-magenta",
  hyped:  "from-grvd-magenta to-grvd-orange",
  chill:  "from-grvd-purple to-grvd-cyan",
  sad:    "from-grvd-line to-grvd-purple",
  lonely: "from-grvd-line to-grvd-purple",
  sleepy: "from-grvd-base to-grvd-line",
  asleep: "from-grvd-base to-grvd-base",
};

export function AvatarPuck({ size = 56, onClick }: AvatarPuckProps) {
  const tamagotchi    = useStore((s) => s.tamagotchi);
  const moodOverride  = useStore((s) => s.moodOverride);
  const level         = useStore((s) => s.level);
  const setStage      = useStore((s) => s.setStage);

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  const wrapperRef    = useRef<HTMLButtonElement | null>(null);
  const leftPupilRef  = useRef<SVGCircleElement | null>(null);
  const rightPupilRef = useRef<SVGCircleElement | null>(null);
  const mouthRef      = useRef<SVGPathElement   | null>(null);

  const audioLevelRef = useAudioLevel();

  // ── Audio-driven mouth amplitude only ──
  // Cursor-tracking eyes were removed: the pupils were translating past
  // the eye-socket bounds at the puck's small 56px scale, breaking the
  // chunky cartoon look. Mouth still pulses with audio level so the
  // companion feels alive when the DAW is playing.
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
  // Refs left in place to keep the future option of re-enabling eye
  // tracking without an API change.
  void wrapperRef;
  void leftPupilRef;
  void rightPupilRef;

  // ── Level ring as a conic gradient ──
  // Renders a 2px-thick gold ring around the puck. The number badge
  // overlays the ring at the bottom-right.
  const eyeOpenness = EYE_OPEN[mood];

  function handleClick() {
    if (onClick) {
      onClick();
      return;
    }
    setStage("pet" as never);  // pet stage exists in the store after step 8
  }

  return (
    <button
      ref={wrapperRef}
      onClick={handleClick}
      aria-label="open pet"
      className="relative shrink-0 select-none animate-puck-bob"
      style={{ width: size, height: size }}
    >
      {/* Level ring — gold gradient stroke around the puck */}
      <span
        className="absolute inset-0 rounded-full bg-level-ring shadow-glow-gold"
        aria-hidden
      />

      {/* Inner face disc */}
      <span
        className={[
          "absolute inset-[3px] rounded-full",
          "bg-gradient-to-br",
          MOOD_TINT[mood],
          "shadow-chunky-press",
          "overflow-hidden",
        ].join(" ")}
        aria-hidden
      >
        {/* SVG face: 2 eyes + mouth. viewBox 24x24 fills the disc. */}
        <svg
          viewBox="0 0 24 24"
          className="absolute inset-0 w-full h-full"
          aria-hidden
        >
          {/* Eye sclera (white) — height scales with mood openness */}
          <ellipse cx="9"  cy="11" rx="2.2" ry={2.2 * eyeOpenness} fill="#fff" />
          <ellipse cx="15" cy="11" rx="2.2" ry={2.2 * eyeOpenness} fill="#fff" />
          {/* Pupils — translate via ref each frame */}
          {eyeOpenness > 0 && (
            <>
              <circle ref={leftPupilRef}  cx="9"  cy="11" r="1.0" fill="#0a0814" />
              <circle ref={rightPupilRef} cx="15" cy="11" r="1.0" fill="#0a0814" />
            </>
          )}
          {/* Mouth — path swapped each frame for audio-amped curve */}
          <path
            ref={mouthRef}
            d={MOUTH_PATH[mood]}
            stroke="#fff"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Tiny "Z" floating near the head when asleep */}
          {mood === "asleep" && (
            <text x="18" y="6" fontSize="6" fill="#fff" opacity="0.8">z</text>
          )}
        </svg>
      </span>

      {/* Level badge at bottom-right of the ring */}
      <span
        className="absolute -bottom-1 -right-1 min-w-[20px] h-[20px] px-1
                   inline-flex items-center justify-center
                   rounded-full bg-grvd-gold text-grvd-base
                   text-[11px] font-display leading-none
                   shadow-chunky-press"
        aria-label={`level ${level}`}
      >
        {level}
      </span>
    </button>
  );
}
