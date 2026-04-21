/**
 * useSharedGaze — a single source of truth for WHERE the companion is
 * looking. Both Corner Eyes consume this so they converge on the same
 * viewport point (real eyes are focal — they don't aim at two
 * different targets, that looks crosseyed).
 *
 * Returns a ref whose .current is { x, y } in CSS pixels (viewport
 * coords). Tracks the cursor when the mouse is active; picks random
 * idle targets when the mouse is still.
 */

import { useEffect, useRef } from "react";

export interface GazeTarget {
  x: number;   // viewport px
  y: number;   // viewport px
  /** True when the target is the actual cursor (not an idle drift). */
  isCursor: boolean;
}

export function useSharedGaze() {
  const targetRef = useRef<GazeTarget>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    isCursor: false,
  });

  useEffect(() => {
    let mouseUntil = 0;
    let nextIdleAt = Date.now() + 2000;
    let raf = 0;

    const onMouseMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY, isCursor: true };
      mouseUntil = Date.now() + 2000;
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });

    const tick = () => {
      const now = Date.now();
      if (now > mouseUntil && now > nextIdleAt) {
        // Pick a new idle target somewhere on screen.
        // Bias slightly toward the middle-top so the eyes feel like they
        // glance around the app rather than into the walls.
        const w = window.innerWidth;
        const h = window.innerHeight;
        const x = w * (0.2 + Math.random() * 0.6);
        const y = h * (0.15 + Math.random() * 0.55);
        targetRef.current = { x, y, isCursor: false };
        nextIdleAt = now + 1500 + Math.random() * 2500;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return targetRef;
}
