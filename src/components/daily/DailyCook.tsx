/**
 * DailyCook — the actual track-making screen for Daily Drop.
 *
 * The brief is fixed (BPM, key, palette, cap). The player taps sounds
 * from the palette to add them to the live mix; tapping again removes
 * them. All adds are phase-locked at master BPM via dailyEngine.
 *
 * A timer HUD counts down. At 0 OR when the player taps WRAP, the cook
 * phase ends and we transition to submit.
 *
 * Scope notes for the prototype:
 *  - No vocal stage. Today's prompt has vocalBudgetSec: 0.
 *  - No real arrangement (intro/verse/hook/outro) — picks loop forever.
 *  - No mix stage. The "mix" is just on/off per layer.
 * If the concept graduates, those slots wire into the existing recipe
 * flow rather than being expanded inline.
 */

import { useEffect } from "react";
import { TODAY_PROMPT } from "../../data/dailyPrompts";
import { useDailyStore } from "../../lib/dailyStore";
import { addLayer, removeLayer, getLayerCount } from "../../audio/dailyEngine";
import { REAL_SOUNDS } from "../../data/sounds";
import type { SoundOption } from "../../data/types";

interface DailyCookProps {
  onWrap: () => void;
  onQuit: () => void;
}

export function DailyCook({ onWrap, onQuit }: DailyCookProps) {
  const picks       = useDailyStore((s) => s.picks);
  const togglePick  = useDailyStore((s) => s.togglePick);
  const secondsLeft = useDailyStore((s) => s.secondsLeft);

  // Auto-wrap at 0
  useEffect(() => {
    if (secondsLeft <= 0) {
      const t = window.setTimeout(onWrap, 600);
      return () => window.clearTimeout(t);
    }
  }, [secondsLeft, onWrap]);

  function handleToggle(soundId: string) {
    const wasPicked = picks.includes(soundId);
    togglePick(soundId, TODAY_PROMPT.paletteCap);
    // Audio mirror: add or remove from the live mix.
    if (wasPicked) {
      removeLayer(soundId);
    } else {
      // togglePick respects the cap; if it didn't add (cap reached), the
      // audio side is also a no-op because addLayer is idempotent and
      // we'd never actually try to add a 5th when only 4 are tracked.
      const after = useDailyStore.getState().picks;
      if (after.includes(soundId)) {
        void addLayer(soundId, TODAY_PROMPT.bpm);
      }
    }
  }

  const palette = TODAY_PROMPT.palette
    .map((id) => REAL_SOUNDS.find((s) => s.id === id))
    .filter((s): s is SoundOption => !!s);

  const filled = picks.length;
  const cap    = TODAY_PROMPT.paletteCap;
  const canWrap = filled > 0;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* TIMER HUD — sticky top */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 14px",
          background:
            "linear-gradient(180deg, rgba(15, 24, 40, 0.95) 0%, rgba(15, 24, 40, 0.6) 100%)",
          borderBottom: "2px solid rgba(0,0,0,0.6)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <button
          onClick={onQuit}
          style={{
            padding: "5px 10px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Timer secondsLeft={secondsLeft} />
          <PalettePill filled={filled} cap={cap} />
        </div>
        <button
          onClick={onWrap}
          disabled={!canWrap}
          style={{
            padding: "8px 14px",
            borderRadius: 12,
            border: "2px solid #0a0f1c",
            background: canWrap
              ? "linear-gradient(180deg, #6bf395, #16a34a)"
              : "linear-gradient(180deg, #4a4a4a, #2a2a2a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: canWrap ? "pointer" : "not-allowed",
            opacity: canWrap ? 1 : 0.5,
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 3px 0 rgba(0,0,0,0.4)",
          }}
        >
          WRAP →
        </button>
      </div>

      {/* PALETTE GRID */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 14px 24px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          alignContent: "start",
        }}
      >
        {palette.map((sound) => (
          <SoundCard
            key={sound.id}
            sound={sound}
            picked={picks.includes(sound.id)}
            disabled={!picks.includes(sound.id) && filled >= cap}
            onClick={() => handleToggle(sound.id)}
          />
        ))}
      </div>

      {/* BRIEF FOOTER — keeps the constraint visible */}
      <div
        style={{
          flexShrink: 0,
          padding: "8px 14px 14px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.06em",
          textAlign: "center",
        }}
      >
        {TODAY_PROMPT.vibe} · {TODAY_PROMPT.bpm} BPM · {TODAY_PROMPT.key}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-bits                                                                    */
/* -------------------------------------------------------------------------- */

function Timer({ secondsLeft }: { secondsLeft: number }) {
  const min = Math.floor(secondsLeft / 60);
  const sec = secondsLeft % 60;
  // Color pulse — green > yellow > red as time runs out.
  const color = secondsLeft > 120 ? "#6bf395" : secondsLeft > 30 ? "#facc15" : "#E94560";
  const pulsing = secondsLeft <= 30;
  return (
    <div
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: "rgba(0,0,0,0.45)",
        border: `1.5px solid ${color}88`,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        fontWeight: 700,
        color,
        letterSpacing: "0.1em",
        animation: pulsing ? "dailyTimerPulse 0.7s ease-in-out infinite" : undefined,
      }}
    >
      {String(min).padStart(2, "0")}:{String(sec).padStart(2, "0")}
      <style>{`
        @keyframes dailyTimerPulse {
          0%, 100% { transform: scale(1);    }
          50%      { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}

function PalettePill({ filled, cap }: { filled: number; cap: number }) {
  return (
    <div
      style={{
        padding: "5px 11px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.06)",
        border: "1.5px solid rgba(255,255,255,0.16)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.85)",
        textTransform: "uppercase",
      }}
    >
      {filled} / {cap} sounds
    </div>
  );
}

interface SoundCardProps {
  sound:    SoundOption;
  picked:   boolean;
  disabled: boolean;
  onClick:  () => void;
}

function SoundCard({ sound, picked, disabled, onClick }: SoundCardProps) {
  const accent = picked ? "#E94560" : "rgba(0,0,0,0.5)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "12px 12px 10px",
        borderRadius: 16,
        border: `2.5px solid ${accent}`,
        background: picked
          ? "linear-gradient(180deg, rgba(233, 69, 96, 0.22), rgba(15, 24, 40, 0.85))"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.6), rgba(15, 24, 40, 0.6))",
        color: "#fff",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        boxShadow: picked
          ? "inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.4), 0 0 18px rgba(233, 69, 96, 0.4)"
          : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35)",
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.18s",
        transform: picked ? "scale(1.02)" : "scale(1)",
        // Allow the button's own font/letter-spacing rules to apply.
        font: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(0,0,0,0.4))",
            border: "1.5px solid #0a0f1c",
            display: "grid", placeItems: "center",
            fontSize: 18,
          }}
        >{sound.glyph}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 13, letterSpacing: 0.3, color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >{sound.name}</div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, color: "rgba(255,255,255,0.5)", marginTop: 2,
              textTransform: "uppercase", letterSpacing: "0.08em",
            }}
          >{sound.kind} · {sound.nativeBpm} bpm</div>
        </div>
        {picked && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, fontWeight: 700,
              padding: "3px 7px",
              borderRadius: 999,
              background: "rgba(233, 69, 96, 0.85)",
              border: "1.5px solid #0a0f1c",
              letterSpacing: "0.1em",
            }}
          >IN</div>
        )}
      </div>
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui",
          fontSize: 11, color: "rgba(255,255,255,0.6)",
          fontStyle: "italic", lineHeight: 1.4,
        }}
      >{sound.vibe}</div>
    </button>
  );
}
