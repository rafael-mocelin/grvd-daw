/**
 * Hud.tsx — UI v1 persistent top ribbon.
 *
 * Hero-mockup layout (left → right at mobile width 375-414px):
 *
 *   [LevelDisc]   [EnergyOrb capsule]   [XpRibbon]   [CoinSlot]
 *
 * The LevelDisc replaces the old AvatarPuck as the HUD anchor — same
 * tap target (opens the pet portal), but now reads as a passive level
 * badge so the active mascot can live big on the home stage instead.
 *
 * Talk bubble lives on whichever screen the mascot is currently on
 * (home stage, pet portal, etc.) — it's no longer attached to the HUD.
 *
 * Safe-area padding for iPhone notches via env(safe-area-inset-top).
 */

import { LevelDisc, EnergyOrb, XpRibbon, CoinSlot } from "./HudPieces";

export function Hud() {
  return (
    <header
      className={[
        "sticky top-0 z-30",
        "w-full",
        "bg-gradient-to-b from-grvd-base via-grvd-base to-transparent",
        "pt-[max(env(safe-area-inset-top),12px)]",
        "pb-3 px-3",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 max-w-[480px] mx-auto">
        <LevelDisc />
        <EnergyOrb />
        <XpRibbon />
        <CoinSlot />
      </div>
    </header>
  );
}
