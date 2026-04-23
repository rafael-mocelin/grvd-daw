/**
 * EnergyMeter — the persistent publish-tier fuel bar.
 *
 * Shows live energy out of ENERGY_MAX, ticks up in real time at the regen
 * rate (1 unit per 5 minutes by default), and renders a tooltip showing the
 * time until a full refill.
 *
 * Positioned inside the device screen's top strip by DeviceShell so it's
 * visible on every stage. Clicking it is a no-op for Slice 1 but wired to
 * match the Admin panel pattern for future affordances.
 *
 * Visual note: energy uses a cool, slightly electric teal → blue gradient to
 * visually distinguish it from the companion-tiredness needs meter (which
 * lives on the StatsPanel via `tamagotchi.needs.energy`).
 */

import { useEffect, useState } from "react";
import { useStore, ENERGY_MAX, ENERGY_REGEN_MS, computeLiveEnergy } from "../store/useStore";

/** Refresh the computed live energy roughly every second so the bar animates. */
const TICK_MS = 1000;

/** Format milliseconds as "Xm Ys" or "Xh Ym". Keeps the tooltip compact. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return "full";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export function EnergyMeter() {
  const energy          = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);
  const [, setTick] = useState(0);

  // Re-render every second so the live value advances visibly
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const live = computeLiveEnergy(energy, energyUpdatedAt);
  const pct = Math.min(100, (live / ENERGY_MAX) * 100);

  // Seconds until the NEXT regen unit hits (i.e., when the live value
  // will next tick up). 0 when already at full.
  let msToNextUnit = 0;
  if (live < ENERGY_MAX) {
    const elapsedInInterval = (Date.now() - energyUpdatedAt) % ENERGY_REGEN_MS;
    msToNextUnit = ENERGY_REGEN_MS - elapsedInInterval;
  }
  const msToFull = live < ENERGY_MAX ? (ENERGY_MAX - live) * ENERGY_REGEN_MS : 0;

  const title =
    live >= ENERGY_MAX
      ? "Energy full"
      : `${live} / ${ENERGY_MAX} · next +1 in ${formatRemaining(msToNextUnit)} · full in ${formatRemaining(msToFull)}`;

  return (
    <div
      title={title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}>
      <span style={{
        fontFamily: "monospace",
        fontSize: 8,
        letterSpacing: 1.2,
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
      }}>⚡</span>
      <div style={{
        position: "relative",
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${pct}%`,
          background: "linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%)",
          borderRadius: 3,
          boxShadow: "0 0 6px rgba(59,130,246,0.45)",
          transition: "width 300ms ease",
        }} />
      </div>
      <span style={{
        fontFamily: "monospace",
        fontSize: 9,
        color: "rgba(255,255,255,0.8)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 34,
        textAlign: "right",
      }}>
        {live}/{ENERGY_MAX}
      </span>
    </div>
  );
}

/**
 * XPBar — level + progress-to-next-level indicator.
 * Sits next to EnergyMeter in the persistent screen header.
 */
export function XPBar() {
  const totalXP = useStore((s) => s.totalXP);
  const XP_PER_LEVEL = 300;
  const level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const progress = totalXP % XP_PER_LEVEL;
  const pct = (progress / XP_PER_LEVEL) * 100;

  return (
    <div
      title={`Level ${level} · ${progress} / ${XP_PER_LEVEL} XP to next`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flex: 1,
        minWidth: 0,
      }}>
      <span style={{
        fontFamily: "monospace",
        fontSize: 8,
        letterSpacing: 1.2,
        color: "rgba(255,255,255,0.55)",
        textTransform: "uppercase",
      }}>
        L{level}
      </span>
      <div style={{
        position: "relative",
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${pct}%`,
          background: "linear-gradient(90deg, #facc15 0%, #ff4d6d 100%)",
          borderRadius: 3,
          boxShadow: "0 0 6px rgba(255,77,109,0.45)",
          transition: "width 300ms ease",
        }} />
      </div>
      <span style={{
        fontFamily: "monospace",
        fontSize: 9,
        color: "rgba(255,255,255,0.8)",
        fontVariantNumeric: "tabular-nums",
        minWidth: 44,
        textAlign: "right",
      }}>
        {totalXP} XP
      </span>
    </div>
  );
}

/**
 * ScreenTopBar — the persistent horizontal strip that sits at the top of the
 * DAW screen (just inside the shell screen area). Hosts EnergyMeter + XPBar.
 * Lives above scroll content at a high z-index so it's visible on every stage.
 */
export function ScreenTopBar() {
  return (
    <div style={{
      position: "absolute",
      top: 6,
      left: 8,
      right: 8,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "4px 8px",
      background: "rgba(0,0,0,0.32)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 8,
      backdropFilter: "blur(6px)",
      zIndex: 5,
      pointerEvents: "none", // don't block child clicks in underlying UI
    }}>
      <EnergyMeter />
      <div style={{
        width: 1,
        height: 14,
        background: "rgba(255,255,255,0.08)",
        flexShrink: 0,
      }} />
      <XPBar />
    </div>
  );
}
