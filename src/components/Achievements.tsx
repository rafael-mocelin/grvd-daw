/**
 * Achievements — full-screen browser of every achievement, grouped by
 * category, with unlocked vs locked state.
 *
 * Reached by tapping the XP ribbon in the HUD. Visual language matches
 * the BURST hero design: chunky chrome rows, tier colors used as the
 * row accent, locked items grayscale + dimmed.
 */

import { useMemo } from "react";
import { useStore } from "../store/useStore";
import {
  ACHIEVEMENTS,
  TIER_COLOR,
  CATEGORY_COLOR,
  type Achievement,
  type AchievementCategory,
} from "../data/achievements";
import { C, chrome, readout } from "../ui/burst/tokens";
import { Gloss } from "../ui/burst/Gloss";
import { GhostPill } from "../ui/burst/GhostPill";

const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  creation:    "creation",
  performance: "performance",
  reputation:  "reputation",
  collab:      "collab",
};

const CATEGORY_ORDER: AchievementCategory[] = [
  "creation", "performance", "reputation", "collab",
];

export function Achievements() {
  const setStage             = useStore((s) => s.setStage);
  const unlockedAchievements = useStore((s) => s.unlockedAchievements);
  const totalXP              = useStore((s) => s.totalXP);
  const level                = useStore((s) => s.level);

  // Group achievements by category, preserving the canonical order.
  const grouped = useMemo(() => {
    const map: Record<AchievementCategory, Achievement[]> = {
      creation: [], performance: [], reputation: [], collab: [],
    };
    for (const a of ACHIEVEMENTS) {
      map[a.category].push(a);
    }
    return map;
  }, []);

  const unlockedSet = useMemo(() => new Set(unlockedAchievements), [unlockedAchievements]);
  const totalUnlocked = unlockedSet.size;
  const totalCount    = ACHIEVEMENTS.length;
  const completionPct = Math.round((totalUnlocked / totalCount) * 100);

  return (
    <div
      style={{
        paddingTop: 6,
        paddingBottom: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 480,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 11, color: C.gold, letterSpacing: "0.2em", textTransform: "uppercase",
            }}
          >
            ✦ ACHIEVEMENTS
          </div>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 28, color: "#fff", letterSpacing: 0.5, lineHeight: 1.1,
              textShadow: "0 2px 0 rgba(0,0,0,0.55)",
              marginTop: 4,
            }}
          >
            your trophy case
          </div>
        </div>
        <GhostPill onClick={() => setStage("home")}>← back</GhostPill>
      </div>

      {/* ── Summary card ── */}
      <div
        style={{
          position: "relative",
          ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
          borderRadius: 18,
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}
      >
        <Gloss radius={18} opacity={0.25} />
        {/* LV disc */}
        <div
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: `radial-gradient(circle at 35% 30%, ${C.goldLight}, ${C.gold} 60%, #7a5a08)`,
            border: "2px solid #0a0f1c",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 18, color: "#3a2906",
            textShadow: "0 1px 0 rgba(255,255,255,0.45)",
            boxShadow: "0 3px 0 rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.6)",
          }}
        >
          {level}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...readout(), fontSize: 16 }}>
            {totalUnlocked}<span style={{ opacity: 0.7 }}> / {totalCount}</span>
          </div>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 11, color: "#bcd0e8", letterSpacing: 0.4, opacity: 0.85,
              marginTop: 2,
            }}
          >
            {completionPct}% complete · {totalXP.toLocaleString()} XP
          </div>
          {/* Progress bar */}
          <div
            style={{
              marginTop: 6, height: 6, borderRadius: 999,
              background: "rgba(0,0,0,0.45)",
              overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.6)",
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                width: `${completionPct}%`,
                height: "100%",
                background: `linear-gradient(180deg, ${C.coral} 0%, ${C.gold} 100%)`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
                transition: "width 600ms ease",
              }}
            />
          </div>
        </div>
      </div>

      {/* ── Category sections ── */}
      {CATEGORY_ORDER.map((cat) => {
        const items = grouped[cat];
        if (items.length === 0) return null;
        const catUnlocked = items.filter((a) => unlockedSet.has(a.id)).length;
        return (
          <section key={cat} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 8,
                paddingLeft: 4,
              }}
            >
              <div
                aria-hidden
                style={{
                  width: 8, height: 8, borderRadius: 2,
                  background: CATEGORY_COLOR[cat],
                  boxShadow: `0 0 8px ${CATEGORY_COLOR[cat]}aa`,
                }}
              />
              <span
                style={{
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 12, color: CATEGORY_COLOR[cat],
                  letterSpacing: "0.18em", textTransform: "uppercase",
                }}
              >
                {CATEGORY_LABEL[cat]}
              </span>
              <span
                style={{
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 11, color: "rgba(255,255,255,0.55)",
                  marginLeft: "auto",
                }}
              >
                {catUnlocked} / {items.length}
              </span>
            </div>
            {items.map((a) => (
              <Row
                key={a.id}
                achievement={a}
                unlocked={unlockedSet.has(a.id)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row                                                                         */
/* -------------------------------------------------------------------------- */

function Row({ achievement: a, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const tierColor = TIER_COLOR[a.tier];
  return (
    <div
      style={{
        position: "relative",
        ...chrome(
          unlocked
            ? `linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`
            : `linear-gradient(180deg, #2a2f3e, #1a1f2e)`,
          "#0a0f1c",
          unlocked ? `${tierColor}55` : null,
        ),
        borderLeft: `4px solid ${unlocked ? tierColor : "#3a3f4e"}`,
        borderRadius: 14,
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10,
        opacity: unlocked ? 1 : 0.55,
      }}
    >
      <Gloss radius={14} opacity={unlocked ? 0.25 : 0.1} />

      {/* Icon disc */}
      <div
        style={{
          width: 44, height: 44, borderRadius: "50%",
          background: unlocked
            ? `radial-gradient(circle at 35% 30%, ${tierColor}66, ${C.navyDeep})`
            : "radial-gradient(circle at 35% 30%, #3a3f4e, #1a1f2e)",
          border: `2px solid ${unlocked ? tierColor : "#3a3f4e"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
          flexShrink: 0,
          filter: unlocked ? `drop-shadow(0 0 8px ${tierColor}66)` : "grayscale(0.7)",
          boxShadow: "0 3px 0 rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        {a.icon}
      </div>

      {/* Body */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 14, color: "#fff", letterSpacing: 0.3,
            textShadow: "0 1px 0 rgba(0,0,0,0.5)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}
        >
          {unlocked ? a.name : "???"}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10, color: "rgba(255,255,255,0.55)",
            marginTop: 2, lineHeight: 1.4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {unlocked ? a.description : "locked — keep cooking to unlock"}
        </div>
      </div>

      {/* XP badge */}
      <div
        style={{
          flexShrink: 0,
          padding: "4px 10px", borderRadius: 999,
          background: unlocked
            ? `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`
            : "rgba(74,74,74,0.5)",
          border: `2px solid ${unlocked ? "#0a0f1c" : "#3a3f4e"}`,
          fontFamily: "'Lilita One', system-ui",
          fontSize: 12, color: unlocked ? "#3a2906" : "rgba(255,255,255,0.4)",
          textShadow: unlocked ? "0 1px 0 rgba(255,255,255,0.45)" : "none",
          boxShadow: unlocked ? "0 2px 0 rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.6)" : "none",
        }}
      >
        +{a.xpReward} XP
      </div>
    </div>
  );
}
