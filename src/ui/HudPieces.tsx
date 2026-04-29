/**
 * HudPieces.tsx — UI v1 hero-mockup HUD readouts.
 *
 * The four shapes that live in the persistent top ribbon:
 *
 *   <LevelDisc>  — gold-ringed circular level badge with a headphones
 *                   glyph and "LEVEL N" caption hanging below. Replaces
 *                   the AvatarPuck as the HUD anchor; tap still routes
 *                   to the pet portal.
 *   <EnergyOrb>  — chunky purple capsule. Lightning bolt in a gradient
 *                   disc on the left, "N/100" readout, magenta→purple
 *                   liquid fill from left.
 *   <XpRibbon>   — gold ribbon banner with "XP" badge on the left,
 *                   "N XP" body text. Two little ribbon tails on the
 *                   bottom corners give it the trophy-banner shape.
 *   <CoinSlot>   — gold disc with a crown glyph + count. Placeholder
 *                   for the future currency; rendered always so the
 *                   HUD frame is locked from day 1.
 *
 * Mobile-first: tuned to fit at 375-414px viewport widths. The HUD
 * sticks to the top of every screen via PageShell.
 */

import { useEffect, useState } from "react";
import {
  useStore,
  ENERGY_MAX,
  computeLiveEnergy,
} from "../store/useStore";

/* -------------------------------------------------------------------------- */
/* LevelDisc                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Big gold-ringed level disc. The icon is a generic music symbol (head-
 * phones) rather than a mood face — saves space and keeps the HUD anchor
 * stable visually as mood swings. Tap routes to the pet portal where
 * the live mascot lives.
 */
export function LevelDisc({ size = 56 }: { size?: number }) {
  const level    = useStore((s) => s.level);
  const setStage = useStore((s) => s.setStage);

  return (
    <button
      onClick={() => setStage("pet")}
      aria-label={`level ${level} · open pet`}
      className="relative shrink-0 select-none animate-puck-bob"
      style={{ width: size, height: size + 10 /* room for caption */ }}
    >
      {/* Gold ring */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 rounded-full bg-level-ring shadow-glow-gold"
        style={{ height: size }}
      />
      {/* Inner purple disc with headphones */}
      <span
        aria-hidden
        className={[
          "absolute inset-x-[3px] top-[3px] rounded-full",
          "bg-gradient-to-br from-grvd-purple to-[#5b3aa5]",
          "shadow-chunky-press",
          "flex items-center justify-center text-white",
        ].join(" ")}
        style={{ height: size - 6, fontSize: size * 0.5 }}
      >
        🎧
      </span>
      {/* "LEVEL N" caption hugging the bottom of the disc */}
      <span
        aria-hidden
        className={[
          "absolute left-1/2 -translate-x-1/2",
          "px-1.5 py-[1px] rounded-full",
          "bg-grvd-gold text-grvd-base",
          "font-display text-[8px] leading-none tracking-[0.18em]",
          "shadow-chunky-press whitespace-nowrap",
        ].join(" ")}
        style={{ top: size - 4 }}
      >
        L{level}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* EnergyOrb                                                                   */
/* -------------------------------------------------------------------------- */

export function EnergyOrb() {
  const baseEnergy      = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);

  // Re-render once a second so passive regen ticks visibly.
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
        "relative h-9 grow min-w-[110px]",
        "rounded-full bg-[#1c1635]",
        "border-2 border-grvd-purple/60",
        "shadow-chunky-press shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]",
        "flex items-center pl-9 pr-3",
      ].join(" ")}
      aria-label={`energy ${live}/${ENERGY_MAX}`}
    >
      {/* Lightning badge — gradient disc on the left edge, slightly
       * overshooting the capsule so it pops out chunky-style. */}
      <span
        aria-hidden
        className={[
          "absolute -left-1 top-1/2 -translate-y-1/2",
          "w-9 h-9 rounded-full",
          "bg-gradient-to-br from-grvd-magenta to-grvd-purple",
          "border-2 border-grvd-magenta/70",
          "shadow-chunky-press shadow-glow-magenta",
          "flex items-center justify-center",
        ].join(" ")}
      >
        <span className="text-grvd-gold text-base leading-none drop-shadow-[0_1px_0_rgba(0,0,0,0.6)]">
          ⚡
        </span>
      </span>

      {/* Liquid fill track inside the capsule */}
      <span
        aria-hidden
        className="absolute inset-y-1 left-9 right-1 rounded-full overflow-hidden bg-black/40"
      >
        <span
          className="block h-full bg-gradient-to-r from-grvd-magenta via-grvd-purple to-grvd-magenta shadow-glow-purple"
          style={{
            width: `${pct}%`,
            transition: "width 600ms ease",
            backgroundSize: "200% 100%",
          }}
        />
      </span>

      {/* N/MAX readout — sits over the fill */}
      <span
        className="relative z-10 ml-auto font-display text-white text-[13px] leading-none tabular-nums whitespace-nowrap"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}
      >
        {live}<span className="opacity-70">/{ENERGY_MAX}</span>
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* XpRibbon                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Gold ribbon banner. Shape: rounded rectangle body with two small "tail"
 * triangles cut into the bottom corners (rendered as absolute squares
 * rotated 45° behind the body — the standard CSS ribbon trick).
 */
