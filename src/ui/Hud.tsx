/**
 * Hud.tsx — BURST single-row HUD.
 *
 * Single row, four pieces side by side at mobile widths:
 *
 *   [Level disc] [Currency strip] [Energy capsule] [XP ribbon]
 *
 * The energy capsule lives on the top row now (was previously its
 * own row beneath the others) — the player asked for a clear
 * always-visible energy bar, not a stacked second row.
 *
 * Sticky to the top of every screen via PageShell. The HUD's
 * computed height (`--hud-h`) is referenced by sticky strips on
 * other screens (StackingView, ArrangeView).
 */

import { LevelBadge, CurrencyStrip, EnergyCapsule, XpRibbon } from "./HudPieces";

export function Hud() {
  return (
    <header
      className="sticky top-0 z-30 w-full"
      style={{
        background:
          "linear-gradient(180deg, #0f1828 0%, #0f1828 60%, rgba(15,24,40,0) 100%)",
        paddingTop: "max(env(safe-area-inset-top), 12px)",
        paddingBottom: 12,
        paddingLeft: 14,
        paddingRight: 14,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingTop: 6,
        }}
      >
        <LevelBadge />
        <CurrencyStrip coins={0} gems={0} />
        <EnergyCapsule />
        <XpRibbon />
      </div>
    </header>
  );
}
