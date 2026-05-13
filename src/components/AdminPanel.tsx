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
/* Draggable launcher position — persisted to localStorage so the admin's     */
/* preferred parking spot survives reloads.                                    */
/* -------------------------------------------------------------------------- */

const ADMIN_POS_KEY = "grvd:admin-button-pos:v1";
const BUTTON_SIZE   = 36;
/** Default position — top-right, matching the original `top-3.5 right-3.5`
 *  Tailwind classes (~14 px from each edge). Computed against the
 *  current viewport size at first load. */
function defaultAdminPos(): { x: number; y: number } {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  return { x: w - BUTTON_SIZE - 14, y: 14 };
}

function loadAdminPos(): { x: number; y: number } {
  try {
    const raw = window.localStorage.getItem(ADMIN_POS_KEY);
    if (!raw) return defaultAdminPos();
    const parsed = JSON.parse(raw) as { x: number; y: number };
    if (typeof parsed?.x === "number" && typeof parsed?.y === "number") {
      return clampToViewport(parsed);
    }
  } catch { /* ignore — corrupt or unavailable storage */ }
  return defaultAdminPos();
}

function saveAdminPos(pos: { x: number; y: number }) {
  try {
    window.localStorage.setItem(ADMIN_POS_KEY, JSON.stringify(pos));
  } catch { /* ignore */ }
}

function clampToViewport(pos: { x: number; y: number }): { x: number; y: number } {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const h = typeof window !== "undefined" ? window.innerHeight : 768;
  return {
    x: Math.max(0, Math.min(w - BUTTON_SIZE, pos.x)),
    y: Math.max(0, Math.min(h - BUTTON_SIZE, pos.y)),
  };
}

/** Where the panel should anchor relative to the button's current
 *  position. Picks an unfolding direction so the panel never falls
 *  off the edge of the viewport. */
const PANEL_W       = 280;
const PANEL_H_GUESS = 480;     // approx — panel can scroll if taller
const PANEL_GAP     = 8;

function computePanelPos(button: { x: number; y: number }): { x: number; y: number } {
  const w = typeof window !== "undefined" ? window.innerWidth : 1024;
  const h = typeof window !== "undefined" ? window.innerHeight : 768;

  // Vertical: open below the button if there's room; otherwise above.
  let y = button.y + BUTTON_SIZE + PANEL_GAP;
  if (y + PANEL_H_GUESS > h) {
    y = button.y - PANEL_H_GUESS - PANEL_GAP;
    if (y < 0) y = 0;
  }

  // Horizontal: align the panel's right edge to the button's right
  // edge by default (panel hangs left). If that puts it offscreen on
  // the left, flip to align left edges instead.
  let x = button.x + BUTTON_SIZE - PANEL_W;
  if (x < 0) x = button.x;
  if (x + PANEL_W > w) x = Math.max(0, w - PANEL_W);

  return { x, y };
}

/* -------------------------------------------------------------------------- */
/* AdminPanel                                                                  */
/* -------------------------------------------------------------------------- */

export function AdminPanel() {
  const { isAdmin, user } = useAuth();
  const {
    moodOverride, setMoodOverride,
    totalXP, addXP,
    adminResetXP,
    adminResetAchievements,
    adminResetLifetimeStats,
    adminResetInventory,
    adminResetTamagotchi,
    adminResetEverything,
  } = useStore();
  const [open, setOpen] = useState(false);

  // Position of the floating "A" launcher. Drag to move, persists in
  // localStorage so it survives reloads. Default: top-right (the
  // historical fixed position).
  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadAdminPos());
  const dragRef = useRef({
    active: false,
    moved:  false,        // crossed the click-vs-drag threshold?
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  // Re-anchor the button to top-right when the viewport resizes (so
  // it doesn't end up off-screen if the window shrinks).
  useEffect(() => {
    const onResize = () => {
      setPos((cur) => clampToViewport(cur));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!isAdmin) return null;

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragRef.current = {
      active: true,
      moved:  false,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const ref = dragRef.current;
    if (!ref.active) return;
    const dx = e.clientX - ref.startX;
    const dy = e.clientY - ref.startY;
    // 5 px threshold before we count it as a drag — keeps simple taps
    // from being interpreted as drags by jittery pointers.
    if (!ref.moved && Math.hypot(dx, dy) <= 5) return;
    ref.moved = true;
    setPos(clampToViewport({
      x: ref.startPosX + dx,
      y: ref.startPosY + dy,
    }));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    if (wasDrag) {
      saveAdminPos(pos);
    } else {
      setOpen((v) => !v);
    }
  }

  // Panel anchors near the button: opens to its lower-left if the
  // button is in the top half of the viewport, otherwise upper-left.
  // Clamps to viewport so it never goes offscreen.
  const panelPos = computePanelPos(pos);

  return (
    <>
      {/* Floating launcher — always visible for admins, draggable.
       *
       * Sits ABOVE the HUD (z-9000) so it's reachable from any screen.
       * Gold disc with halo so it's discoverable but doesn't fight with
       * the rest of the chunky language. */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        title={open ? "close admin panel · drag to move" : "open admin panel · drag to move"}
        className={[
          "fixed z-[9000]",
          "w-9 h-9 rounded-full",
          "inline-flex items-center justify-center",
          "font-display text-base text-grvd-base",
          "bg-grvd-gold border-2 border-grvd-gold/60",
          "shadow-chunky shadow-glow-gold",
          "active:translate-y-[1px] active:scale-95",
          "transition-shadow duration-150 select-none",
        ].join(" ")}
        style={{
          left:  pos.x,
          top:   pos.y,
          // Cursor cue — grab when idle, grabbing while pressed.
          cursor: dragRef.current.active && dragRef.current.moved ? "grabbing" : "grab",
          touchAction: "none",  // prevent the browser from hijacking touch-drags
        }}
      >
        A
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={[
            "fixed z-[9001]",
            "w-[280px] max-h-[80vh] overflow-y-auto",
            "rounded-3xl border-2 border-grvd-gold/45 bg-[#13111d]",
            "shadow-chunky shadow-[0_0_28px_rgba(251,191,36,0.18)]",
            "px-4 pt-4 pb-3 text-white",
          ].join(" ")}
          style={{
            left: panelPos.x,
            top:  panelPos.y,
          }}
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

          {/* XP — quick add buttons for testing XP-gated features
           *  like the jam-stage arrange timeline (unlocks at 300 XP).
           *  Visible to admins only; goes straight into the store's
           *  addXP path so the totalXP UI updates instantly. */}
          <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-grvd-gold/80 mb-2">
            xp · current {totalXP}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[100, 500, 1000, 5000].map((amount) => (
              <button
                key={amount}
                onClick={() => addXP(amount, `admin +${amount}xp`)}
                className={[
                  "px-3 py-1.5 rounded-full",
                  "border-2 transition-all shadow-chunky-press",
                  "font-mono text-[10px] font-bold tracking-[0.1em] uppercase",
                  "bg-grvd-gold/15 border-grvd-gold/50 text-grvd-gold hover:bg-grvd-gold/25",
                  "cursor-pointer",
                ].join(" ")}
              >
                +{amount} xp
              </button>
            ))}
          </div>

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
