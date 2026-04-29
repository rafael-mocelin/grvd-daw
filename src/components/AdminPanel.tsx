/**
 * AdminPanel — debug/testing tools, visible only when user is promoted to
 * admin via Supabase app_metadata.
 *
 * UI-v1 game-feel rebuild — chunky candy panel chrome, palette-aligned
 * sections, ChunkyPill mood buttons, GRVD-tinted save rows. All admin
 * functionality preserved: mood force, live game-config editor, reset
 * actions with two-tap confirmation.
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
import { ChunkyPill } from "./../ui/Chunky";

const MOODS: Mood[] = ["hyped", "happy", "chill", "sleepy", "asleep", "sad", "lonely"];

const MOOD_GLYPH: Record<Mood, string> = {
  hyped:  "🔥",
  happy:  "😊",
  chill:  "😎",
  sleepy: "🥱",
  asleep: "💤",
  sad:    "🥲",
  lonely: "🫥",
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

function ConfirmButton({
  label,
  confirmLabel = "tap again to confirm",
  onConfirm,
  variant = "warn",
}: ConfirmButtonProps) {
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

  // Map variant + state → tailwind palette classes.
  const armedClass = variant === "danger"
    ? "bg-red-500/20 border-red-500 text-red-300"
    : "bg-grvd-gold/25 border-grvd-gold text-grvd-gold";
  const idleClass  = "bg-white/3 border-white/10 text-white/85 hover:border-white/25";
  const firedClass = "bg-grvd-lime/15 border-grvd-lime/55 text-grvd-lime";

  const cls = justFired ? firedClass : armed ? armedClass : idleClass;

  return (
    <button
      onClick={handleClick}
      className={[
        "w-full text-left rounded-xl px-3 py-2",
        "border-2 transition-all shadow-chunky-press",
        "font-mono text-[10px] font-bold tracking-[0.06em]",
        cls,
      ].join(" ")}
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
      {/* Floating launcher — always visible for admins, top-right corner.
       *
       * Sits ABOVE the HUD (z-9000) so it's reachable from any screen.
       * Gold disc with halo so it's discoverable but doesn't fight with
       * the rest of the chunky language. */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={open ? "close admin panel" : "open admin panel"}
        className={[
          "fixed top-3.5 right-3.5 z-[9000]",
          "w-9 h-9 rounded-full",
          "inline-flex items-center justify-center",
          "font-display text-base text-grvd-base",
          "bg-grvd-gold border-2 border-grvd-gold/60",
          "shadow-chunky shadow-glow-gold",
          "active:translate-y-[1px] active:scale-95",
          "transition-all duration-150 select-none",
        ].join(" ")}
      >
        A
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={[
            "fixed top-14 right-3.5 z-[9001]",
            "w-[280px] max-h-[80vh] overflow-y-auto",
            "rounded-3xl border-2 border-grvd-gold/45 bg-[#13111d]",
            "shadow-chunky shadow-[0_0_28px_rgba(251,191,36,0.18)]",
            "px-4 pt-4 pb-3 text-white",
          ].join(" ")}
        >
          {/* Header */}
          <div className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-grvd-gold">
            admin debug
          </div>
          <div className="font-mono text-[9px] text-white/45 mb-3 break-all">
            {user?.email}
          </div>

          {/* MOOD FORCE */}
          <SectionLabel>force mood</SectionLabel>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {MOODS.map((m) => {
              const active = moodOverride === m;
              return (
                <button
                  key={m}
                  onClick={() => setMoodOverride(m)}
                  className={[
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                    "font-mono text-[10px] font-bold uppercase",
                    "border-2 transition-all shadow-chunky-press",
                    active
                      ? "bg-grvd-gold/30 border-grvd-gold text-grvd-gold"
                      : "bg-white/4 border-white/10 text-white/80 hover:border-white/25",
                  ].join(" ")}
                >
                  <span>{MOOD_GLYPH[m]}</span>
                  <span>{m}</span>
                </button>
              );
            })}
          </div>
          <ChunkyPill
            variant="ghost"
            size="sm"
            onClick={() => setMoodOverride(null)}
            disabled={moodOverride === null}
            className="w-full mb-4"
          >
            clear override
          </ChunkyPill>

          {/* GAME CONFIG — live tuning for Slice 2 thresholds */}
          <GameConfigEditor />

          {/* RESETS */}
          <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-red-400/85 mb-2">
            resets · tap twice
          </div>
          <div className="flex flex-col gap-1.5 mb-4">
            <ConfirmButton label="reset xp / level"        onConfirm={adminResetXP} />
            <ConfirmButton label="reset achievements"      onConfirm={adminResetAchievements} />
            <ConfirmButton label="reset lifetime stats"    onConfirm={adminResetLifetimeStats} />
            <ConfirmButton label="delete all songs"        onConfirm={adminResetInventory} />
            <ConfirmButton label="reset tamagotchi"        onConfirm={adminResetTamagotchi} />
            <ConfirmButton
              label="✦ wipe everything"
              confirmLabel="tap again — wipes ALL progress"
              variant="danger"
              onConfirm={adminResetEverything}
            />
          </div>

          {/* Status footer */}
          <SectionLabel>status</SectionLabel>
          <div className="font-mono text-[10px] text-grvd-lime mb-1">
            admin role active
          </div>
          <div className="font-mono text-[9px] text-white/35 leading-relaxed">
            current override:{" "}
            <span className={moodOverride ? "text-grvd-gold" : "text-white/55"}>
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
/* -------------------------------------------------------------------------- */

