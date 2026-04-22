/**
 * AdminPanel — debug/testing tools, visible only when user is promoted to
 * admin via Supabase app_metadata.
 *
 * Gives the admin a quick way to force mood states so the shell face can
 * be visually tested (otherwise you'd have to wait for tamagotchi needs
 * to decay to see sleepy/asleep).
 *
 * To become admin, run in Supabase SQL editor:
 *   UPDATE auth.users
 *   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb
 *   WHERE email = 'you@example.com';
 * Then sign out and back in.
 */

import { useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useStore } from "../store/useStore";
import type { Mood } from "../data/types";
import { SKINS, SKIN_ORDER, type SkinId } from "../shell/skins";

const MOODS: Mood[] = ["hyped", "happy", "chill", "sleepy", "asleep", "sad", "lonely"];

const MOOD_EMOJI: Record<Mood, string> = {
  hyped:  "[*]",
  happy:  "[:)]",
  chill:  "[-]",
  sleepy: "[z]",
  asleep: "[Z]",
  sad:    "[:(]",
  lonely: "[;_;]",
};

/* -------------------------------------------------------------------------- */
/* ConfirmButton — click once to arm, click again within 2.5s to fire.         */
/* -------------------------------------------------------------------------- */

interface ConfirmButtonProps {
  label: string;
  /** Label shown while armed, e.g. "tap again to confirm". */
  confirmLabel?: string;
  onConfirm: () => void;
  /** Visual tier — "danger" is red (destructive), "warn" is amber. */
  variant?: "danger" | "warn";
}

