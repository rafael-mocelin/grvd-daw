/**
 * Hud.tsx — UI v1 persistent top ribbon.
 *
 * Mobile-first HUD that lives at the top of every screen (replaces the
 * old ScreenTopBar from inside DeviceShell).
 *
 * Layout (left → right at mobile width 375-414px):
 *
 *   [AvatarPuck + TalkBubble]   [EnergyOrb]   [XpRibbon]   [CoinSlot]
 *
 * The TalkBubble is positioned to the right of the puck and floats over
 * the orb when present (it's purely decorative for the companion line).
 * Energy orb gets the most growth room (flex-grow) since the value
 * matters most.
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
      <div className="flex items-center gap-2 max-w-[480px] mx-auto">
        {/* Left cluster — puck + companion bubble.
         *  The puck is a fixed-size button; the bubble floats next to it. */}
        <div className="relative flex items-center shrink-0">
          <AvatarPuck />
          <div className="absolute left-[64px] top-1 z-10">
            <TalkBubble />
          </div>
        </div>

        {/* Center — energy (gets flex-grow to absorb extra width) */}
        <EnergyOrb />

        {/* Right — XP + coins */}
        <XpRibbon />
        <CoinSlot />
      </div>
    </header>
  );
}
