/**
 * Home — the Tastemaker-tier landing stage.
 *
 * Replaces the Crib as the first thing a signed-in (or guest) user sees.
 * Three CTAs cover the three ways a player can spend time in the app:
 *
 *   1. Listen to fresh drops  → ListeningBooth (Tastemaker path)
 *   2. Start a new track      → TemplatePicker (Artist path)
 *   3. Visit a crib           → placeholder for the social-visit path
 *
 * The companion still reacts with a short greeting line via sayLine so
 * there's continuity with the old Crib feel, and the tamagotchi's needs
 * meters are tucked below so care actions stay one tap away.
 *
 * Energy/XP header lives on the persistent ScreenTopBar (see DeviceShell),
 * so we don't need to reproduce it here.
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { NeedsMeters } from "./NeedsMeters";

export function Home() {
  const {
    tamagotchi,
    inventory,
    setStage,
    toggleLogbook,
    openProfile,
    sayLine,
  } = useStore();

  const mood = tamagotchi.mood;
  const hasTracks = inventory.length > 0;

  // Greeting lines keyed by mood — same shape as Crib's so a future audit can
  // deduplicate these into one talkLines table if we want. Kept local for now
  // so Tastemaker iteration doesn't ripple into the old Crib file.
  const talkLines: Record<typeof mood, string> = {
    asleep: "zzz...",
    sleepy: "ok... what are we doing today",
    chill:  "pick a vibe. listen, cook, or drop by someone's crib.",
    happy:  "three ways in — let's go 🫶",
    hyped:  "LISTEN. COOK. VISIT. LET'S DO ALL OF IT",
    sad:    "put on something. hearing other people's stuff helps",
    lonely: "let's go see what someone's been working on",
  };

  useEffect(() => {
    sayLine(talkLines[mood]);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, sayLine]);

  return (
    <div
      className="flex flex-col items-center gap-4"
      style={{
        // Match the ListeningBooth's container so Home, Booth, and other
        // content stages share the same reading width. Prevents the CTAs
        // from stretching edge-to-edge on wide screens (which made them
        // feel empty of content — the screenshot comparison that drove
        // this change).
        padding: "34px 14px 80px", // top clears ScreenTopBar, bottom breathes
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div className="text-center">
        <div className="font-display font-bold text-lg text-white tracking-tight">
          what are we doing today?
        </div>
        <div className="text-[10px] font-mono text-white/40 uppercase tracking-widest mt-0.5">
          listen · create · visit
        </div>
      </div>

      {/* ── CTA 1: Listen to fresh drops ─────────────────────────────── */}
      <CTA
        icon="🎧"
        title="listen to fresh drops"
        sub="rate tracks · hype your favorites"
        accent="#22d3ee"
        onClick={() => setStage("booth")}
      />

      {/* ── CTA 2: Start a new track ─────────────────────────────────── */}
      <CTA
        icon="🎛️"
        title={hasTracks ? "cook something up" : "start your first track"}
        sub="pick a vibe · stack sounds · name it"
        accent="#ff4d6d"
        onClick={() => setStage("template")}
      />

      {/* ── CTA 3: Studio (Phase 5.B sound inventory + producer publishing) ── */}
      <CTA
        icon="🎚️"
        title="studio"
        sub="your sounds · publish · discover"
        accent="#a78bfa"
        onClick={() => setStage("studio")}
      />

      {/* Needs meters — secondary, tucked below the CTAs */}
      <div className="w-full mt-2 opacity-80">
        <NeedsMeters tam={tamagotchi} />
      </div>

      {/* Footer row — secondary links */}
      <div className="flex gap-2 w-full mt-1 flex-wrap">
        <button className="btn-ghost text-xs flex-1 min-w-0" onClick={() => openProfile(null)}>
          👤 me
        </button>
        <button className="btn-ghost text-xs flex-1 min-w-0" onClick={() => setStage("leaderboard")}>
          🏆 charts
        </button>
        <button className="btn-ghost text-xs flex-1 min-w-0" onClick={() => setStage("friends")}>
          🤝 friends
        </button>
        <button className="btn-ghost text-xs flex-1 min-w-0" onClick={toggleLogbook}>
          📓 logbook {inventory.length > 0 && `(${inventory.length})`}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Big tactile CTA button — used 3x on this screen                              */
/* -------------------------------------------------------------------------- */

function CTA({
  icon, title, sub, accent, onClick, disabled = false,
}: {
  icon: string;
  title: string;
  sub: string;
  accent: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1.5px solid ${disabled ? "rgba(255,255,255,0.06)" : accent + "55"}`,
        background: disabled
          ? "rgba(255,255,255,0.02)"
          : `linear-gradient(135deg, ${accent}18 0%, rgba(0,0,0,0.35) 100%)`,
        boxShadow: disabled
          ? "none"
          : `0 4px 14px rgba(0,0,0,0.45), 0 0 18px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        textAlign: "left",
        transition: "transform 120ms ease, box-shadow 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow =
          `0 6px 18px rgba(0,0,0,0.5), 0 0 22px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.08)`;
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow =
          `0 4px 14px rgba(0,0,0,0.45), 0 0 18px ${accent}22, inset 0 1px 0 rgba(255,255,255,0.05)`;
      }}
    >
      <span
        style={{
          fontSize: 26,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          background: `${accent}22`,
          border: `1px solid ${accent}44`,
          flexShrink: 0,
          filter: disabled ? "grayscale(0.6)" : "none",
        }}
      >
        {icon}
      </span>
      <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            fontWeight: 900,
            color: disabled ? "rgba(255,255,255,0.5)" : "#fff",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginTop: 2,
          }}
        >
          {sub}
        </span>
      </span>
      <span
        style={{
          fontFamily: "monospace",
          fontSize: 18,
          color: disabled ? "rgba(255,255,255,0.15)" : accent,
          fontWeight: 900,
          flexShrink: 0,
        }}
      >
        →
      </span>
    </button>
  );
}
