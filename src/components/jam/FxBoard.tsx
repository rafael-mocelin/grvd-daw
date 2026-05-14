/**
 * FxBoard — full-screen overlay listing the player's effect tiles
 * for the open character. Opened from a single 🎛 EFFECTS button in
 * the character's controls popover.
 *
 * Each tile is image-first (big icon glyph), name-second (single
 * word). Tapping an UNLOCKED tile opens FxPluginPopup — a branded,
 * plugin-style popup with the effect's own face (big knob, blurb,
 * brand chrome). The jam audio keeps playing the whole time so the
 * player can actually hear what twisting the knob does.
 *
 * Locked tiles reuse the same visual language as the JamArrange
 * section locks — dashed border, dim icon, "🔒 600 XP" chip in
 * mono font. Tapping a locked tile shows a short toast ("progress
 * more to unlock") that auto-clears.
 */

import { useState } from "react";
import type { FxDef } from "../../data/jamFx";
import { FxPluginPopup } from "./FxPluginPopup";

export interface FxBoardEntry {
  def:    FxDef;
  locked: boolean;
  amount: number;     // 0..1, only used when !locked
}

interface FxBoardProps {
  /** Title displayed at the top — usually the character name (e.g.,
   *  "VANESSA · EFFECTS") so the player remembers whose FX they're
   *  tweaking. */
  title:    string;
  entries:  FxBoardEntry[];
  onChange: (fxId: string, amount: number) => void;
  onClose:  () => void;
}

export function FxBoard({ title, entries, onChange, onClose }: FxBoardProps) {
  /** Short auto-fading toast — fires when the player taps a locked
   *  tile. Cleared after ~2 s. */
  const [toast, setToast] = useState<string | null>(null);
  function flashToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2000);
  }

  /** Which FX tile currently has its plugin popup open. null = none. */
  const [openFxId, setOpenFxId] = useState<string | null>(null);
  const openEntry = openFxId ? entries.find((e) => e.def.id === openFxId) ?? null : null;

  return (
    <>
      {/* Backdrop — translucent so the room stays vaguely visible
       *  in the background. Click outside to close. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 500,
          background: "rgba(8, 12, 24, 0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "fxBoardFadeIn 0.18s ease-out",
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left:  "50%",
          top:   "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 501,
          width: "min(94vw, 540px)",
          maxHeight: "82vh",
          overflowY: "auto",
          padding: "18px 18px 20px",
          borderRadius: 22,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 18px 38px rgba(0,0,0,0.6), 0 0 28px rgba(250, 204, 21, 0.30)",
          animation: "fxBoardPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* Header — title + back/close */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <button
            onClick={onClose}
            aria-label="back"
            style={{
              width: 30, height: 30, borderRadius: 15,
              border: "2px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
              marginRight: 8,
            }}
          >
            ←
          </button>
          <span style={{ fontSize: 22, marginRight: 8 }}>🎛</span>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 20,
              color: "#fff",
              letterSpacing: 0.6,
              textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 14px rgba(250, 204, 21, 0.55)",
            }}
          >
            {title}
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 30, height: 30, borderRadius: 15,
              border: "2px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          tap a tile to open · 🔒 needs more XP
        </div>

        {/* Tile grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          {entries.map((e) => (
            <FxTile
              key={e.def.id}
              entry={e}
              onOpen={() => setOpenFxId(e.def.id)}
              onLockedTap={() => flashToast(`PROGRESS — NEED ${e.def.xpRequired} XP`)}
            />
          ))}
        </div>

        {toast && (
          <div
            style={{
              position: "fixed",
              left: "50%",
              bottom: 32,
              transform: "translateX(-50%)",
              zIndex: 510,
              padding: "8px 16px",
              borderRadius: 14,
              background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
              border: "2px solid #f3c44a",
              boxShadow: "0 4px 0 rgba(0,0,0,0.5), 0 0 18px rgba(243, 196, 74, 0.5)",
              color: "#fff",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textAlign: "center",
              maxWidth: "82vw",
              pointerEvents: "none",
              animation: "fxToastIn 0.18s ease-out",
            }}
          >
            🔒 {toast}
          </div>
        )}

        <style>{`
          @keyframes fxBoardFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes fxBoardPop {
            0%   { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          }
          @keyframes fxToastIn {
            0%   { transform: translate(-50%, 8px); opacity: 0; }
            100% { transform: translate(-50%, 0);   opacity: 1; }
          }
        `}</style>
      </div>

      {/* Branded plugin popup — sits on top of the FxBoard. Closing it
       *  leaves the FxBoard open so the player can poke another tile. */}
      {openEntry && !openEntry.locked && (
        <FxPluginPopup
          fx={openEntry.def}
          amount={openEntry.amount}
          onChange={(amount) => onChange(openEntry.def.id, amount)}
          onClose={() => setOpenFxId(null)}
        />
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* FxTile — one effect tile in the grid.                                       */
/* -------------------------------------------------------------------------- */

function FxTile({
  entry,
  onOpen,
  onLockedTap,
}: {
  entry:       FxBoardEntry;
  onOpen:      () => void;
  onLockedTap: () => void;
}) {
  const { def, locked, amount } = entry;

  if (locked) {
    return (
      <button
        onClick={onLockedTap}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: 10,
          borderRadius: 12,
          background: "rgba(0, 0, 0, 0.25)",
          border: "1.5px dashed rgba(255,255,255,0.18)",
          cursor: "pointer",
          color: "inherit",
          font: "inherit",
          userSelect: "none",
        }}
        aria-label={`locked — ${def.name}`}
      >
        <div
          style={{
            width: "100%",
            aspectRatio: "1 / 1",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1.5px dashed rgba(255,255,255,0.18)",
            display: "grid",
            placeItems: "center",
            fontSize: 36,
            opacity: 0.35,
            filter: "grayscale(1)",
          }}
        >
          {def.icon}
        </div>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: 0.4,
            marginTop: 2,
          }}
        >
          {def.name}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.10em",
            textTransform: "uppercase",
          }}
        >
          🔒 {def.xpRequired} XP
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 4,
        padding: 10,
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(36, 51, 88, 0.7) 0%, rgba(15, 24, 40, 0.7) 100%)",
        border: "2px solid rgba(250, 204, 21, 0.45)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.4), 0 0 14px rgba(250, 204, 21, 0.20)",
        userSelect: "none",
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
        textAlign: "left",
      }}
      aria-label={`open ${def.name}`}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: 10,
          background: "radial-gradient(ellipse at 50% 110%, rgba(250, 204, 21, 0.30), rgba(15, 24, 40, 0.7) 70%)",
          border: "1.5px solid #0a0f1c",
          display: "grid",
          placeItems: "center",
          fontSize: 48,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {def.icon}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            color: "#fff",
            letterSpacing: 0.4,
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          {def.name}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            color: amount > 0 ? "#facc15" : "rgba(255,255,255,0.4)",
            letterSpacing: "0.08em",
          }}
        >
          {Math.round(amount * 100)}%
        </div>
      </div>
    </button>
  );
}
