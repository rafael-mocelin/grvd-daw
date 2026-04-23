/**
 * AchievementToast — lower-left corner achievement unlock popups.
 *
 * Urban streetwear / game-style notifications. Each toast:
 *   • Slides in from the left
 *   • Shows for 10 seconds
 *   • Fades out and removes itself
 *   • Multiple achievements stack upward
 *
 * Rendered via portal to document.body.
 * Each achievement also grants an Unreal Engine NPC reward (shown in the toast).
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import {
  getAchievement,
  TIER_COLOR,
  CATEGORY_COLOR,
} from "../data/achievements";

const TOAST_DURATION_MS = 10_000;
const TOAST_HEIGHT      = 88;   // px per card
const TOAST_GAP         = 10;   // px gap between cards
const TOAST_LEFT        = 16;   // px from left edge

/* -------------------------------------------------------------------------- */
/* Single toast card                                                            */
/* -------------------------------------------------------------------------- */

interface ToastCardProps {
  achievementId: string;
  index: number;         // 0 = bottom, 1 = above it, etc.
  onDone: () => void;
}

function ToastCard({ achievementId, index, onDone }: ToastCardProps) {
  const [phase, setPhase] = useState<"enter" | "visible" | "exit">("enter");
  const doneRef = useRef(false);

  const ach = getAchievement(achievementId);

  useEffect(() => {
    // Enter → visible
    const t1 = setTimeout(() => setPhase("visible"), 20);
    // visible → exit after duration
    const t2 = setTimeout(() => setPhase("exit"), TOAST_DURATION_MS - 400);
    // Clean up after exit animation
    const t3 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, TOAST_DURATION_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  /**
   * Tap-to-dismiss: skip straight to exit animation, then notify parent.
   * doneRef guard prevents double-firing if the auto-timer finishes at
   * roughly the same time as the click. Uses a short 200ms exit so the
   * toast feels responsive when the user explicitly dismisses it (vs
   * the natural 400ms auto-exit at the end of the timer).
   */
  function handleDismiss() {
    if (doneRef.current) return;
    setPhase("exit");
    setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, 200);
  }

  if (!ach) return null;

  const tierColor = TIER_COLOR[ach.tier];
  const catColor  = CATEGORY_COLOR[ach.category];
  const bottom    = TOAST_LEFT + index * (TOAST_HEIGHT + TOAST_GAP);

  const translateX = phase === "enter"
    ? "translateX(-120%)"
    : phase === "exit"
      ? "translateX(-120%)"
      : "translateX(0)";
  const opacity = phase === "visible" ? 1 : 0;

  return (
    <>
      <style>{`
        @keyframes toastShimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes tierPulse {
          0%, 100% { box-shadow: 0 0 0 0 ${tierColor}55; }
          50%       { box-shadow: 0 0 0 6px ${tierColor}00; }
        }
      `}</style>

      <div
        onClick={handleDismiss}
        role="button"
        aria-label={`Dismiss ${ach.name} achievement`}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleDismiss(); } }}
        style={{
          position: "fixed",
          left: TOAST_LEFT,
          bottom,
          width: 320,
          height: TOAST_HEIGHT,
          zIndex: 99990,
          transform: translateX,
          opacity,
          transition: "transform 0.45s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease, bottom 0.35s ease",
          // Clickable during enter AND visible phases so even a quick tap
          // during the slide-in dismisses the toast. Only "exit" disables
          // pointer events (toast is already on its way out).
          pointerEvents: phase === "exit" ? "none" : "auto",
          cursor: "pointer",
          // iOS: suppress the grey tap-highlight flash on the toast card
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {/* Card background */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(135deg, rgba(12,10,20,0.97) 0%, rgba(20,15,35,0.97) 100%)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderLeft: `3px solid ${tierColor}`,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
            animation: "tierPulse 2s ease-in-out 3",
          }}
        >
          {/* Shimmer bar across top */}
          <div
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0,
              height: 2,
              background: `linear-gradient(90deg, transparent 0%, ${tierColor} 40%, ${catColor} 60%, transparent 100%)`,
              backgroundSize: "200% 100%",
              animation: "toastShimmer 2s linear 2",
            }}
          />

          {/* Category corner badge */}
          <div
            style={{
              position: "absolute",
              top: 8, right: 10,
              fontFamily: "monospace",
              fontSize: 7,
              fontWeight: 900,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: catColor,
              opacity: 0.8,
            }}
          >
            {ach.category}
          </div>

          {/* Main content */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              height: "100%",
              boxSizing: "border-box",
            }}
          >
            {/* Icon circle */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: `radial-gradient(circle at 35% 35%, ${tierColor}33, rgba(0,0,0,0.6))`,
                border: `2px solid ${tierColor}66`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                flexShrink: 0,
                boxShadow: `0 0 12px ${tierColor}44`,
              }}
            >
              {ach.icon}
            </div>

            {/* Text block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* "Achievement Unlocked" label */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 7,
                  fontWeight: 900,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: tierColor,
                  marginBottom: 2,
                  textShadow: `0 0 8px ${tierColor}`,
                }}
              >
                ✦ achievement unlocked
              </div>

              {/* Name */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 14,
                  fontWeight: 900,
                  color: "#ffffff",
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ach.name}
              </div>

              {/* Description */}
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ach.description}
              </div>

              {/* NPC reward hint */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 5,
                }}
              >
                <span style={{ fontSize: 9 }}>🎁</span>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: 8,
                    color: "rgba(255,255,255,0.3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {ach.unrealReward.npcName} · {ach.unrealReward.itemName}
                </span>
              </div>
            </div>

            {/* XP badge */}
            <div
              style={{
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 13,
                  fontWeight: 900,
                  color: "#facc15",
                  textShadow: "0 0 10px #facc15, 0 0 20px #f59e0b",
                  lineHeight: 1,
                }}
              >
                +{ach.xpReward}
              </span>
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 7,
                  fontWeight: 700,
                  color: "rgba(250,204,21,0.5)",
                  letterSpacing: "0.1em",
                }}
              >
                XP
              </span>
            </div>
          </div>

          {/* Progress bar (counts down the 10 seconds) */}
          <ProgressBar
            durationMs={TOAST_DURATION_MS - 400}
            color={tierColor}
          />
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Timer bar                                                                    */
/* -------------------------------------------------------------------------- */

function ProgressBar({ durationMs, color }: { durationMs: number; color: string }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0, left: 0, right: 0,
        height: 2,
        background: "rgba(255,255,255,0.05)",
        borderRadius: "0 0 12px 12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: "100%",
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          animation: `toastTimerShrink ${durationMs}ms linear forwards`,
          transformOrigin: "left center",
        }}
      />
      <style>{`
        @keyframes toastTimerShrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Container                                                                    */
/* -------------------------------------------------------------------------- */

export function AchievementToast() {
  const { achievementToastQueue, popAchievementToast } = useStore();

  // Show up to 3 stacked toasts at once
  const visible = achievementToastQueue.slice(0, 3);

  if (!visible.length) return null;

  return createPortal(
    <>
      {visible.map((id, i) => (
        <ToastCard
          key={id}
          achievementId={id}
          index={i}
          onDone={popAchievementToast}
        />
      ))}
    </>,
    document.body
  );
}
