/**
 * StagePulse — non-interactive overlay that makes the Jam stage feel
 * alive even when the player isn't doing anything.
 *
 * Reads the shared FFT band frame (useJamAudioFrame) and writes inline
 * styles to three layers:
 *
 *   1. Floor pulse  — a radial coral glow centered under the cast that
 *                     scales + brightens on every kick hit.
 *   2. Hat flashes  — two back-corner spotlights that flicker on hi-hat
 *                     band energy. Snappy attack, quick decay.
 *   3. Ambient hum  — a soft full-stage tint that fades in proportional
 *                     to overall loudness, so the stage darkens on
 *                     pause and brightens when the mix is full.
 *
 * Pure visuals — does not affect audio routing, click handling, or
 * layout. Lives behind the character row (zIndex: 1) and above the
 * studio backdrop.
 */

import { useEffect, useRef } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface StagePulseProps {
  /** When false (master pause / nothing assigned) the pulse decays to
   *  zero — the stage holds its breath. */
  active: boolean;
}

export function StagePulse({ active }: StagePulseProps) {
  const audioFrame = useJamAudioFrame();
  const floorRef   = useRef<HTMLDivElement>(null!);
  const flashLRef  = useRef<HTMLDivElement>(null!);
  const flashRRef  = useRef<HTMLDivElement>(null!);
  const ambientRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const { overall, kick, hat } = audioFrame.current;

      const o = active ? overall : 0;
      const k = active ? kick    : 0;
      const h = active ? hat     : 0;

      // Floor pulse — scale 1.0 → 1.25 on the kick, opacity 0.4 → 0.95.
      // Quick math: kick lives in 0..1, multiply for visual range.
      if (floorRef.current) {
        const scale  = 1 + k * 0.25;
        const alpha  = 0.4 + k * 0.55;
        floorRef.current.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
        floorRef.current.style.opacity   = alpha.toFixed(3);
      }

      // Spotlight flashes — opacity gated to hat energy. Two corners,
      // identical signal but you'll perceive them as a stereo flicker
      // because of slight CSS-driven timing differences.
      const flashAlpha = Math.min(1, h * 1.6);
      if (flashLRef.current) flashLRef.current.style.opacity = flashAlpha.toFixed(3);
      if (flashRRef.current) flashRRef.current.style.opacity = flashAlpha.toFixed(3);

      // Ambient stage tint — opacity scales with overall, capped low so
      // it never washes out the backdrop. Adds a "the room is hot" feel.
      if (ambientRef.current) {
        const tintAlpha = Math.min(0.32, o * 0.45);
        ambientRef.current.style.opacity = tintAlpha.toFixed(3);
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
    <>
      {/* Ambient stage tint — full-bleed coral wash, very subtle */}
      <div
        ref={ambientRef}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at 50% 60%, rgba(233, 69, 96, 0.45) 0%, rgba(233, 69, 96, 0) 60%)",
          mixBlendMode: "screen",
          opacity: 0,
          transition: "opacity 80ms linear",
          zIndex: 1,
        }}
      />

      {/* Floor pulse — radial glow under the cast. Sits above the wood
       *  perspective floor, below the characters. */}
      <div
        ref={floorRef}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "12%",
          width: "62%",
          height: 140,
          transform: "translateX(-50%)",
          transformOrigin: "50% 100%",
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(233, 69, 96, 0.7) 0%, rgba(212, 160, 23, 0.35) 30%, rgba(233, 69, 96, 0) 70%)",
          borderRadius: "50%",
          filter: "blur(8px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          opacity: 0.4,
          zIndex: 2,
        }}
      />

      {/* Spotlight flashes — back-left and back-right cones that blink on
       *  hi-hat hits. Tilted slightly inward toward center stage. */}
      <div
        ref={flashLRef}
        style={{
          position: "absolute",
          top: 0,
          left: "8%",
          width: 180,
          height: "85%",
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.18) 30%, rgba(255, 255, 255, 0) 70%)",
          transform: "skewX(12deg)",
          transformOrigin: "top left",
          mixBlendMode: "screen",
          pointerEvents: "none",
          filter: "blur(2px)",
          opacity: 0,
          transition: "opacity 60ms linear",
          zIndex: 1,
        }}
      />
      <div
        ref={flashRRef}
        style={{
          position: "absolute",
          top: 0,
          right: "8%",
          width: 180,
          height: "85%",
          background:
            "linear-gradient(180deg, rgba(255, 255, 255, 0.55) 0%, rgba(255, 255, 255, 0.18) 30%, rgba(255, 255, 255, 0) 70%)",
          transform: "skewX(-12deg)",
          transformOrigin: "top right",
          mixBlendMode: "screen",
          pointerEvents: "none",
          filter: "blur(2px)",
          opacity: 0,
          transition: "opacity 60ms linear",
          zIndex: 1,
        }}
      />
    </>
  );
}
