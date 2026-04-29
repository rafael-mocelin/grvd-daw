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
import { CharacterFace } from "./CharacterFace";

/* -------------------------------------------------------------------------- */
/* HomeButton                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Round chunky chrome button with a 🏠 glyph. Sits next to LevelBadge
 * in the HUD as a quick "back to home" affordance from any screen.
 */
export function HomeButton() {
  const setStage = useStore((s) => s.setStage);
  return (
    <button
      onClick={() => setStage("home")}
      aria-label="back to home"
      className="block shrink-0 cursor-pointer"
      style={{
        position: "relative",
        width: 48,
        height: 48,
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${C.navyLight}, ${C.navyDeep} 70%, #0a0f1c)`,
          border: "2px solid #0a0f1c",
          boxShadow: "0 4px 0 rgba(0,0,0,0.5), 0 6px 14px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.18)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 22,
            lineHeight: 1,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
          }}
        >
          🏠
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* LevelBadge                                                                  */
/* -------------------------------------------------------------------------- */

export function LevelBadge() {
  const level       = useStore((s) => s.level);
  const setStage    = useStore((s) => s.setStage);
  const openProfile = useStore((s) => s.openProfile);
  const userId      = useStore((s) => s.userId);
  const player      = useStore((s) => s.player);

  function go() {
    // Tap the badge → open the player's own TastemakerProfile (drops,
    // fans, ratings, pushes, early-ear hits, following). When there's
    // no userId (guest), fall back to setStage("profile") which routes
    // through Profile.tsx's null-id branch.
    if (userId) openProfile(userId);
    else        setStage("profile");
  }

  return (
    <button
      onClick={go}
      aria-label={`level ${level} · open your profile`}
      className="block shrink-0 cursor-pointer"
      style={{
        position: "relative",
        width: 64,
        height: 64,
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
      {/* Inner disc — the player's profile picture (avatar emoji on a
       *  navy gradient). Tap to open their TastemakerProfile. The
       *  pet/mascot lives on the home stage now, not the HUD anchor. */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 4, borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #0a0f1c",
          background: `radial-gradient(circle at 35% 30%, ${C.navyLight}, ${C.navyDeep} 70%, #0a0f1c)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 30,
            lineHeight: 1,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
          }}
        >
          {player?.avatar || "🧢"}
        </span>
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
      {/* Clean gold pill — the rotated-diamond ribbon tails were causing
       *  visual artifacts at the corners (rotated squares poking out the
       *  back of the body). Dropped them; the pill alone reads cleaner. */}
      <div
        style={{
          position: "relative",
          height: 32,
          padding: "0 12px",
          borderRadius: 999,
          background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
          border: "2px solid #0a0f1c",
          boxShadow: "0 4px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(0,0,0,0.25)",
          display: "flex", alignItems: "center", gap: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 14,
            color: "#3a2906",
            letterSpacing: 0.5,
            textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {totalXP} XP
        </span>
      </div>
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
