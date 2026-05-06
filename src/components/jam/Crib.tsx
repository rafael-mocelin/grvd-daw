/**
 * Crib — the iso-rendered band room backdrop.
 *
 * Replaces the procedural <StudioScene> on the jam stage with a single
 * pre-rendered 1:1 PNG of the iso room. The image is contained (not
 * cropped) inside the stage area so the whole room is always visible;
 * dark bars fill any leftover space when the viewport aspect doesn't
 * match the image's 1:1.
 *
 * The component also exposes its own padded "floor box" — a Ref that
 * other UI (the band slots, mic stand, per-character spotlights) uses
 * to position themselves relative to the rendered image, so they stay
 * locked to the floor regardless of viewport size.
 *
 * Asset: public/crib/crib-bg.png — 2048x2048 PNG, RGBA.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface CribProps {
  /** Children render *inside* the contained image's bounds — pass an
   *  absolute-positioned overlay (band slots, mic) and we'll size that
   *  box to match the image so % positions track the room. */
  children?: React.ReactNode;
}

export function Crib({ children }: CribProps) {
  // Track the actual rendered size of the contained image so children
  // can lay out as % of the image (not as % of the stage area, which
  // includes the dark side bars).
  const containerRef = useRef<HTMLDivElement>(null!);
  const [imgBox, setImgBox] = useState<{ left: number; top: number; size: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      // Contain a 1:1 image inside an arbitrary rect: fit to the smaller
      // dimension; center on the larger.
      const size = Math.min(w, h);
      const left = (w - size) / 2;
      const top  = (h - size) / 2;
      setImgBox({ left, top, size });
    };
    measure();
    // ResizeObserver tracks viewport / parent changes.
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        // Same dark hue as the room render's outer black border so the
        // pillar bars on the sides blend with the image's own frame.
        background: "#0a0f1c",
        overflow: "hidden",
      }}
    >
      {/* The image itself — drawn as a CSS background on a sized div so
       *  it crisp-resamples and we keep aspect via our measured imgBox. */}
      {imgBox && (
        <div
          style={{
            position: "absolute",
            left:   imgBox.left,
            top:    imgBox.top,
            width:  imgBox.size,
            height: imgBox.size,
            backgroundImage: "url(/crib/crib-bg.png)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      )}

      {/* Floor-anchored overlay — children get a box that matches the
       *  image's rendered bounds. They use % coords inside this box so
       *  positions stay locked to the room art. */}
      {imgBox && (
        <div
          style={{
            position: "absolute",
            left:   imgBox.left,
            top:    imgBox.top,
            width:  imgBox.size,
            height: imgBox.size,
            pointerEvents: "none",
          }}
        >
          {/* Inner box re-enables pointer events so the slots inside are
           *  interactive again. The wrapper-then-inner pattern lets us
           *  selectively allow events on actual interactive children. */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
