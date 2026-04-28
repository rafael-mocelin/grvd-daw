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

import { useEffect, useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useStore } from "../store/useStore";
import type { Mood } from "../data/types";
import {
  fetchGameConfig,
  adminSetGameConfig,
  type EarlyEarThreshold,
  type ArtistBoostConfig,
} from "../lib/game-db";

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

          {/* GAME CONFIG — live tuning for Slice 2 thresholds */}
          <GameConfigEditor />

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

/* -------------------------------------------------------------------------- */
/* GameConfigEditor — read + write game_config rows from inside the panel.     */
/*                                                                             */
/* Two rows today:                                                              */
/*   early_ear_threshold  — when a song trips the retroactive XP bonus for    */
/*                          early-ear tastemakers.                             */
/*   artist_boost         — how much energy an artist gets per endorsement,   */
/*                          and the daily cap.                                 */
/*                                                                             */
/* Reads use the public game_config table. Writes go through                  */
/* admin_set_game_config RPC (app_metadata.role = 'admin' check server-side). */
/* -------------------------------------------------------------------------- */

function GameConfigEditor() {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 9, letterSpacing: "0.12em",
        color: "rgba(250,204,21,0.75)", textTransform: "uppercase",
        marginBottom: 6,
      }}>
        game config (live)
      </div>

      <EarlyEarEditor />
      <ArtistBoostEditor />
    </div>
  );
}

/* ---- Early-ear threshold row ---- */

function EarlyEarEditor() {
  const [value, setValue] = useState<EarlyEarThreshold | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetchGameConfig<EarlyEarThreshold>("early_ear_threshold").then(setValue);
  }, []);

  async function save() {
    if (!value) return;
    setSaving(true);
    const r = await adminSetGameConfig("early_ear_threshold", value);
    setSaving(false);
    if (r) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    }
  }

  if (!value) return <div style={cfgLoading}>loading early-ear threshold…</div>;

  return (
    <div style={cfgBlock}>
      <div style={cfgTitle}>early-ear bonus threshold</div>
      <ConfigNumberField
        label="min ratings"
        hint="how many 1–5★ ratings before a song is 'popular'"
        value={value.min_ratings}
        onChange={(n) => setValue({ ...value, min_ratings: n })}
      />
      <ConfigNumberField
        label="min avg stars"
        hint="and the average stars must be at least this"
        step={0.1}
        value={value.min_avg_stars}
        onChange={(n) => setValue({ ...value, min_avg_stars: n })}
      />
      <ConfigNumberField
        label="min endorsements"
        hint="OR this many pushes, whichever trips first"
        value={value.min_endorsements}
        onChange={(n) => setValue({ ...value, min_endorsements: n })}
      />
      <ConfigNumberField
        label="bonus xp"
        hint="xp awarded to each early-ear when the song trips"
        value={value.bonus_xp}
        onChange={(n) => setValue({ ...value, bonus_xp: n })}
      />
      <SaveRow saving={saving} justSaved={justSaved} onSave={save} />
    </div>
  );
}

/* ---- Artist boost row ---- */

function ArtistBoostEditor() {
  const [value, setValue] = useState<ArtistBoostConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    fetchGameConfig<ArtistBoostConfig>("artist_boost").then(setValue);
  }, []);

  async function save() {
    if (!value) return;
    setSaving(true);
    const r = await adminSetGameConfig("artist_boost", value);
    setSaving(false);
    if (r) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    }
  }

  if (!value) return <div style={cfgLoading}>loading artist boost…</div>;

  return (
    <div style={cfgBlock}>
      <div style={cfgTitle}>artist boost (on being endorsed)</div>
      <ConfigNumberField
        label="energy / push"
        hint="⚡ the artist gains each time a fan pushes their song"
        value={value.energy_per_endorsement}
        onChange={(n) => setValue({ ...value, energy_per_endorsement: n })}
      />
      <ConfigNumberField
        label="daily cap ⚡"
        hint="max energy an artist can gain from endorsements per UTC day"
        value={value.daily_cap_energy}
        onChange={(n) => setValue({ ...value, daily_cap_energy: n })}
      />
      <SaveRow saving={saving} justSaved={justSaved} onSave={save} />
    </div>
  );
}

/* ---- Shared pieces ---- */

function ConfigNumberField({
  label, hint, value, onChange, step = 1,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontFamily: "monospace", letterSpacing: "0.05em" }}>
          {label}
        </span>
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 68,
            padding: "3px 6px",
            background: "rgba(0,0,0,0.4)",
            border: "1px solid rgba(250,204,21,0.4)",
            borderRadius: 4,
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            textAlign: "right",
          }}
        />
      </div>
      {hint && (
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", lineHeight: 1.3 }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function SaveRow({
  saving, justSaved, onSave,
}: {
  saving: boolean;
  justSaved: boolean;
  onSave: () => void;
}) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      style={{
        width: "100%",
        padding: "6px 0",
        marginTop: 4,
        background: justSaved ? "rgba(74,222,128,0.2)" : "rgba(250,204,21,0.18)",
        border: `1px solid ${justSaved ? "rgba(74,222,128,0.6)" : "rgba(250,204,21,0.5)"}`,
        borderRadius: 5,
        color: justSaved ? "#4ade80" : "#facc15",
        fontFamily: "monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        cursor: saving ? "wait" : "pointer",
      }}
    >
      {saving ? "saving…" : justSaved ? "saved ✓" : "save"}
    </button>
  );
}

const cfgBlock: React.CSSProperties = {
  padding: 8,
  marginBottom: 8,
  background: "rgba(0,0,0,0.2)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 6,
};

const cfgTitle: React.CSSProperties = {
  fontSize: 10,
  color: "rgba(250,204,21,0.85)",
  fontFamily: "monospace",
  letterSpacing: "0.06em",
  marginBottom: 6,
  textTransform: "uppercase",
};

const cfgLoading: React.CSSProperties = {
  padding: 8,
  fontSize: 9,
  color: "rgba(255,255,255,0.3)",
  fontFamily: "monospace",
  fontStyle: "italic",
};
