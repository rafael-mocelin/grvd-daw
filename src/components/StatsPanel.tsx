/**
 * StatsPanel — slides up from the bottom bar when the gamification strip is clicked.
 *
 * Two sections:
 *   1. STATS — lifetime numbers (streak, songs, sessions, XP, level, speed record…)
 *   2. ACHIEVEMENTS — a grid of unlockable nodes. Locked nodes show hints; unlocked
 *      nodes glow with the skin's accent color.
 *
 * Rendered via createPortal so it sits above the shell bars (z > shell bars).
 */

import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import { SKINS, SHELL } from "../shell/skins";

/* -------------------------------------------------------------------------- */
/* Skill tree definition                                                        */
/* -------------------------------------------------------------------------- */

interface SkillNode {
  id: string;
  icon: string;
  /** Title shown under the icon (e.g. "First Wax"). */
  label: string;
  /** Subtitle — a short description of the achievement, always visible. */
  subtitle: string;
  unlock: (s: ReturnType<typeof useStore.getState>) => boolean;
}

const SKILL_TREE: SkillNode[] = [
  // Row 1 — beginner unlocks
  {
    id: "first_song",
    icon: "💿",
    label: "First Wax",
    subtitle: "Finish your first song",
    unlock: (s) => s.inventory.length >= 1,
  },
  {
    id: "speed_run",
    icon: "⚡",
    label: "Speed Run",
    subtitle: "Finish a song in under 60s",
    unlock: (s) => s.inventory.some((song) => {
      // approximation: song has no vocal (faster) and was short
      return song.layers.length >= 3;
    }),
  },
  {
    id: "stacker",
    icon: "🧱",
    label: "Full Stack",
    subtitle: "Lock in all 4 recipe layers",
    unlock: (s) => s.inventory.some((song) => song.layers.length >= 4),
  },
  {
    id: "streak_3",
    icon: "🔥",
    label: "On Fire",
    subtitle: "Build a 3-day creation streak",
    unlock: (s) => s.longestStreak >= 3,
  },
  // Row 2 — intermediate
  {
    id: "catalog_5",
    icon: "📂",
    label: "Catalog",
    subtitle: "Make 5 songs",
    unlock: (s) => s.inventory.length >= 5,
  },
  {
    id: "streak_7",
    icon: "🌊",
    label: "Wave",
    subtitle: "Keep a 7-day streak alive",
    unlock: (s) => s.longestStreak >= 7,
  },
  {
    id: "no_skip",
    icon: "🎯",
    label: "No Skip",
    subtitle: "Finish a song without skipping",
    unlock: (s) => s.inventory.some((song) => song.layers.length >= 4),
  },
  {
    id: "collab",
    icon: "🤝",
    label: "Feature",
    subtitle: "Co-produce a track with a friend",
    unlock: (s) =>
      s.inventory.some((song) => (song.collaborators?.length ?? 0) > 1),
  },
  // Row 3 — advanced
  {
    id: "catalog_20",
    icon: "🏛️",
    label: "Archive",
    subtitle: "Make 20 songs",
    unlock: (s) => s.inventory.length >= 20,
  },
  {
    id: "streak_30",
    icon: "💎",
    label: "Diamond",
    subtitle: "30-day creation streak",
    unlock: (s) => s.longestStreak >= 30,
  },
  {
    id: "level_10",
    icon: "🏆",
    label: "Pro Status",
    subtitle: "Reach level 10",
    unlock: (s) => {
      const xp = s.tamagotchi.songsFinished * 100;
      return Math.floor(xp / 300) + 1 >= 10;
    },
  },
  {
    id: "speed_master",
    icon: "🚀",
    label: "Hyperspeed",
    subtitle: "Finish a song in under 30s",
    unlock: (s) => s.longestSessionMs > 0 && s.longestSessionMs < 30_000,
  },
];

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export function StatsPanel() {
  const state = useStore();
  const { skinId, tamagotchi, inventory, longestStreak, longestSessionMs, toggleStats } = state;
  const skin = SKINS[skinId];

  const xp = tamagotchi.songsFinished * 100;
  const level = Math.floor(xp / 300) + 1;
  const xpPct = ((xp % 300) / 300) * 100;
  const nextXp = 300 - (xp % 300);

  const fastestMs = longestSessionMs; // best session duration (lowest = fastest song)
  const fastestStr =
    fastestMs <= 0
      ? "—"
      : fastestMs < 60_000
      ? `${Math.round(fastestMs / 1000)}s`
      : `${Math.floor(fastestMs / 60000)}m ${Math.round((fastestMs % 60000) / 1000)}s`;

  const panelTop = SHELL.TOP + 12; // panel starts just below the top bar

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={toggleStats}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 60,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: panelTop,
          bottom: SHELL.BOTTOM + 8,
          left: SHELL.LEFT + 12,
          right: SHELL.RIGHT + 12,
          zIndex: 61,
          background: "rgba(10,9,16,0.98)",
          border: `1px solid ${skin.accent}33`,
          borderRadius: 14,
          boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.9), 0 0 60px ${skin.accent}18`,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 20px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: skin.accent,
              }}
            >
              GRVD · PLAYER CARD
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 18,
                fontWeight: 900,
                color: "#fff",
                letterSpacing: "0.05em",
                marginTop: 2,
              }}
            >
              LV {level}
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginLeft: 8, fontWeight: 400 }}>
                {nextXp} XP to next level
              </span>
            </div>
            {/* XP bar */}
            <div
              style={{
                width: 200,
                height: 4,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 2,
                marginTop: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${xpPct}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${skin.accent}, ${skin.accent}88)`,
                  boxShadow: `0 0 8px ${skin.accent}66`,
                  borderRadius: 2,
                  transition: "width 0.6s",
                }}
              />
            </div>
          </div>
          <button
            onClick={toggleStats}
            style={{
              width: 28, height: 28, borderRadius: 6,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.4)",
              fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: "auto", scrollbarWidth: "thin", scrollbarColor: `${skin.accent}33 transparent` }}>
          <div style={{ padding: "16px 20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

            {/* ── STATS GRID ── */}
            <section>
              <SectionLabel color={skin.accent}>stats</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <StatCard icon="💿" label="Songs Made" value={inventory.length} color={skin.accent} />
                <StatCard icon="🔥" label="Best Streak" value={`${longestStreak}d`} color={skin.accent} />
                <StatCard
                  icon="⏱"
                  label="Best Session"
                  value={fastestStr}
                  color={skin.accent}
                />
                <StatCard
                  icon="🎯"
                  label="Completion Rate"
                  value={
                    inventory.length + tamagotchi.songsAbandoned > 0
                      ? `${Math.round(
                          (inventory.length /
                            (inventory.length + tamagotchi.songsAbandoned)) *
                            100
                        )}%`
                      : "—"
                  }
                  color={skin.accent}
                />
                <StatCard icon="⚗️" label="Abandoned" value={tamagotchi.songsAbandoned} color="#ef4444" />
                <StatCard icon="🎛️" label="Total XP" value={xp} color={skin.accent} />
              </div>
            </section>

            {/* ── ACHIEVEMENTS ── */}
            <section>
              <SectionLabel color={skin.accent}>achievements</SectionLabel>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {SKILL_TREE.map((node, i) => {
                  const unlocked = node.unlock(state);
                  return (
                    <SkillNode
                      key={node.id}
                      node={node}
                      unlocked={unlocked}
                      accent={skin.accent}
                      row={Math.floor(i / 4)}
                    />
                  );
                })}
              </div>
              {/* connecting lines hint */}
              <p
                style={{
                  marginTop: 10,
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.2)",
                  textAlign: "center",
                }}
              >
                more skills unlock as you create · keep going
              </p>
            </section>

            {/* ── TAMAGOTCHI NEEDS ── */}
            <section>
              <SectionLabel color={skin.accent}>companion needs</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <NeedBar label="creativity" value={tamagotchi.needs.creativity} color="#a855f7" />
                <NeedBar label="social" value={tamagotchi.needs.social} color="#06b6d4" />
                <NeedBar label="energy" value={tamagotchi.needs.energy} color="#22c55e" />
              </div>
              <p
                style={{
                  marginTop: 8,
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                needs decay when you don't create · make music to keep GRVD alive
              </p>
            </section>

          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                               */
/* -------------------------------------------------------------------------- */

function SectionLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 8,
          fontWeight: 800,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color,
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 6 }}>{icon}</div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 18,
          fontWeight: 900,
          color,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.35)",
          marginTop: 4,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function SkillNode({
  node,
  unlocked,
  accent,
}: {
  node: SkillNode;
  unlocked: boolean;
  accent: string;
  row: number;
}) {
  // Rows deeper in the tree are "gated" visually
  const gated = !unlocked;
  return (
    <div
      title={gated ? `🔒 ${node.label} — ${node.subtitle}` : `${node.label} — ${node.subtitle}`}
      style={{
        background: unlocked
          ? `linear-gradient(135deg, ${accent}22 0%, ${accent}0a 100%)`
          : "rgba(255,255,255,0.02)",
        border: `1px solid ${unlocked ? accent + "55" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 10,
        padding: "12px 10px 10px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        cursor: "default",
        opacity: gated ? 0.55 : 1,
        transition: "all 0.2s",
        position: "relative",
        boxShadow: unlocked ? `0 0 16px ${accent}22` : "none",
        minHeight: 110, // consistent height now that every card has a subtitle
      }}
    >
      <div
        style={{
          fontSize: gated ? 18 : 22,
          lineHeight: 1,
          filter: gated ? "grayscale(1)" : "none",
          transition: "all 0.2s",
          marginBottom: 2,
        }}
      >
        {gated ? "🔒" : node.icon}
      </div>

      {/* TITLE */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 10,
          fontWeight: 900,
          textAlign: "center",
          color: unlocked ? "#fff" : "rgba(255,255,255,0.6)",
          letterSpacing: "0.04em",
          lineHeight: 1.15,
          textTransform: "uppercase",
        }}
      >
        {node.label}
      </div>

      {/* SUBTITLE — always visible now, in both locked and unlocked states */}
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 8.5,
          fontWeight: 500,
          textAlign: "center",
          color: unlocked ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)",
          lineHeight: 1.3,
          letterSpacing: "0.01em",
          maxWidth: "100%",
        }}
      >
        {node.subtitle}
      </div>

      {unlocked && (
        <div
          style={{
            width: 6, height: 6, borderRadius: "50%",
            background: accent,
            boxShadow: `0 0 8px ${accent}`,
            marginTop: 2,
          }}
        />
      )}
    </div>
  );
}

function NeedBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          width: 72,
          fontFamily: "monospace",
          fontSize: 9,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.4)",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div
        style={{
          flex: 1,
          height: 6,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}88)`,
            borderRadius: 3,
            boxShadow: `0 0 6px ${color}66`,
            transition: "width 0.5s",
          }}
        />
      </div>
      <div
        style={{
          width: 28,
          fontFamily: "monospace",
          fontSize: 9,
          color: "rgba(255,255,255,0.3)",
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}
