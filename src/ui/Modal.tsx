/**
 * Modal — UI v1 shared modal chrome.
 *
 * Replaces the per-modal hand-rolled overlay/panel that every modal in the
 * app was duplicating. Single source for:
 *   - the dim+blur backdrop (clicks outside dismiss unless `dismissable={false}`)
 *   - the chunky candy panel (rounded-3xl, multi-shadow, gradient-edge border)
 *   - the header strip (kicker + title + close pill)
 *   - sane mobile sizing & vertical scrolling for tall content
 *
 * Footer is a separate slot so consumers can decide whether to use one;
 * default placement gives it a subtle top divider so primary CTAs sit
 * in a stable spot.
 */

import { useEffect, type ReactNode } from "react";
import { ChunkyPill } from "./Chunky";

interface ModalProps {
  open:       boolean;
  onClose:    () => void;
  /** When false, backdrop click + Esc are disabled. Use during async submit. */
  dismissable?: boolean;
  /** Tiny uppercase eyebrow text above the title. */
  kicker?:    string;
  /** Big bold panel title. */
  title:      string;
  /** Optional subtitle / one-line description under the title. */
  subtitle?:  string;
  /** Body content — Modal handles padding + scrolling. */
  children:   ReactNode;
  /** Optional sticky footer row (action buttons, helper text, etc.). */
  footer?:    ReactNode;
  /** Color accent for the kicker text + side glow. Tailwind text-* class. */
  accentText?:   string;
  /** Tailwind shadow color class (e.g. "shadow-grvd-purple/20"). */
  accentShadow?: string;
  /** Max content width — defaults to 420px (matches old modals). */
  maxWidth?:  number;
}

export function Modal({
  open,
  onClose,
  dismissable = true,
  kicker,
  title,
  subtitle,
  children,
  footer,
  accentText   = "text-grvd-purple",
  accentShadow = "shadow-[0_0_40px_rgba(167,139,250,0.18)]",
  maxWidth     = 420,
}: ModalProps) {
  // Esc to close.
  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
      className={[
        "absolute inset-0 z-[70]",
        "flex items-start justify-center",
        "px-3 py-7",
        "bg-black/75 backdrop-blur-sm",
        "animate-bubble-in",
      ].join(" ")}
    >
      <div
        className={[
          "w-full flex flex-col",
          "max-h-[calc(100dvh-56px)]",
          "rounded-3xl",
          "bg-gradient-to-b from-[#1a1632]/98 to-[#0a0814]/98",
          "border border-white/10",
          "shadow-chunky",
          accentShadow,
          "overflow-hidden",
        ].join(" ")}
        style={{ maxWidth }}
      >
        {/* Header strip */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            {kicker && (
              <div
                className={[
                  "font-mono text-[9px] font-bold tracking-[0.22em] uppercase",
                  accentText,
                ].join(" ")}
              >
                {kicker}
              </div>
            )}
            <div className="font-display text-xl text-white leading-tight mt-1">
              {title}
            </div>
            {subtitle && (
              <div className="font-mono text-[10px] text-white/50 mt-1 leading-snug">
                {subtitle}
              </div>
            )}
          </div>
          <ChunkyPill
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={!dismissable}
            aria-label="close"
          >
            ✕
          </ChunkyPill>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-white/8 px-5 py-3 bg-black/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
