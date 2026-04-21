/**
 * CornerEye — a soft, cartoony, expressive eye for the device shell corners.
 *
 * Behavior:
 *   • Blinks periodically (idle blink every ~2.5-7s)
 *   • Tracks a SHARED viewport gaze target (so both eyes converge on the
 *     same point — no crosseyed/walleyed look). The shared target comes
 *     from useSharedGaze().
 *   • Scales its pupil with live audio (audioLevelRef from useAudioLevel).
 *   • Mood variants (hyped/sleepy/asleep/sad) overlay accents around the
 *     eye — they NEVER hide the live pupil, so you can always see it
 *     dancing with the beat.
 *
 * All per-frame animation is imperative (writing attributes via refs) —
 * React only re-renders when mood/colors change.
 */

import { useEffect, useRef, type RefObject } from "react";
import type { Mood } from "../data/types";
import type { GazeTarget } from "../hooks/useSharedGaze";

export interface CornerEyeProps {
  /** Which corner — used for mood-accent side and subtle idle bias. */
  side: "left" | "right";
  mood: Mood;
  /** Iris color (mood-glow). */
  irisColor: string;
  /** Eyelid color — matches the shell body so lids look like part of it. */
  lidColor: string;
  /** Rendered size in px (square). Default 84. */
  size?: number;
  /** Ref to a 0..1 live audio level from useAudioLevel. Optional. */
  audioLevelRef?: RefObject<number>;
  /** Shared viewport gaze target from useSharedGaze. Both eyes consume this. */
  gazeRef: RefObject<GazeTarget>;
}

