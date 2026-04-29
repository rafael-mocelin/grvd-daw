/**
 * Hud.tsx — UI v1 persistent top ribbon.
 *
 * Mobile-first HUD that lives at the top of every screen (replaces the
 * old ScreenTopBar from inside DeviceShell).
 *
 * Layout (left → right at mobile width 375-414px):
 *
 *   [AvatarPuck]   [EnergyOrb]   [XpRibbon]   [CoinSlot]
 *
 *   [    TalkBubble (drops below the puck when present)    ]
 *
 * The TalkBubble used to anchor immediately right of the puck, but at
 * mobile width that put it on top of the EnergyOrb. It now drops
 * BELOW the puck — pointer-up so it still feels like the companion is
 * speaking — leaving the HUD row clean for the orb / xp / coins.
 *
 * Safe-area padding for iPhone notches via env(safe-area-inset-top).
 */

import { AvatarPuck }            from "./AvatarPuck";
import { TalkBubble }             from "./TalkBubble";
import { EnergyOrb, XpRibbon, CoinSlot } from "./HudPieces";

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
      <div className="relative max-w-[480px] mx-auto">
        {/* Top row — fixed-height HUD: puck + currency-shape readouts. */}
        <div className="flex items-center gap-2">
          <AvatarPuck />
          <EnergyOrb />
          <XpRibbon />
          <CoinSlot />
        </div>

        {/* TalkBubble — drops below the puck (anchored to its left edge)
         *  so it stops colliding with the EnergyOrb at mobile widths. */}
        <div className="absolute left-2 top-[60px] z-20 pointer-events-none">
          <TalkBubble />
        </div>
      </div>
    </header>
  );
}
