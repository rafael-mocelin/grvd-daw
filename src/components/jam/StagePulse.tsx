/**
 * StagePulse — non-interactive overlay that makes the Jam stage feel
 * alive even when the player isn't doing anything.
 *
 * Reads the shared FFT band frame (useJamAudioFrame) and writes inline
 * styles to four layers:
 *
 *   1. Floor pulse  — radial coral/gold glow under the cast that scales
 *                     + brightens on every kick hit.
 *   2. Hat flashes  — two back-corner spotlights that flicker on hi-hat
 *                     band energy. Snappy attack, quick decay.
 *   3. Ambient hum  — soft full-stage tint that grows with overall
 *                     loudness AND with the number of filled slots.
 *                     0 slots = dim stage, 3 = full lights.
 *   4. Crowd row    — silhouettes of audience heads + raised arms at the
 *                     bottom of the stage, appearing only when the mix
 *                     has 3+ filled slots. Bob on the kick.
 *
 * Pure visuals — does not affect audio routing, click handling, or layout.
 */

import { useEffect, useMemo, useRef } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface StagePulseProps {
  /** When false (master pause / nothing assigned) the pulse decays to
   *  zero — the stage holds its breath. */
  active: boolean;
  /** Number of slots currently holding a sound (0..N). Drives the baseline
   *  brightness of the stage and whether the crowd appears. */
  assignedCount: number;
}

