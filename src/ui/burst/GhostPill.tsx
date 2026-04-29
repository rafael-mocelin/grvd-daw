/**
 * GhostPill — BURST tertiary navigation pill.
 *
 * Subtle navy pill with a thin gold border, gold-cream text. Used
 * below the main CTA for low-priority links (crib, logbook).
 */

import type { ReactNode, ButtonHTMLAttributes } from "react";
import { C } from "./tokens";

interface GhostPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function GhostPill({ children, style, ...rest }: GhostPillProps) {
  return (
    <button
      {...rest}
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: `1.5px solid ${C.gold}66`,
        background: `${C.navyDeep}cc`,
        color: "#e8d8a0",
        fontFamily: "'Lilita One', system-ui",
        fontSize: 13, letterSpacing: 0.6,
        cursor: "pointer",
        boxShadow: "0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