function GameConfigEditor() {
  return (
    <div className="mb-4">
      <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-grvd-gold/80 mb-2">
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

  if (!value) return <div className={cfgLoadingCx}>loading early-ear threshold…</div>;

  return (
    <div className={cfgBlockCx}>
      <div className={cfgTitleCx}>early-ear bonus threshold</div>
      <ConfigNumberField label="min ratings"      hint="how many 1–5★ ratings before a song is 'popular'"   value={value.min_ratings}     onChange={(n) => setValue({ ...value, min_ratings: n })} />
      <ConfigNumberField label="min avg stars"    hint="and the average stars must be at least this"          step={0.1} value={value.min_avg_stars}   onChange={(n) => setValue({ ...value, min_avg_stars: n })} />
      <ConfigNumberField label="min endorsements" hint="OR this many pushes, whichever trips first"           value={value.min_endorsements} onChange={(n) => setValue({ ...value, min_endorsements: n })} />
      <ConfigNumberField label="bonus xp"         hint="xp awarded to each early-ear when the song trips"     value={value.bonus_xp}        onChange={(n) => setValue({ ...value, bonus_xp: n })} />
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

  if (!value) return <div className={cfgLoadingCx}>loading artist boost…</div>;

  return (
    <div className={cfgBlockCx}>
      <div className={cfgTitleCx}>artist boost (on being endorsed)</div>
      <ConfigNumberField label="energy / push" hint="⚡ the artist gains each time a fan pushes their song" value={value.energy_per_endorsement} onChange={(n) => setValue({ ...value, energy_per_endorsement: n })} />
      <ConfigNumberField label="daily cap ⚡"  hint="max energy an artist can gain from endorsements per UTC day" value={value.daily_cap_energy}      onChange={(n) => setValue({ ...value, daily_cap_energy: n })} />
      <SaveRow saving={saving} justSaved={justSaved} onSave={save} />
    </div>
  );
}

/* ---- Shared pieces ---- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-white/55 mb-2">
      {children}
    </div>
  );
}

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
    <label className="flex flex-col gap-1 mb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-wide text-white/75">{label}</span>
        <input
          type="number"
          value={value}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-[68px] px-2 py-0.5 rounded-md bg-black/40 border border-grvd-gold/40 text-white font-mono text-[11px] tabular-nums text-right outline-none focus:border-grvd-gold/70"
        />
      </div>
      {hint && (
        <span className="font-mono text-[9px] text-white/35 leading-snug">
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
      className={[
        "w-full mt-1 px-3 py-1.5 rounded-lg",
        "border-2 transition-all shadow-chunky-press",
        "font-mono text-[10px] font-bold tracking-[0.1em] uppercase",
        justSaved
          ? "bg-grvd-lime/15 border-grvd-lime/55 text-grvd-lime"
          : "bg-grvd-gold/15 border-grvd-gold/50 text-grvd-gold",
        saving ? "cursor-wait opacity-70" : "cursor-pointer",
      ].join(" ")}
    >
      {saving ? "saving…" : justSaved ? "saved ✓" : "save"}
    </button>
  );
}

const cfgBlockCx = [
  "rounded-xl p-2 mb-2",
  "bg-black/25 border border-white/8",
  "shadow-chunky-press",
].join(" ");

const cfgTitleCx = [
  "font-mono text-[10px] uppercase tracking-wide",
  "text-grvd-gold/85 mb-1.5",
].join(" ");

const cfgLoadingCx = [
  "p-2 font-mono text-[9px] italic text-white/30",
].join(" ");