function ConfirmButton({ label, confirmLabel = "tap again to confirm", onConfirm, variant = "warn" }: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);
  const [justFired, setJustFired] = useState(false);
  const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearDisarmTimer() {
    if (disarmTimer.current) {
      clearTimeout(disarmTimer.current);
      disarmTimer.current = null;
    }
  }

  function handleClick() {
    if (!armed) {
      setArmed(true);
      clearDisarmTimer();
      disarmTimer.current = setTimeout(() => setArmed(false), 2500);
      return;
    }
    clearDisarmTimer();
    setArmed(false);
    onConfirm();
    setJustFired(true);
    setTimeout(() => setJustFired(false), 1200);
  }

  const baseColor = variant === "danger" ? "#ef4444" : "#fbbf24";
  const bg = armed
    ? `${baseColor}33`
    : justFired
      ? "rgba(74,222,128,0.2)"
      : "rgba(255,255,255,0.03)";
  const border = armed
    ? baseColor
    : justFired
      ? "rgba(74,222,128,0.6)"
      : "rgba(255,255,255,0.1)";
  const text = justFired ? "#4ade80" : armed ? baseColor : "rgba(255,255,255,0.85)";

  return (
    <button
      onClick={handleClick}
      style={{
        width: "100%",
        padding: "7px 10px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        color: text,
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.06em",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
    >
      {justFired ? "✓ done" : armed ? confirmLabel : label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* AdminPanel                                                                  */
/* -------------------------------------------------------------------------- */

export function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const {
    moodOverride, setMoodOverride,
    skinId, setSkin,
    adminResetXP,
    adminResetAchievements,
    adminResetLifetimeStats,
    adminResetInventory,
    adminResetTamagotchi,
    adminResetEverything,
  } = useStore();
  const [open, setOpen] = useState(false);

  if (!isAdmin) return null;

  return (
    <>
      {/* Floating launcher — always visible for admins, above the shell */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "close admin panel" : "open admin panel"}
        style={{
          position: "fixed",
          top: 14,
          right: 14,
          zIndex: 9000,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "rgba(251,191,36,0.25)",
          border: "1.5px solid rgba(251,191,36,0.7)",
          color: "#fbbf24",
          fontFamily: "monospace",
          fontWeight: 900,
          fontSize: 13,
          letterSpacing: "0.08em",
          cursor: "pointer",
          boxShadow: "0 0 14px rgba(251,191,36,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        A
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: 54,
            right: 14,
            zIndex: 9001,
            width: 260,
            maxHeight: "80vh",
            overflowY: "auto",
            background: "#13111d",
            border: "1px solid rgba(251,191,36,0.45)",
            borderRadius: 14,
            padding: "14px 14px 12px",
            fontFamily: "monospace",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 24px rgba(251,191,36,0.15)",
            color: "#fff",
          }}
        >
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: "0.16em",
            color: "#fbbf24", textTransform: "uppercase",
            marginBottom: 2,
          }}>
            admin debug
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.45)",
            marginBottom: 12, wordBreak: "break-all",
          }}>
            {user?.email}
          </div>

          {/* MOOD FORCE */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            force mood
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => setMoodOverride(m)}
                style={{
                  flex: "1 0 calc(50% - 6px)",
                  padding: "6px 8px",
                  background: moodOverride === m ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${moodOverride === m ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 6,
                  color: moodOverride === m ? "#fbbf24" : "rgba(255,255,255,0.8)",
                  fontFamily: "monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ opacity: 0.6, marginRight: 4 }}>{MOOD_EMOJI[m]}</span>
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMoodOverride(null)}
            disabled={moodOverride === null}
            style={{
              width: "100%",
              padding: "7px 0",
              background: "transparent",
              border: "1px dashed rgba(255,255,255,0.2)",
              borderRadius: 6,
              color: moodOverride ? "#fff" : "rgba(255,255,255,0.3)",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              cursor: moodOverride ? "pointer" : "not-allowed",
              marginBottom: 14,
            }}
          >
            clear override
          </button>

          {/* SKIN SELECTOR — moved here from the top-shell GRVD logo area */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            shell skin
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {SKIN_ORDER.map((id: SkinId) => {
              const s      = SKINS[id];
              const active = skinId === id;
              return (
                <button
                  key={id}
                  onClick={() => setSkin(id)}
                  title={s.name}
                  style={{
                    flex: "1 0 calc(50% - 6px)",
                    padding: "6px 8px",
                    display: "flex", alignItems: "center", gap: 8,
                    background: active ? `${s.accent}2e` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${active ? `${s.accent}aa` : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 6,
                    color: active ? "#fff" : "rgba(255,255,255,0.8)",
                    fontFamily: "monospace",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: active ? `0 0 10px ${s.accent}55` : "none",
                    transition: "all 0.15s",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 12, height: 12, borderRadius: "50%",
                      background: s.accent,
                      boxShadow: `0 0 6px ${s.accent}`,
                      flexShrink: 0,
                    }}
                  />
                  {s.name}
                </button>
              );
            })}
          </div>

          {/* RESETS */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(239,68,68,0.75)", textTransform: "uppercase",
            marginBottom: 6,
          }}>
            resets (tap twice)
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 6,
            marginBottom: 14,
          }}>
            <ConfirmButton
              label="reset xp / level"
              onConfirm={adminResetXP}
            />
            <ConfirmButton
              label="reset achievements"
              onConfirm={adminResetAchievements}
            />
            <ConfirmButton
              label="reset lifetime stats"
              onConfirm={adminResetLifetimeStats}
            />
            <ConfirmButton
              label="delete all songs"
              onConfirm={adminResetInventory}
            />
            <ConfirmButton
              label="reset tamagotchi"
              onConfirm={adminResetTamagotchi}
            />
            <ConfirmButton
              label="✦ wipe everything"
              confirmLabel="tap again — wipes ALL progress"
              variant="danger"
              onConfirm={adminResetEverything}
            />
          </div>

          {/* Reminder of how to promote */}
          <div style={{
            fontSize: 9, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            status
          </div>
          <div style={{
            fontSize: 10, color: "#4ade80",
            marginBottom: 4,
          }}>
            admin role active
          </div>
          <div style={{
            fontSize: 9, color: "rgba(255,255,255,0.35)",
            lineHeight: 1.5,
          }}>
            Current override:{" "}
            <span style={{ color: moodOverride ? "#fbbf24" : "rgba(255,255,255,0.5)" }}>
              {moodOverride ?? "none (auto)"}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
