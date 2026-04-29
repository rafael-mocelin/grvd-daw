/**
 * HudPieces.tsx — BURST hero-design HUD readouts.
 *
 * Faithful port of the four HUD components from the Claude Design
 * handoff. Each one composes the BURST chrome treatment (`chrome()`)
 * with custom layered geometry to read as a chunky physical object
 * — gold ring with embossed disc, chrome capsule with bumped-out
 * badge, ribbon banner with diamond tails, etc.
 *
 *   <LevelBadge>     gold ring + navy disc + LV pill (HUD anchor)
 *   <CurrencyStrip>  navy capsule with [coin · gem] split
 *   <EnergyCapsule>  navy pill with coral bolt badge + coral→gold fill
 *   <XpRibbon>       gold ribbon banner with diamond tails
 *
 * Live values come from the zustand store. EnergyCapsule re-renders
 * once a second so passive regen ticks visibly.
 */

import { useEffect, useState } from "react";
import {
  useStore,
  ENERGY_MAX,
  computeLiveEnergy,
} from "../store/useStore";
import { C, chrome, readout } from "./burst/tokens";
import { Gloss } from "./burst/Gloss";
import { Icon } from "./burst/Icon";

/* -------------------------------------------------------------------------- */
/* LevelBadge                                                                  */
/* -------------------------------------------------------------------------- */