export function StagePulse({ active, assignedCount }: StagePulseProps) {
  const audioFrame = useJamAudioFrame();
  const floorRef   = useRef<HTMLDivElement>(null!);
  const flashLRef  = useRef<HTMLDivElement>(null!);
  const flashRRef  = useRef<HTMLDivElement>(null!);
  const ambientRef = useRef<HTMLDivElement>(null!);
  const crowdRef   = useRef<HTMLDivElement>(null!);

  // Baseline brightness scales with the number of filled slots.
  // 0 slots → 0.0  (stage is dim)
  // 1 slot  → 0.25 (one warm wash)
  // 2 slots → 0.55
  // 3+ slots → 0.85 (full)
  const fillWeight = Math.min(1, assignedCount / 3);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const { overall, kick, hat } = audioFrame.current;

      const o = active ? overall : 0;
      const k = active ? kick    : 0;
      const h = active ? hat     : 0;

      // Floor pulse — scale 1.0 → 1.25 on the kick, opacity blends a
      // baseline-from-fillWeight with kick-driven punch.
      if (floorRef.current) {
        const scale = 1 + k * 0.25;
        const alpha = 0.15 + fillWeight * 0.30 + k * 0.55;
        floorRef.current.style.transform = `translateX(-50%) scale(${scale.toFixed(3)})`;
        floorRef.current.style.opacity   = Math.min(1, alpha).toFixed(3);
      }

      // Hat flashes — opacity gated to hat energy. Two corners flicker
      // independently (perceived stereo) and brighten as the mix grows.
      const flashAlpha = Math.min(1, h * 1.4 + fillWeight * 0.18);
      if (flashLRef.current) flashLRef.current.style.opacity = flashAlpha.toFixed(3);
      if (flashRRef.current) flashRRef.current.style.opacity = flashAlpha.toFixed(3);

      // Ambient stage tint — opacity blend of fillWeight (always-on
      // baseline) and overall-loudness punch.
      if (ambientRef.current) {
        const tintAlpha = Math.min(0.4, fillWeight * 0.22 + o * 0.3);
        ambientRef.current.style.opacity = tintAlpha.toFixed(3);
      }

      // Crowd bob — translate up on the kick.
      if (crowdRef.current) {
        const dy = -k * 6;
        crowdRef.current.style.transform = `translateY(${dy.toFixed(2)}px)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, active, fillWeight]);

  return (
    <>
      {/* Ambient stage tint — full-bleed warm wash. */}
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

      {/* Floor pulse — radial glow under the cast. */}
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

      {/* Spotlight cones — back-left and back-right. */}
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

      {/* Dust motes — slow drifting particles through the spotlight beams.
       *  Always on (very subtle) so the room feels lived-in even at rest. */}
      <DustMotes />

      {/* Crowd row — appears once 3+ slots are filled. Bobs on the kick. */}
      {assignedCount >= 3 && (
        <CrowdRow crowdRef={crowdRef} />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* DustMotes — tiny CSS particles drifting upward through the spotlight       */
/* beams. Pure decoration; no audio reactivity. Pre-randomized once per mount.*/
/* -------------------------------------------------------------------------- */

function DustMotes() {
  const motes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x:        Math.random() * 100,
        size:     1.5 + Math.random() * 2.0,
        duration: 6 + Math.random() * 8,
        delay:    Math.random() * 8,
        drift:    (Math.random() - 0.5) * 80,
        opacity:  0.18 + Math.random() * 0.18,
        startY:   80 + Math.random() * 20,
        key:      i,
      })),
    [],
  );
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 2,
      }}
    >
      {motes.map((m) => (
        <div
          key={m.key}
          style={{
            position: "absolute",
            left: `${m.x}%`,
            top: `${m.startY}%`,
            width: m.size,
            height: m.size,
            borderRadius: "50%",
            background: "rgba(255, 240, 220, 0.9)",
            filter: "blur(0.6px)",
            opacity: m.opacity,
            animation: `stagePulseDust ${m.duration}s linear infinite`,
            animationDelay: `${m.delay}s`,
            ["--drift" as string]: `${m.drift}px`,
          } as React.CSSProperties}
        />
      ))}
      <style>{`
        @keyframes stagePulseDust {
          0%   { transform: translate(0, 0)                 scale(0.8); opacity: 0; }
          12%  { opacity: var(--mote-op, 0.3); }
          100% { transform: translate(var(--drift, 0), -360px) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CrowdRow — silhouettes of an audience at the bottom of the stage.          */
/* Heads + raised hands, fully black on a transparent layer so they read as   */
/* a backlit crowd. Width-of-stage row; staggered heights for variation.      */
/* -------------------------------------------------------------------------- */

interface CrowdRowProps {
  crowdRef: React.RefObject<HTMLDivElement>;
}

function CrowdRow({ crowdRef }: CrowdRowProps) {
  // Pre-randomized per-mount but stable across renders so the audience
  // doesn't reshuffle every frame.
  const audience = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => ({
      // Uniform-ish horizontal spacing with small jitter
      x:      (i / 17) * 100 + (Math.random() - 0.5) * 1.8,
      // Slight height jitter so the silhouette line isn't perfectly flat
      h:      28 + Math.random() * 12,
      // Per-person animation delay so arms don't all wave in unison
      delay:  (i % 4) * 0.18,
      armUp:  Math.random() < 0.55,
    }));
  }, []);

  return (
    <div
      ref={crowdRef}
      style={{
        position: "absolute",
        left: 0, right: 0, bottom: -4,
        height: 56,
        zIndex: 3,
        pointerEvents: "none",
        animation: "stagePulseCrowdIn 0.6s ease-out both",
      }}
    >
      {audience.map((p, i) => (
        <CrowdMember
          key={i}
          x={p.x}
          h={p.h}
          delay={p.delay}
          armUp={p.armUp}
        />
      ))}
      <style>{`
        @keyframes stagePulseCrowdIn {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0);    }
        }
        @keyframes stagePulseCrowdSway {
          0%, 100% { transform: translate(-50%, 0) rotate(-2deg); }
          50%      { transform: translate(-50%, -3px) rotate(2deg); }
        }
        @keyframes stagePulseArmRaise {
          0%, 100% { transform: translate(-50%, 0); }
          50%      { transform: translate(-50%, -4px); }
        }
      `}</style>
    </div>
  );
}

interface CrowdMemberProps {
  x:     number; // % horizontal position
  h:     number; // height in px
  delay: number; // animation delay (s)
  armUp: boolean; // whether to render a raised hand
}

function CrowdMember({ x, h, delay, armUp }: CrowdMemberProps) {
  const headSize = h * 0.45;
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        bottom: 0,
        width: 0,
        height: h,
        // Slight lateral sway
        animation: `stagePulseCrowdSway ${1.4 + (delay * 0.5)}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* shoulders / body */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: "50%",
        marginLeft: -h * 0.4,
        width: h * 0.8,
        height: h * 0.6,
        background: "rgba(0,0,0,0.85)",
        borderRadius: `${h * 0.4}px ${h * 0.4}px 0 0`,
      }} />
      {/* head */}
      <div style={{
        position: "absolute",
        bottom: h * 0.5,
        left: "50%",
        marginLeft: -headSize / 2,
        width: headSize,
        height: headSize,
        background: "rgba(0,0,0,0.92)",
        borderRadius: "50%",
      }} />
      {/* raised hand (some) */}
      {armUp && (
        <div
          style={{
            position: "absolute",
            bottom: h - 6,
            left: "50%",
            marginLeft: -3,
            width: 6,
            height: 22,
            background: "rgba(0,0,0,0.8)",
            borderRadius: 4,
            transform: "translate(-50%, 0)",
            animation: "stagePulseArmRaise 0.7s ease-in-out infinite",
            animationDelay: `${delay * 0.7}s`,
          }}
        />
      )}
    </div>
  );
}
