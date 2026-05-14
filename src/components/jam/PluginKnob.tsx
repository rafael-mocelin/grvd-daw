/**
 * PluginKnob — a reusable circular control mimicking the chunky
 * vinyl-knob look used by boutique audio plugins (SoundToys' Decapitator
 * drive, FabFilter's bypass, etc.). Drag vertically to scrub the value;
 * the indicator line sweeps from -135° (full counter-clockwise = 0) to
 * +135° (full clockwise = 1).
 *
 * Visuals are pure SVG so each FX plugin popup can re-skin colours via
 * props without forking the component. Behaviour-wise the knob is a
 * pointer-capture drag (16 px = 1 % of range), with Shift held for
 * fine-grain scrub (×0.25).
 */

import { useRef, useState } from "react";

interface PluginKnobProps {
  /** Current value, 0..1. */
  value:    number;
  /** Called with the new value while dragging. */
  onChange: (next: number) => void;
  /** Visual diameter in px. */
  size?:    number;
  /** Indicator + sweep arc colour. Defaults to soft cyan. */
  accent?:  string;
  /** Knob body gradient — pair of colours (top, bottom). Defaults to a
   *  neutral dark grey. */
  body?:    [string, string];
  /** Optional label printed under the knob (e.g. "AMOUNT"). */
  label?:   string;
}

export function PluginKnob({
  value,
  onChange,
  size   = 120,
  accent = "#7df9ff",
  body   = ["#2a3142", "#0c1119"],
  label,
}: PluginKnobProps) {
  // Pointer state — startY/startVal are captured on pointerdown so we
  // can compute deltas without storing them in React state every move.
  const startRef = useRef<{ y: number; v: number; fine: boolean } | null>(null);
  const [hot, setHot] = useState(false);

  /** Map value (0..1) to sweep angle (-135°..+135°). */
  const angle = -135 + value * 270;
  const rad   = (angle * Math.PI) / 180;
  const cx    = size / 2;
  const cy    = size / 2;
  const r     = size * 0.38;
  // Indicator inner point so the line sits on the rim, not the centre.
  const innerR = r * 0.45;
  const ix1 = cx + innerR * Math.cos(rad - Math.PI / 2);
  const iy1 = cy + innerR * Math.sin(rad - Math.PI / 2);
  const ix2 = cx + r       * Math.cos(rad - Math.PI / 2);
  const iy2 = cy + r       * Math.sin(rad - Math.PI / 2);

  // Sweep arc path — from full-min to current angle. Used so the
  // unused track is dim and the used arc glows.
  const arcMinAng = -135;
  function polar(angDeg: number, rr: number) {
    const a = (angDeg * Math.PI) / 180;
    return {
      x: cx + rr * Math.cos(a - Math.PI / 2),
      y: cy + rr * Math.sin(a - Math.PI / 2),
    };
  }
  const arcR     = r + size * 0.08;
  const arcStart = polar(arcMinAng, arcR);
  const arcEnd   = polar(angle, arcR);
  const largeArc = angle - arcMinAng > 180 ? 1 : 0;
  const arcPath  = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`;
  // Full track (dim) — from min to max.
  const trackEnd     = polar(135, arcR);
  const trackPath    = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 1 1 ${trackEnd.x} ${trackEnd.y}`;

  // ── Drag handlers ──
  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    startRef.current = { y: e.clientY, v: value, fine: e.shiftKey };
    setHot(true);
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const s = startRef.current;
    if (!s) return;
    const dy   = s.y - e.clientY;            // up = positive
    const scale = (s.fine || e.shiftKey) ? 0.0025 : 0.01;
    const next = Math.max(0, Math.min(1, s.v + dy * scale));
    onChange(next);
  }
  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    (e.target as Element).releasePointerCapture(e.pointerId);
    startRef.current = null;
    setHot(false);
  }
  // Double-click resets to a neutral 50%. Plugin convention — same
  // behaviour as Alt-click on most boutique plugins.
  function onDoubleClick() {
    onChange(0.5);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        userSelect: "none",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        style={{
          cursor: hot ? "grabbing" : "grab",
          touchAction: "none",
          filter: hot ? `drop-shadow(0 0 14px ${accent}aa)` : `drop-shadow(0 4px 8px rgba(0,0,0,0.6))`,
          transition: "filter 0.18s",
        }}
      >
        <defs>
          <radialGradient id={`knob-body-${accent}`} cx="50%" cy="35%" r="65%">
            <stop offset="0%"  stopColor={body[0]} />
            <stop offset="100%" stopColor={body[1]} />
          </radialGradient>
          <linearGradient id={`knob-rim-${accent}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%"  stopColor="rgba(255,255,255,0.4)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.5)" />
          </linearGradient>
        </defs>

        {/* Dim full track */}
        <path
          d={trackPath}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={size * 0.045}
          strokeLinecap="round"
        />
        {/* Hot sweep up to current value */}
        <path
          d={arcPath}
          fill="none"
          stroke={accent}
          strokeWidth={size * 0.045}
          strokeLinecap="round"
          opacity={0.85}
          style={{ filter: hot ? `drop-shadow(0 0 6px ${accent})` : `drop-shadow(0 0 3px ${accent}88)` }}
        />

        {/* Knob rim (ring around body) */}
        <circle
          cx={cx}
          cy={cy}
          r={r + size * 0.028}
          fill={`url(#knob-rim-${accent})`}
          opacity={0.85}
        />
        {/* Knob body */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#knob-body-${accent})`}
          stroke="rgba(0,0,0,0.6)"
          strokeWidth={1.5}
        />
        {/* Subtle highlight smile on top */}
        <ellipse
          cx={cx}
          cy={cy - r * 0.45}
          rx={r * 0.55}
          ry={r * 0.18}
          fill="rgba(255,255,255,0.13)"
        />

        {/* Indicator line */}
        <line
          x1={ix1}
          y1={iy1}
          x2={ix2}
          y2={iy2}
          stroke={accent}
          strokeWidth={size * 0.05}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
        />
        {/* Indicator tip dot */}
        <circle cx={ix2} cy={iy2} r={size * 0.035} fill={accent} />
      </svg>

      {label && (
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.20em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
