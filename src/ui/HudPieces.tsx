/**
 * HudPieces.tsx — the three currency-shaped readouts that live in the
 * persistent top ribbon next to the AvatarPuck.
 *
 *   <EnergyOrb>  — energy bar with chunky liquid fill + lightning bolt
 *   <XpRibbon>   — XP pill with stars + tabular number
 *   <CoinSlot>   — placeholder slot for future currency. Always visible
 *                  so the HUD frame is locked from day 1; renders "0"
 *                  until economy ships.
 *
 * All three:
 *   - Pull live values from the zustand store
 *   - Recompute live energy via computeLiveEnergy so regen ticks visibly
 *   - Use chunky candy depth + glossy top highlight (boxShadow.chunky)
 *   - Designed for mobile-first widths (375-414px viewport)
 */

import { useEffect, useState } from "react";
import {
  useStore,
  ENERGY_MAX,
  computeLiveEnergy,
} from "../store/useStore";

/* -------------------------------------------------------------------------- */
/* EnergyOrb                                                                   */
/* -------------------------------------------------------------------------- */

export function EnergyOrb() {
  const baseEnergy      = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);

  // Re-render once a second so passive regen ticks visibly without us
  // computing the value imperatively. Cheap.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const live = computeLiveEnergy(baseEnergy, energyUpdatedAt);
  const pct  = Math.max(0, Math.min(100, (live / ENERGY_MAX) * 100));

  return (
    <div
      className={[
        // grow so the orb fills available space, but cap so it doesn't
        // overrun the row when xp/coins shrink. The HUD is only ever this
        // wide — the bar feeling "narrower" is intentional, leaves room
        // for the talk bubble that drops below the puck.
        "relative h-9 min-w-[80px] grow max-w-[180px]",
        "rounded-full bg-grvd-base/80",
        "border border-grvd-line",
        "shadow-chunky-press",
        "overflow-hidden",
        "flex items-center",
      ].join(" ")}
      aria-label={`energy ${live}/${ENERGY_MAX}`}
    >
      {/* Liquid fill */}
      <div
        className="absolute inset-y-0 left-0 bg-energy-orb shadow-glow-purple"
        style={{ width: `${pct}%`, transition: "width 600ms ease" }}
      />
      {/* Shimmer overlay sweeping across the fill */}
      <div
        className="absolute inset-y-0 left-0 pointer-events-none animate-shimmer"
        style={{
          width: `${pct}%`,
          backgroundImage:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.30) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
        }}
      />
      {/* Inline content */}
      <div className="relative z-10 flex items-center w-full px-2.5 gap-1.5">
        <span className="text-grvd-gold text-base leading-none">⚡</span>
        <span
          className="text-white font-display text-[14px] leading-none tabular-nums"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.65)" }}
        >
          {live}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* XpRibbon                                                                    */
/* -------------------------------------------------------------------------- */

export function XpRibbon() {
  const totalXP = useStore((s) => s.totalXP);
  return (
    <div
      className={[
        "relative h-9 min-w-[80px] px-3",
        "rounded-full bg-xp-ribbon",
        "shadow-chunky-press",
        "flex items-center justify-center gap-1.5",
      ].join(" ")}
      aria-label={`xp ${totalXP}`}
    >
      {/* Tiny sparkle accents — subtle */}
      <span className="absolute top-1 left-2 text-[8px] text-white/70">✦</span>
      <span className="absolute bottom-1 right-3 text-[7px] text-white/60">✦</span>

      <span
        className="font-display text-grvd-base text-[13px] leading-none tabular-nums"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.45)" }}
      >
        {totalXP}
      </span>
      <span className="font-display text-grvd-base/75 text-[10px] leading-none tracking-wider">
        XP
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CoinSlot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Placeholder for the future currency. Renders as a solid gold pill with
 * "0" so the HUD frame is locked from day 1 — the moment we ship coins
 * the value swaps in without a layout shift.
 */
export function CoinSlot({ value = 0 }: { value?: number }) {
  return (
    <div
      className={[
        "relative h-9 min-w-[58px] px-3",
        "rounded-full bg-grvd-gold",
        "shadow-chunky-press",
        "flex items-center justify-center gap-1.5",
        "opacity-90",
      ].join(" ")}
      aria-label={`coins ${value}`}
      title="coming soon"
    >
      <span className="text-grvd-base text-base leading-none">🪙</span>
      <span
        className="font-display text-grvd-base text-[13px] leading-none tabular-nums"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.45)" }}
      >
        {value}
      </span>
    </div>
  );
}
