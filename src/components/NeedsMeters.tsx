/**
 * NeedsMeters — three companion stat bars (social / creativity / energy).
 *
 * UI-v1 game-feel rebuild: gradient liquid fills (matches EnergyOrb +
 * XpRibbon language), chunky candy track, glow halos on the label icons,
 * tabular-nums readout. Used inside Crib.tsx and the Pet portal page,
 * plus StackingView's collapsible "companion state" footer.
 */

import type { Need, Tamagotchi } from "../data/types";

interface Props {
  tam: Tamagotchi;
  /** Compact mode shrinks padding/icons for inline footer use. */
  compact?: boolean;
}

interface NeedMeta {
  label:    string;
  icon:     string;
  /** CSS gradient string for the bar fill — matches GRVD palette tokens. */
  fill:     string;
  /** Glow halo color around the icon when need is high. */
  glow:     string;
}

const META: Record<Need, NeedMeta> = {
  social: {
    label: "Social",
    icon:  "💬",
    fill:  "linear-gradient(90deg, #ff4d9c 0%, #fb923c 100%)",
    glow:  "rgba(255,77,156,0.55)",
  },
  creativity: {
    label: "Creativity",
    icon:  "🎨",
    fill:  "linear-gradient(90deg, #a78bfa 0%, #fbbf24 100%)",
    glow:  "rgba(167,139,250,0.55)",
  },
  energy: {
    label: "Energy",
    icon:  "⚡",
    fill:  "linear-gradient(90deg, #22d3ee 0%, #4ade80 100%)",
    glow:  "rgba(34,211,238,0.55)",
  },
};

export function NeedsMeters({ tam, compact }: Props) {
  const keys: Need[] = ["social", "creativity", "energy"];

  return (
    <div className={`flex flex-col gap-2 ${compact ? "" : "w-full"}`}>
      {keys.map((k) => {
        const v = tam.needs[k];
        const { label, icon, fill, glow } = META[k];
        const showGlow = v >= 60;
        return (
          <div
            key={k}
            className={[
              "flex items-center gap-2.5",
              compact ? "px-2 py-1" : "px-3 py-2",
              "rounded-2xl bg-white/3 border border-white/8",
              "shadow-chunky-press",
            ].join(" ")}
          >
            {/* Icon disc */}
            <span
              className={[
                "shrink-0 inline-flex items-center justify-center",
                "rounded-full",
                compact ? "w-6 h-6 text-sm" : "w-8 h-8 text-base",
                "bg-grvd-base border border-white/10",
                "transition-shadow duration-300",
              ].join(" ")}
              style={{
                boxShadow: showGlow
                  ? `0 0 12px ${glow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                  : "inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              {icon}
            </span>

            {/* Label */}
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/65 shrink-0 whitespace-nowrap w-[78px]">
              {label}
            </span>

            {/* Fill bar */}
            <div className="flex-1 h-2.5 bg-grvd-base/60 rounded-full overflow-hidden border border-white/8 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${v}%`,
                  background: fill,
                  boxShadow: showGlow ? `0 0 8px ${glow}` : "none",
                }}
              />
            </div>

            {/* Value readout */}
            <span className="font-display text-sm text-white tabular-nums w-[28px] text-right shrink-0">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}