export function LevelBadge() {
  const level    = useStore((s) => s.level);
  const setStage = useStore((s) => s.setStage);

  return (
    <button
      onClick={() => setStage("pet")}
      aria-label={`level ${level} · open pet`}
      className="block shrink-0 cursor-pointer"
      style={{
        position: "relative",
        width: 64,
        height: 64,
        // Add bottom space so the LV pill doesn't get clipped by the
        // parent's overflow / sibling layout.
        marginBottom: 8,
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      {/* Gold halo glow */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: -6, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,160,23,0.55) 0%, rgba(212,160,23,0) 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* Gold ring */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${C.goldLight}, ${C.gold} 60%, #7a5a08 100%)`,
          border: "2px solid #0a0f1c",
          boxShadow: "0 4px 0 rgba(0,0,0,0.5), 0 8px 18px rgba(0,0,0,0.55), inset 0 2px 0 rgba(255,255,255,0.6)",
        }}
      />
      {/* Navy disc with headphones */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 6, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${C.navyLight}, ${C.navyDeep})`,
          border: "2px solid #0a0f1c",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.2)",
        }}
      >
        <Icon.Headphones size={26} color="#cfd8ee" />
      </div>
      {/* LV pill */}
      <div
        aria-hidden
        style={{
          position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
          padding: "2px 10px", borderRadius: 10,
          background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
          border: "2px solid #0a0f1c",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 12, color: "#3a2906", letterSpacing: 0.5,
          boxShadow: "0 3px 0 rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.7)",
          textShadow: "0 1px 0 rgba(255,255,255,0.4)",
          whiteSpace: "nowrap",
        }}
      >
        LV {level}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* CurrencyStrip                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Navy capsule containing coin + gem readouts side by side.
 * Coins/gems are placeholder economy values for now — render a fixed
 * "0" until the currency system ships, but keep the slot occupied so
 * the HUD frame is visually locked from day 1.
 */
export function CurrencyStrip({ coins = 0, gems = 0 }: { coins?: number; gems?: number }) {
  return (
    <div
      style={{
        position: "relative",
        ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
        borderRadius: 14, height: 40,
        display: "flex", alignItems: "center", gap: 10,
        padding: "0 12px",
      }}
    >
      <Gloss radius={14} opacity={0.25} />
      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
        <Icon.Coin size={20} />
        <span style={{ ...readout(), fontSize: 16 }}>{coins}</span>
      </div>
      <div
        aria-hidden
        style={{
          width: 1.5, height: 22,
          background: "rgba(255,255,255,0.18)",
          borderLeft: "1px solid rgba(0,0,0,0.5)",
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
        <Icon.Gem size={18} />
        <span style={{ ...readout(), fontSize: 16 }}>{gems}</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EnergyCapsule                                                               */
/* -------------------------------------------------------------------------- */

export function EnergyCapsule() {
  const baseEnergy      = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);
  const setStage        = useStore((s) => s.setStage);

  // Re-render once a second so passive regen ticks visibly.
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const live = computeLiveEnergy(baseEnergy, energyUpdatedAt);
  const pct  = Math.max(0, Math.min(100, (live / ENERGY_MAX) * 100));

  return (
    <button
      onClick={() => setStage("pet")}
      style={{
        position: "relative",
        height: 40,
        // Capsule-style HUD piece: bolt icon + bar + "N/100" readout in
        // a single row. Sized like CurrencyStrip / XpRibbon so all four
        // HUD pieces sit on one row.
        ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
        borderRadius: 999,
        padding: "0 12px 0 8px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        flex: 1,
        minWidth: 100,
      }}
      aria-label={`energy ${live}/${ENERGY_MAX} — open pet to recharge`}
    >
      {/* Coral bolt badge — sits inline at the start of the capsule. */}
      <span
        aria-hidden
        style={{
          width: 28, height: 28, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, #ff7a8e, ${C.coral} 60%, ${C.coralDeep})`,
          border: "2px solid #0a0f1c",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(233,69,96,0.55), inset 0 1.5px 0 rgba(255,255,255,0.5)",
          flexShrink: 0,
        }}
      >
        <Icon.Bolt size={14} color="#fff" />
      </span>

      {/* Liquid bar — coral→gold gradient fill on a dark track. */}
      <span
        aria-hidden
        style={{
          flex: 1,
          height: 10,
          minWidth: 24,
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          border: "1.5px solid #0a0f1c",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(180deg, ${C.coral} 0%, ${C.gold} 100%)`,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
            transition: "width 600ms ease",
          }}
        />
      </span>

      {/* N/MAX readout */}
      <span
        style={{
          ...readout(),
          fontSize: 13,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {live}<span style={{ opacity: 0.65 }}>/{ENERGY_MAX}</span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* XpRibbon                                                                    */
/* -------------------------------------------------------------------------- */

export function XpRibbon() {
  const totalXP  = useStore((s) => s.totalXP);
  const setStage = useStore((s) => s.setStage);
  return (
    <button
      onClick={() => setStage("achievements")}
      style={{
        position: "relative",
        height: 40,
        display: "flex",
        alignItems: "center",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
      aria-label={`xp ${totalXP} — open achievements`}
    >
      {/* Tail left — diamond peeking from behind the ribbon body */}
      <div
        aria-hidden
        style={{
          width: 12, height: 24,
          transform: "rotate(45deg) translate(4px, 0)",
          background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
          border: "2px solid #0a0f1c",
          marginRight: -10,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      />
      {/* Body */}
      <div
        style={{
          position: "relative", height: 30, padding: "0 12px",
          background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
          border: "2px solid #0a0f1c",
          boxShadow: "0 4px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 16, color: "#3a2906", letterSpacing: 0.6,
            textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalXP} XP
        </span>
      </div>
      {/* Tail right */}
      <div
        aria-hidden
        style={{
          width: 12, height: 24,
          transform: "rotate(45deg) translate(-4px, 0)",
          background: `linear-gradient(180deg, ${C.gold}, #a07b0e)`,
          border: "2px solid #0a0f1c",
          marginLeft: -10,
        }}
      />
    </button>
  );
}

/* Legacy aliases — kept so existing imports don't break.
 * `LevelDisc` and `EnergyOrb` were the slice-C names; they now alias
 * the BURST hero-design components. `CoinSlot` is a thin shim that
 * uses the new CurrencyStrip for the coin half only. */
export const LevelDisc = LevelBadge;
export const EnergyOrb = EnergyCapsule;
export function CoinSlot({ value = 0 }: { value?: number }) {
  return <CurrencyStrip coins={value} gems={0} />;
}
