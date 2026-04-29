/**
 * PageShell — UI v1 page wrapper.
 *
 * Replaces DeviceShell as the framing component. Drops the tamagotchi
 * device chrome (rounded frame, eyes-in-corners, mouth waveform at
 * bottom) and instead:
 *
 *   - Mounts the persistent <Hud> at the top of every screen
 *   - Fills the full viewport with the deep purple-black base + a
 *     subtle radial purple glow at top
 *   - Centers content into a mobile-first reading column
 *   - Pads bottom for iPhone home-indicator safe area
 *
 * The pet's "alive" elements (eyes, mouth, talk bubble) survive — they
 * just live INSIDE the AvatarPuck inside the HUD now, instead of
 * decorating the device chrome.
 */

import type { ReactNode } from "react";
import { Hud } from "./Hud";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-[100dvh] w-full bg-grvd-base text-white font-sans relative"
      // Single source of truth for HUD height — screens that want sticky
      // sub-headers (e.g. StackingView's recipe progress strip,
      // ArrangeView's transport bar) reference `var(--hud-h)` via inline
      // style. The BURST HUD is now a single row of four pieces, so this
      // came back down to ~80px (was 116px during the 2-row layout).
      style={{ ["--hud-h" as string]: "80px" }}
    >
      {/* Soft radial glow at the top — gives the dark base some life
       *  without committing to a backdrop illustration. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-page-glow"
      />

      <Hud />


      <main
        className={[
          "relative z-10",
          "px-3",
          "pb-[max(env(safe-area-inset-bottom),24px)]",
          // Mobile-first reading column. Caps at 480px so iPad / wide
          // phones don't stretch the content edge-to-edge. Override per
          // screen if needed.
          "max-w-[480px] mx-auto",
        ].join(" ")}
      >
        {children}
      </main>
    </div>
  );
}