export function XpRibbon() {
  const totalXP = useStore((s) => s.totalXP);
  return (
    <div
      className="relative h-9 shrink-0"
      aria-label={`xp ${totalXP}`}
    >
      {/* Tails — purple darker squares behind the ribbon, peeking out the
       *  bottom corners. */}
      <span
        aria-hidden
        className="absolute left-1 -bottom-1.5 w-3 h-3 bg-[#a87b1a] rotate-45 shadow-chunky-press"
      />
      <span
        aria-hidden
        className="absolute right-1 -bottom-1.5 w-3 h-3 bg-[#a87b1a] rotate-45 shadow-chunky-press"
      />

      {/* Body */}
      <div
        className={[
          "relative h-full px-2.5 pl-9",
          "rounded-lg",
          "bg-gradient-to-b from-grvd-gold via-[#fcd34d] to-[#e0a90c]",
          "border-2 border-[#a87b1a]",
          "shadow-chunky-press",
          "flex items-center gap-1",
        ].join(" ")}
      >
        {/* "XP" rosette badge on the left edge */}
        <span
          aria-hidden
          className={[
            "absolute -left-1.5 top-1/2 -translate-y-1/2",
            "w-9 h-9 rounded-full",
            "bg-gradient-to-br from-grvd-magenta to-[#c2185b]",
            "border-2 border-[#fcd34d]",
            "shadow-chunky-press",
            "flex items-center justify-center",
          ].join(" ")}
        >
          <span
            className="font-display text-white text-[11px] tracking-tight leading-none"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.5)" }}
          >
            XP
          </span>
        </span>

        {/* Numeric readout */}
        <span
          className="font-display text-grvd-base text-[13px] leading-none tabular-nums whitespace-nowrap"
          style={{ textShadow: "0 1px 0 rgba(255,255,255,0.45)" }}
        >
          {totalXP}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CoinSlot                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Gold disc with a crown glyph + count, placeholder for the future
 * currency. Always visible so the HUD frame is locked from day 1.
 */
export function CoinSlot({ value = 0 }: { value?: number }) {
  return (
    <div
      className="relative h-9 shrink-0 flex items-center"
      aria-label={`coins ${value}`}
      title="coming soon"
    >
      {/* Coin disc */}
      <span
        aria-hidden
        className={[
          "w-9 h-9 rounded-full",
          "bg-gradient-to-br from-grvd-gold via-[#fcd34d] to-[#e0a90c]",
          "border-2 border-[#a87b1a]",
          "shadow-chunky-press shadow-glow-gold",
          "flex items-center justify-center",
        ].join(" ")}
      >
        <span className="text-grvd-base text-base leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]">
          👑
        </span>
      </span>
      {/* Count next to the coin */}
      <span
        className="ml-1.5 font-display text-grvd-gold text-[14px] leading-none tabular-nums"
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
      >
        {value}
      </span>
    </div>
  );
}
