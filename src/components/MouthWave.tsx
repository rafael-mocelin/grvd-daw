/**
 * MouthWave — the companion's mouth, rendered as a live oscilloscope.
 *
 * Draws the master-output waveform as a smooth line that dances with
 * audio. When silent, the line eases to a NEUTRAL flat baseline (mood
 * expression is carried by the eyes — the mouth stays neutral so it
 * reads as a real oscilloscope readout, not a smiley/frowny face).
 *
 * The only non-flat idle state is `asleep` — a slow gentle breath.
 *
 * Animation is imperative (direct path `d` attribute updates) — no
 * React re-renders on every frame.
 */

import { useEffect, useRef } from "react";
import { getMasterAnalyser, isStarted } from "../audio/engine";
import type { Mood } from "../data/types";

export interface MouthWaveProps {
  mood: Mood;
  /** Line color (accent / glow). */
  color: string;
  /** Rendered width of the display FRAME in px. Default 340. */
  width?: number;
  /** Rendered height of the display FRAME in px. Default 64. */
  height?: number;
  /**
   * Optional line the companion is "saying". When set, the waveform fades back
   * and the text scrolls right-to-left across the mouth display like a
   * marquee/ticker, re-appearing from the right each pass. null = silent.
   */
  talk?: string | null;
}

// How many points to sample across the waveform.
const POINTS = 48;

export function MouthWave({ mood, color, width = 340, height = 64, talk }: MouthWaveProps) {
  // Active when there's actual text to say. The waveform dims so the text
  // reads clearly; when silent, the wave comes back to full intensity.
  const isTalking = !!talk && talk.trim().length > 0;
  // Ticker speed: ~55 px/s. Total distance is 100% of the inner track width
  // (parent width + text width). Using a heuristic on character count keeps
  // short lines from zipping by too fast while long lines stay readable.
  const scrollSeconds = Math.max(5.5, (talk?.length ?? 0) * 0.22);

  const pathRef = useRef<SVGPathElement | null>(null);
  const moodRef = useRef<Mood>(mood);
  useEffect(() => { moodRef.current = mood; }, [mood]);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    // Per-sample current y values for easing toward target.
    const current = new Float32Array(POINTS);
    const target = new Float32Array(POINTS);

    const W = 100; // SVG viewBox width
    const H = 30;  // SVG viewBox height
    const midY = H / 2;

    /** Compute the resting-line target when audio is silent. Flat/neutral. */
    function computeMoodShape(now: number) {
      const m = moodRef.current;
      // Asleep gets a very slow sinusoidal breath across the whole line.
      // Every other mood renders as a flat neutral baseline.
      if (m === "asleep") {
        const breath = Math.sin(now / 900) * 0.8;
        for (let i = 0; i < POINTS; i++) target[i] = midY + breath;
      } else {
        for (let i = 0; i < POINTS; i++) target[i] = midY;
      }
    }

    const tick = () => {
      if (cancelled) return;
      const now = Date.now();

      if (isStarted()) {
        try {
          const analyser = getMasterAnalyser();
          const data = analyser.getValue();
          if (data instanceof Float32Array && data.length > 0) {
            // Compute overall RMS to decide: audio-driven or mood-shape?
            let sumSq = 0;
            for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
            const rms = Math.sqrt(sumSq / data.length);

            if (rms > 0.01) {
              // Audio-driven: downsample the waveform buffer into POINTS.
              const step = data.length / POINTS;
              for (let i = 0; i < POINTS; i++) {
                const s = data[Math.floor(i * step)] || 0;
                // Amplify so the mouth reads clearly even on quiet passages.
                const amp = Math.max(-1, Math.min(1, s * 6));
                target[i] = midY + amp * (H / 2) * 0.9;
              }
            } else {
              computeMoodShape(now);
            }
          } else {
            computeMoodShape(now);
          }
        } catch {
          computeMoodShape(now);
        }
      } else {
        computeMoodShape(now);
      }

      // Ease current toward target for smoothness.
      for (let i = 0; i < POINTS; i++) {
        current[i] += (target[i] - current[i]) * 0.28;
      }

      // Build SVG path — smooth cubic curves through the points.
      if (pathRef.current) {
        let d = `M 0 ${current[0].toFixed(2)}`;
        for (let i = 1; i < POINTS; i++) {
          const x = (i / (POINTS - 1)) * W;
          const y = current[i];
          // Simple L draws — with POINTS this dense it reads smoothly enough.
          d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
        }
        pathRef.current.setAttribute("d", d);
      }

      raf = requestAnimationFrame(tick);
    };

    // Initialize to mood shape so first frame doesn't jump.
    computeMoodShape(Date.now());
    for (let i = 0; i < POINTS; i++) current[i] = target[i];

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  // Inner drawing area — sits inside the screen frame with padding.
  const INSET_X = 8;
  const INSET_Y = 5;
  const innerW = width - INSET_X * 2;
  const innerH = height - INSET_Y * 2;

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        borderRadius: 7,
        // Deep dark "screen" with subtle gradient like a CRT/LCD
        background:
          `linear-gradient(180deg, #04030a 0%, #0a0712 50%, #04030a 100%)`,
        border: "1px solid rgba(0,0,0,0.8)",
        // Inset shadow = recessed display, plus a thin inner ring so it reads as a display
        boxShadow: `
          inset 0 2px 6px rgba(0,0,0,0.9),
          inset 0 -1px 0 rgba(255,255,255,0.04),
          inset 0 0 0 1px ${color}22,
          0 1px 0 rgba(255,255,255,0.05)
        `,
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      {/* Faint scanline texture for CRT feel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)",
          opacity: 0.6,
        }}
      />
      {/* Center baseline — barely visible, gives the waveform a "zero line" */}
      <div
        style={{
          position: "absolute",
          left: INSET_X,
          right: INSET_X,
          top: "50%",
          height: 1,
          background: `${color}1a`,
          pointerEvents: "none",
        }}
      />
      <svg
        width={innerW}
        height={innerH}
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        style={{
          overflow: "visible",
          display: "block",
          position: "absolute",
          left: INSET_X,
          top: INSET_Y,
          // Fade the waveform back when the DAW is speaking so the text reads
          // clearly — but keep a hint of movement underneath for life.
          opacity: isTalking ? 0.22 : 1,
          transition: "opacity 0.35s ease-out",
        }}
      >
        <path
          ref={pathRef}
          d="M 0 15 L 100 15"
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 5px ${color}cc)` }}
        />
      </svg>

      {/* Speech ticker — scrolling text INSIDE the mouth frame.
       * Mounts only while `talk` is set. The `key={talk}` ensures the CSS
       * animation restarts from the right edge each time the line changes. */}
      {isTalking && (
        <div
          key={talk}
          style={{
            position: "absolute",
            left: INSET_X,
            right: INSET_X,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "inline-block",
              whiteSpace: "nowrap",
              // paddingLeft: 100% pushes the text fully past the right edge
              // of the container, so it *enters* from the right when we
              // translateX(-100%) across the span's full width.
              paddingLeft: "100%",
              fontFamily: "monospace",
              fontSize: Math.min(16, Math.round(height * 0.36)),
              fontWeight: 700,
              letterSpacing: "0.06em",
              color,
              textShadow: `0 0 8px ${color}aa, 0 0 2px ${color}ff`,
              animation: `mouthTicker ${scrollSeconds}s linear infinite`,
              willChange: "transform",
            }}
          >
            {talk}
          </div>
          <style>{`
            @keyframes mouthTicker {
              from { transform: translateX(0); }
              to   { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
