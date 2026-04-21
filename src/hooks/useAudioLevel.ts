/**
 * useAudioLevel — a ref whose .current is a smoothed 0..1 audio level
 * sampled from the master output every animation frame.
 *
 * Returns a ref (not state) because we want to drive imperative DOM
 * updates (transform, SVG attributes) at 60fps without tripping
 * React re-renders on every frame. Components that use this should
 * grab the ref in a requestAnimationFrame loop of their own and
 * write styles directly to a `useRef<SVGElement>`.
 *
 * Falls gracefully to zero when audio isn't started yet or is silent.
 */

import { useEffect, useRef } from "react";
import { getMasterAnalyser, isStarted } from "../audio/engine";

export function useAudioLevel() {
  const levelRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      if (isStarted()) {
        try {
          const analyser = getMasterAnalyser();
          const data = analyser.getValue();
          // Analyser returns Float32Array for "waveform" mode.
          if (data instanceof Float32Array) {
            // Compute RMS over the buffer.
            let sumSq = 0;
            for (let i = 0; i < data.length; i++) {
              sumSq += data[i] * data[i];
            }
            const rms = Math.sqrt(sumSq / data.length);
            // Amplify (rms is usually 0..0.3) then clamp.
            const amped = Math.min(1, rms * 3.5);
            // EMA smoothing — attacks quickly, decays slowly to feel lively.
            const prev = levelRef.current;
            const alpha = amped > prev ? 0.55 : 0.18;
            levelRef.current = prev * (1 - alpha) + amped * alpha;
          }
        } catch {
          /* analyser not ready yet — keep current value */
        }
      } else {
        // No audio context yet — slowly decay.
        levelRef.current *= 0.9;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return levelRef;
}
