/**
 * useJamAudioFrame — a ref whose .current is a smoothed audio "frame" with
 * three energy values, sampled from the master output every animation
 * frame. Drives the Jam stage's audio-reactive visuals (character pupils,
 * floor pulse on kick, corner spotlights flashing on hat).
 *
 * Mirrors the imperative-ref pattern of useAudioLevel: components grab
 * the ref in their own requestAnimationFrame loop and write inline
 * styles directly, so audio frames never trigger React re-renders.
 *
 * Returns:
 *   {
 *     overall: 0..1   — broadband RMS-ish loudness (everything)
 *     kick:    0..1   — low-band energy (~20–250 Hz)
 *     hat:     0..1   — high-band energy (~5–12 kHz)
 *   }
 *
 * All three values are EMA-smoothed (fast attack, slow decay) so the
 * visuals "pump" naturally rather than flickering.
 */

import { useEffect, useRef } from "react";
import { getMasterFftAnalyser, isStarted } from "../audio/engine";

export interface JamAudioFrame {
  overall: number;
  kick:    number;
  hat:     number;
}

/**
 * Bin ranges. 256-bin FFT @ 44.1 kHz means each bin spans ~86 Hz.
 *   - bins 0..3   ≈ 0–344 Hz   → kick / sub-bass band
 *   - bins 60..127 ≈ 5.2–11 kHz → hi-hat / cymbal band
 * Tuned by ear; not surgical.
 */
const KICK_BIN_LO = 0;
const KICK_BIN_HI = 4;   // exclusive
const HAT_BIN_LO  = 60;
const HAT_BIN_HI  = 128; // exclusive

/** Convert a –Infinity..0 dB value to 0..1 with a noise floor at –60 dB. */
function dbToLinear(db: number): number {
  if (!isFinite(db)) return 0;
  // Map [-60, 0] → [0, 1]
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

/**
 * Average a slice of an FFT bin array (in dB) into a 0..1 linear value.
 * Empty / silent bins return –Infinity, so we guard.
 */
function avgBand(data: Float32Array, lo: number, hi: number): number {
  let sum   = 0;
  let count = 0;
  for (let i = lo; i < hi && i < data.length; i++) {
    const v = data[i];
    if (isFinite(v)) {
      sum += dbToLinear(v);
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

/**
 * EMA smoothing with asymmetric attack/decay. Attacks quickly so visual
 * impacts feel sharp on a kick hit; decays slowly so the visuals don't
 * flicker between hits.
 */
function smoothEma(prev: number, target: number, attack = 0.55, decay = 0.18): number {
  const alpha = target > prev ? attack : decay;
  return prev * (1 - alpha) + target * alpha;
}

export function useJamAudioFrame() {
  const frameRef = useRef<JamAudioFrame>({ overall: 0, kick: 0, hat: 0 });

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      if (isStarted()) {
        try {
          const analyser = getMasterFftAnalyser();
          const data = analyser.getValue();
          if (data instanceof Float32Array) {
            // Per-band averages (already 0..1).
            const kickRaw    = avgBand(data, KICK_BIN_LO, KICK_BIN_HI);
            const hatRaw     = avgBand(data, HAT_BIN_LO,  HAT_BIN_HI);
            // Overall = average across the whole audible range, but
            // weighted toward the bottom half because that's where most
            // pop / hip-hop energy lives.
            const overallRaw = avgBand(data, 0, Math.min(96, data.length));

            // Punch up the contrast — the linear values cluster around
            // 0.3–0.6 even at full mix, which makes "pulse" visuals look
            // sleepy. Pre-multiply, then clamp.
            const prev = frameRef.current;
            const next: JamAudioFrame = {
              overall: smoothEma(prev.overall, Math.min(1, overallRaw * 1.6)),
              kick:    smoothEma(prev.kick,    Math.min(1, kickRaw    * 1.9)),
              hat:     smoothEma(prev.hat,     Math.min(1, hatRaw     * 2.4)),
            };
            frameRef.current = next;
          }
        } catch {
          /* analyser not ready yet — keep current values */
        }
      } else {
        // No audio context yet — slow decay toward zero.
        const prev = frameRef.current;
        frameRef.current = {
          overall: prev.overall * 0.9,
          kick:    prev.kick    * 0.9,
          hat:     prev.hat     * 0.9,
        };
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, []);

  return frameRef;
}
