/**
 * StageSpot — per-character floor spotlight on the Crib stage.
 *
 * Replaces the previous global StagePulse "floor pulse + corner flash"
 * pattern for the band area. Each band slot owns its own spot — when
 * that slot's audio is hot, the spot under it brightens and pulses on
 * the kick. Quiet slots stay dim. Empty slots can render the spot at a
 * faded baseline so the player sees "there's a spot for someone here."
 *
 * Position is given as % coords on the Crib's contained-image overlay
 * (the Crib component scales children to image bounds). The spot's
 * own visual is a soft ellipse — flatter than a circle to fake the iso
 * floor projection.
 */

import { useEffect, useRef } from "react";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";

interface StageSpotProps {
  pos:    { x: number; y: number };
  active: boolean;
  /** "small" (default, band slots) or "large" (player). */
  size?:  "small" | "large";
  /** CSS color — defaults to the brand coral. */
  accent?: string;
}

export function StageSpot({
  pos,
  active,
  size = "small",
  accent = "#E94560",
}: StageSpotProps) {
  const audioFrame = useJamAudioFrame();
  const ref = useRef<HTMLDivElement>(null!);

  // Imperative rAF write — same pattern as the existing reactive layers.
  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const node = ref.current;
      if (node) {
        const { overall, kick } = audioFrame.current;
        const k = active ? kick    : 0;
        const o = active ? overall : 0;
        // Baseline opacity 0.18 (faint) → up to 0.95 on a punching kick.
        const alpha = 0.18 + k * 0.55 + o * 0.22;
        // Subtle scale pulse on the kick.
        const scale = 1 + k * 0.18;
        node.style.opacity   = Math.min(1, alpha).toFixed(3);
        node.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, active]);

  const w = size === "large" ? 220 : 160;
  const h = size === "large" ? 70  : 48;

  return (
    <div
      style={{
        position: "absolute",
        // Anchor the spot's CENTER at the slot's floor coordinate, not
        // its feet — the character's feet stand on top of the spot.
        left: `${pos.x}%`,
        top:  `${pos.y}%`,
        width:  w,
        height: h,
        marginLeft: -w / 2,
        marginTop:  -h / 2,
        zIndex: 2,    // behind characters, above backdrop
        pointerEvents: "none",
      }}
    >
      <div
        ref={ref}
        style={{
          position: "absolute",
          left: "50%",
          top:  "50%",
          width:  "100%",
          height: "100%",
          borderRadius: "50%",
          // Soft radial; alpha is driven by the rAF loop above so we
          // start the gradient strong here and let the inline opacity
          // throttle it at runtime.
          background: `radial-gradient(ellipse at 50% 50%, ${accent}cc 0%, ${accent}55 40%, transparent 75%)`,
          filter: "blur(10px)",
          mixBlendMode: "screen",
          opacity: 0.18,
          // Initial transform — overwritten by the rAF loop on first
          // frame; declared so the layout doesn't jump.
          transform: "translate(-50%, -50%)",
          transition: "opacity 80ms linear",
        }}
      />
    </div>
  );
}
