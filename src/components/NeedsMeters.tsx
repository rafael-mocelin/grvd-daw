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
  /** Drops the per-pill dark background — for use when the parent
   *  already provides a banner background (Home top strip). Compact only. */
  bare?: boolean;
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

export function NeedsMeters({ tam, compact, bare }: Props) {
  const keys: Need[] = ["social", "creativity", "energy"];

  // Compact mode → 3 mini horizontal bars on one row, each one a chunky
  // dark pill containing [icon · small fat fill bar]. Each pill ~60-70px
  // wide. Used in the Home top strip next to the pet so the row is short.
  //
  // Full mode → tall stacked rows with labels + numeric values; used in
  // Crib + Pet portal where the readout is the focus.
  if (compact) {
    return (
      <div className="flex items-center gap-1.5 w-full">
        {keys.map((k) => {
          const v = tam.needs[k];
          const { label, icon, fill, glow } = META[k];
          const showGlow = v >= 60;
          return (
            <div
              key={k}
              aria-label={`${label} ${v}/100`}
              style={{
                flex: "1 1 0",
                minWidth: 0,
                height: 22,
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "0 4px 0 5px",
                borderRadius: 999,
                background: bare ? "transparent"     : "rgba(10,8,20,0.78)",
                border:     bare ? "none"            : "1.5px solid rgba(0,0,0,0.7)",
                boxShadow:  bare ? "none"            : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 1px rgba(0,0,0,0.5)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1,
                  filter: showGlow ? `drop-shadow(0 0 4px ${glow})` : "none",
                  flexShrink: 0,
                }}
              >
                {icon}
              </span>
              <span
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(0,0,0,0.6)",
                  overflow: "hidden",
                  boxShadow: "inset 0 1px 1px rgba(0,0,0,0.6)",
                }}
              >
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${v}%`,
                    background: fill,
                    boxShadow: showGlow ? `0 0 4px ${glow}, inset 0 1px 0 rgba(255,255,255,0.4)` : "inset 0 1px 0 rgba(255,255,255,0.4)",
                    transition: "width 500ms ease",
                  }}
                />
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      {keys.map((k) => {
        const v = tam.needs[k];
        const { label, icon, fill, glow } = META[k];
        const showGlow = v >= 60;
        return (
          <div
            key={k}
            className="flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-white/3 border border-white/8 shadow-chunky-press"
          >
            <span
              className="shrink-0 inline-flex items-center justify-center rounded-full w-8 h-8 text-base bg-grvd-base border border-white/10 transition-shadow duration-300"
              style={{
                boxShadow: showGlow
                  ? `0 0 12px ${glow}, inset 0 1px 0 rgba(255,255,255,0.15)`
                  : "inset 0 1px 0 rgba(255,255,255,0.10)",
              }}
            >
              {icon}
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/65 shrink-0 whitespace-nowrap w-[78px]">
              {label}
            </span>
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
            <span className="font-display text-sm text-white tabular-nums w-[28px] text-right shrink-0">
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}