export function CornerEye({
  side,
  mood,
  irisColor,
  lidColor,
  size = 84,
  audioLevelRef,
  gazeRef,
}: CornerEyeProps) {
  const rootRef   = useRef<SVGSVGElement | null>(null);
  const irisRef   = useRef<SVGGElement    | null>(null);
  const pupilRef  = useRef<SVGGElement    | null>(null);
  const topLidRef = useRef<SVGRectElement | null>(null);
  const botLidRef = useRef<SVGRectElement | null>(null);
  const moodRef   = useRef<Mood>(mood);

  useEffect(() => { moodRef.current = mood; }, [mood]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    /* -------- Blink state machine -------- */
    type BlinkPhase = "idle" | "closing" | "closed" | "opening";
    let blinkPhase: BlinkPhase = "idle";
    let nextBlinkAt = Date.now() + 1500 + Math.random() * 3000;
    let phaseStart = 0;

    /* -------- Eased local gaze (each eye's own rendering) -------- */
    let lookX = 0, lookY = 0;

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();
      const currentMood = moodRef.current;

      // --- Blink state machine ---
      if (blinkPhase === "idle" && now >= nextBlinkAt) {
        blinkPhase = "closing";  phaseStart = now;
      } else if (blinkPhase === "closing" && now - phaseStart >= 90) {
        blinkPhase = "closed";   phaseStart = now;
      } else if (blinkPhase === "closed" && now - phaseStart >= 60) {
        blinkPhase = "opening";  phaseStart = now;
      } else if (blinkPhase === "opening" && now - phaseStart >= 110) {
        blinkPhase = "idle";
        nextBlinkAt = now + 2500 + Math.random() * 4500;
      }

      const blinkFrac =
        blinkPhase === "closing" ? Math.min(1, (now - phaseStart) / 90) :
        blinkPhase === "closed"  ? 1 :
        blinkPhase === "opening" ? Math.max(0, 1 - (now - phaseStart) / 110) :
        0;

      const moodLid =
        currentMood === "asleep" ? 1 :
        currentMood === "sleepy" ? 0.55 :
        0;

      const lidFrac = Math.max(moodLid, blinkFrac);

      // --- Compute this eye's gaze toward the SHARED viewport target ---
      // Each eye aims at the same world point; their directional vectors
      // differ naturally by eye position (that's real convergence).
      const svg = rootRef.current;
      const target = gazeRef.current;
      let targetX = 0, targetY = 0;
      if (svg && target) {
        const rect = svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        const dx = target.x - cx;
        const dy = target.y - cy;
        const dist = Math.hypot(dx, dy);
        const eyeRadius = rect.width / 2;
        if (dist > 2) {
          // Key rule: once the cursor is OUTSIDE the eye's own visible circle,
          // the pupil should fully point toward it — magnitude saturates to 1.
          // Only scale DOWN when the cursor is inside the eye area (where
          // tracking direction becomes ambiguous anyway). This fixes the
          // "close cursor → eye looks forward" bug.
          const mag = dist >= eyeRadius ? 1 : dist / eyeRadius;
          targetX = (dx / dist) * mag;
          targetY = (dy / dist) * mag;
        }
      }

      // Sad moods keep the gaze drooping down no matter what.
      if (currentMood === "sad" || currentMood === "lonely") {
        targetY = Math.max(targetY, 0.45);
      }

      lookX += (targetX - lookX) * 0.12;
      lookY += (targetY - lookY) * 0.12;

      // --- Apply transforms imperatively ---
      if (irisRef.current) {
        const ox = lookX * 11;
        const oy = lookY * 9;
        irisRef.current.setAttribute("transform", `translate(${50 + ox} ${50 + oy})`);
      }

      if (pupilRef.current) {
        const level = audioLevelRef?.current ?? 0;
        // Pupil dilates with audio — very visible, cartoony reactive.
        const scale = 1 + level * 0.55;
        pupilRef.current.setAttribute("transform", `scale(${scale})`);
      }

      if (topLidRef.current) {
        topLidRef.current.setAttribute("transform", `translate(0 ${50 * lidFrac})`);
      }
      if (botLidRef.current) {
        const bottomFrac = Math.max(0, (lidFrac - 0.7) / 0.3);
        botLidRef.current.setAttribute("transform", `translate(0 ${-50 * bottomFrac})`);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioLevelRef, gazeRef]);

  const isHyped  = mood === "hyped";
  const isSad    = mood === "sad" || mood === "lonely";
  const isAsleep = mood === "asleep";

  const uid = `eye-${side}`;

  return (
    <svg
      ref={rootRef}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ overflow: "visible", pointerEvents: "none", display: "block" }}
      aria-hidden="true"
    >
      <defs>
        {/* Sclera — warm accent-tinted instead of stark white (friendlier) */}
        <radialGradient id={`${uid}-sclera`} cx="42%" cy="38%">
          <stop offset="0%"   stopColor={`${irisColor}55`} />
          <stop offset="60%"  stopColor={`${irisColor}2a`} />
          <stop offset="100%" stopColor={`${irisColor}15`} />
        </radialGradient>
        {/* Iris — deeper accent at edge, brighter center */}
        <radialGradient id={`${uid}-iris`} cx="50%" cy="50%">
          <stop offset="0%"   stopColor={irisColor} stopOpacity="0.85" />
          <stop offset="60%"  stopColor={irisColor} stopOpacity="1" />
          <stop offset="100%" stopColor={irisColor} stopOpacity="0.4" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="40" />
        </clipPath>
      </defs>

      {/* Soft glow underneath (alive-feeling halo) */}
      <circle cx="50" cy="50" r="44" fill={irisColor} opacity="0.15" />

      {/* Sclera socket — no harsh dark outline, just a soft ring */}
      <circle
        cx="50" cy="50" r="40"
        fill={`url(#${uid}-sclera)`}
        stroke={`${irisColor}88`}
        strokeWidth="1.5"
      />

      {/* Clipped contents — iris, pupil, highlight, tear, sparkles */}
      <g clipPath={`url(#${uid}-clip)`}>
        {/* Iris group — translated by rAF loop for look direction */}
        <g ref={irisRef} transform="translate(50 50)">
          {/* Hyped sparkle ring — decorative overlay BEHIND the iris */}
          {isHyped && (
            <>
              <path
                d="M 0 -30 L 4 -10 L 14 -18 L 8 -4 L 28 0 L 8 4 L 14 18 L 4 10 L 0 30 L -4 10 L -14 18 L -8 4 L -28 0 L -8 -4 L -14 -18 L -4 -10 Z"
                fill={`${irisColor}55`}
                opacity="0.8"
              >
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="8s"
                  repeatCount="indefinite"
                />
              </path>
            </>
          )}

          {/* Iris ring — always visible, so pupil always readable */}
          <circle r="24" fill={`url(#${uid}-iris)`} />
          {/* Inner iris color wash */}
          <circle r="17" fill={irisColor} opacity="0.4" />

          {/* Pupil group — audio-reactive scaling applied here.
              Kept visible in ALL moods including hyped. */}
          <g ref={pupilRef}>
            {/* Dark pupil — purple-tinted instead of pure black (softer) */}
            <circle r="11" fill="#1a1226" />
            <circle r="11" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          </g>
          {/* Big cartoony highlight */}
          <ellipse cx="-6" cy="-7" rx="5" ry="4" fill="rgba(255,255,255,0.95)" />
          {/* Secondary mini-highlight */}
          <circle cx="5" cy="5" r="1.8" fill="rgba(255,255,255,0.55)" />
        </g>

        {/* Tear for sad mood */}
        {isSad && (
          <path
            d={`M ${side === "left" ? 28 : 72} 62
               Q ${side === "left" ? 25 : 75} 78 ${side === "left" ? 30 : 70} 84
               Q ${side === "left" ? 35 : 65} 78 ${side === "left" ? 28 : 72} 62 Z`}
            fill="rgba(150,210,255,0.85)"
            stroke="rgba(70,140,220,0.8)"
            strokeWidth="0.7"
          />
        )}

        {/* Top eyelid */}
        <rect
          ref={topLidRef}
          x="0" y="-50" width="100" height="50"
          fill={lidColor}
          transform="translate(0 0)"
        />
        {/* Bottom eyelid */}
        <rect
          ref={botLidRef}
          x="0" y="100" width="100" height="50"
          fill={lidColor}
          transform="translate(0 0)"
        />
      </g>

      {/* Soft rim on top of lids */}
      <circle
        cx="50" cy="50" r="40"
        fill="none"
        stroke={`${irisColor}66`}
        strokeWidth="1.5"
      />

      {/* Brow for sad — softer angle */}
      {isSad && (
        <line
          x1={side === "left" ? 22 : 78}
          y1={12}
          x2={side === "left" ? 48 : 52}
          y2={18}
          stroke={`${irisColor}cc`}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      )}

      {/* Sparkles for hyped — accents AROUND the eye, not replacing the pupil */}
      {isHyped && (
        <g>
          <circle cx={side === "left" ? 14 : 86} cy={14} r="2" fill={irisColor}>
            <animate attributeName="opacity" values="0.3;1;0.3" dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="r" values="1.5;2.5;1.5" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={side === "left" ? 8 : 92} cy={36} r="1.4" fill="#fff">
            <animate attributeName="opacity" values="1;0.2;1" dur="1.1s" repeatCount="indefinite" />
          </circle>
          <circle cx={side === "left" ? 24 : 76} cy={3} r="1.6" fill={irisColor}>
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.1s" repeatCount="indefinite" />
          </circle>
          <circle cx={side === "left" ? 3 : 97} cy={22} r="1.2" fill="#fff">
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {/* Floating "z" for asleep */}
      {isAsleep && (
        <g opacity="0.8">
          <text
            x={side === "left" ? 80 : 10}
            y="14"
            fill={irisColor}
            fontSize="13"
            fontWeight="900"
            fontFamily="monospace"
          >
            z
            <animate attributeName="y" values="14;8;14" dur="3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.2;1;0.2" dur="3s" repeatCount="indefinite" />
          </text>
        </g>
      )}
    </svg>
  );
}
