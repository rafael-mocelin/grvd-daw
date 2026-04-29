/**
 * Hud.tsx — BURST hero-design HUD.
 *
 * Two-row layout from the Claude Design handoff:
 *
 *   ┌─────────────────────────────────┐
 *   │  ┌──────┐ ┌────────┐ ┌───────┐  │
 *   │  │  LV  │ │ coin/  │ │  XP   │  │
 *   │  │ disc │ │ gem    │ │ ribbon│  │
 *   │  │      │ ├────────┴─────────┤  │
 *   │  └──────┘ │  energy capsule   │  │
 *   │           └───────────────────┘  │
 *   └─────────────────────────────────┘
 *
 * The LevelBadge spans both rows on the left; the right column has
 * [CurrencyStrip + XpRibbon] on top and the EnergyCapsule below.
 *
 * Sticky to the top of every screen via PageShell. The HUD's
 * computed height (`--hud-h`) is used by sticky strips on other
 * screens (StackingView, ArrangeView).
 */

import { LevelBadge, CurrencyStrip, EnergyCapsule, XpRibbon } from "./HudPieces";

export function Hud() {
  return (
    <header
      className="sticky top-0 z-30 w-full"
      style={{
        // Background fades from BURST navy at the top to transparent at the
        // bottom so the page content shows through cleanly.
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
          maxWidth: 480, margin: "0 auto",
          display: "flex", alignItems: "center", gap: 8,
          paddingTop: 6,
        }}
      >
        <LevelBadge />
        <div
          style={{
            display: "flex", flexDirection: "column", gap: 6,
            flex: 1, minWidth: 0,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CurrencyStrip coins={0} gems={0} />
            <XpRibbon />
          </div>
          <EnergyCapsule />
        </div>
      </div>
    </header>
  );
}
