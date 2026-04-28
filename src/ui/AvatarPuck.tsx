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

  // ── Cursor tracking + audio-driven mouth amplitude ──
  // One rAF loop drives both. Eyes translate their pupils toward the
  // cursor (clamped to a small radius inside each socket). Mouth path
  // gets its `d` swapped each frame to a level-modulated version of the
  // mood baseline.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    let cursorX = 0;
    let cursorY = 0;
    const onMove = (e: PointerEvent) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      if (cancelled) return;

      const wrapper = wrapperRef.current;
      if (wrapper) {
        const rect = wrapper.getBoundingClientRect();
        const cx   = rect.left + rect.width  / 2;
        const cy   = rect.top  + rect.height / 2;

        // Vector from puck center to cursor, normalized + clamped to a
        // short radius (2px max) so the eyes feel alive without going
        // wall-eyed.
        let dx = cursorX - cx;
        let dy = cursorY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const r = Math.min(1.6, dist / 240);  // saturates after 240px
        dx = (dx / dist) * r;
        dy = (dy / dist) * r;

        const lp = leftPupilRef.current;
        const rp = rightPupilRef.current;
        if (lp) lp.setAttribute("transform", `translate(${dx} ${dy})`);
        if (rp) rp.setAttribute("transform", `translate(${dx} ${dy})`);
      }

      // Mouth amplitude from audio level (or a small idle wobble when silent
      // and the mood permits). Scales the y-coordinate of the bezier control
      // point.
      const level = audioLevelRef.current;
      const m     = mouthRef.current;
      if (m) {
        const base = MOUTH_PATH[mood];
        // Mood-keyed baseline + audio-driven amplitude on top.
        // Strategy: parse the mid-control-point y from the path, adjust by
        // ±2px scaled by level, write back. Simple regex on Q paths:
        const ampPx = level * 2.5;
        const adjusted = base.replace(/Q\s+(\d+)\s+(\d+(?:\.\d+)?)/, (_match, x, y) => {
          // Mood mouths that curve UP (smiles) get more curve when amped.
          // Mood mouths that curve DOWN (frowns) get less when amped (less
          // miserable). Heuristic: mouths whose Q-y < 16 are smiles.
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
      window.removeEventListener("pointermove", onMove);
    };
  }, [mood, audioLevelRef]);

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
