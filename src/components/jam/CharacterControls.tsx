/**
 * CharacterControls — floating popover above a tapped Jam character.
 *
 * Three actions, one slot:
 *   - Mute toggle (also toggled by tapping the character itself)
 *   - Volume slider (0–2, default 1; >1.2 triggers the lightning VFX
 *     on the character)
 *   - Clear — removes the assigned sound, slot goes empty again
 *
 * Anchored above the character; tapping outside dismisses (handled by
 * the parent JamView via a backdrop layer).
 */

import type { SoundOption } from "../../data/types";

interface CharacterControlsProps {
  sound:    SoundOption | null;
  muted:    boolean;
  volume:   number;
  /** Vocal slots only: whether the recording follows the master BPM
   *  (true) or stays at its recorded tempo (false). The toggle is
   *  rendered only when sound.kind === "vocal". */
  syncToBpm?:    boolean;
  onSyncToggle?: () => void;
  onMuteToggle: () => void;
  onVolume:     (v: number) => void;
  onClear:      () => void;
  onClose:      () => void;
  /** Anchor position in the parent's coord space (px from top-left). */
  anchorLeft: number;
  anchorTop:  number;
}

export function CharacterControls({
  sound, muted, volume, syncToBpm,
  onMuteToggle, onVolume, onSyncToggle, onClear, onClose,
  anchorLeft, anchorTop,
}: CharacterControlsProps) {
  const isVocal = sound?.kind === "vocal";
  return (
    <>
      {/* Backdrop — captures outside-clicks to dismiss. Transparent so
       *  the studio backdrop stays visible. */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 50,
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: anchorLeft,
          top:  anchorTop,
          transform: "translate(-50%, calc(-100% - 16px))",
          zIndex: 60,
          width: 220,
          padding: "12px 14px",
          borderRadius: 16,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 4px 0 rgba(0,0,0,0.5), 0 12px 28px rgba(0,0,0,0.5)",
          animation: "jamPanelPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* Header — sound name + close X */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 18, lineHeight: 1 }}>{sound?.glyph ?? "🎵"}</span>
          <span
            style={{
              flex: 1,
              fontFamily: "'Lilita One', system-ui",
              fontSize: 14,
              color: "#fff",
              letterSpacing: 0.3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sound?.name ?? "EMPTY SLOT"}
          </span>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 22, height: 22, borderRadius: 11,
              border: "1.5px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.7)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Mute toggle — chunky pill */}
        <button
          onClick={onMuteToggle}
          disabled={!sound}
          style={{
            width: "100%",
            padding: "9px 10px",
            marginBottom: 10,
            borderRadius: 12,
            border: "2px solid #0a0f1c",
            background: muted
              ? "linear-gradient(180deg, #4a4a4a, #2a2a2a)"
              : "linear-gradient(180deg, #ff7a8e, #b8253a)",
            color: "#fff",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: sound ? "pointer" : "not-allowed",
            opacity: sound ? 1 : 0.4,
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.3), 0 3px 0 rgba(0,0,0,0.45)",
          }}
        >
          {muted ? "🙈 MUTED — TAP TO UNMUTE" : "🎤 MUTE"}
        </button>

        {/* Volume slider with VFX threshold marker */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color: "rgba(255,255,255,0.6)",
                textTransform: "uppercase",
              }}
            >
              Volume
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                fontWeight: 700,
                color: volume > 1.2 ? "#facc15" : "#fff",
              }}
            >
              {volume > 1.2 ? "⚡ LOUD" : Math.round(volume * 100) + "%"}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={volume}
            disabled={!sound}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            style={{
              width: "100%",
              accentColor: volume > 1.2 ? "#facc15" : "#E94560",
              opacity: sound ? 1 : 0.4,
            }}
          />
        </div>

        {/* Sync to BPM — vocal slots only. Toggles whether the
         *  recording rate-stretches with the master BPM (ON, pitch
         *  shifts) or stays at its recorded tempo (OFF). Default off
         *  so existing recordings don't change unexpectedly when the
         *  player nudges the master BPM. */}
        {isVocal && onSyncToggle && (
          <button
            onClick={onSyncToggle}
            style={{
              width: "100%",
              padding: "9px 10px",
              marginBottom: 8,
              borderRadius: 12,
              border: "2px solid #0a0f1c",
              background: syncToBpm
                ? "linear-gradient(180deg, #6bf395, #16a34a)"
                : "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
              color: syncToBpm ? "#0a0f1c" : "rgba(255,255,255,0.85)",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 12,
              letterSpacing: 0.5,
              cursor: "pointer",
              boxShadow: syncToBpm
                ? "inset 0 2px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 rgba(0,0,0,0.45)"
                : "inset 0 2px 0 rgba(255,255,255,0.06), 0 3px 0 rgba(0,0,0,0.35)",
            }}
            aria-pressed={syncToBpm}
          >
            {syncToBpm ? "🔗 SYNC TO BPM — ON" : "🔓 SYNC TO BPM — OFF"}
          </button>
        )}

        {/* Clear slot */}
        <button
          onClick={onClear}
          disabled={!sound}
          style={{
            width: "100%",
            padding: "7px 10px",
            borderRadius: 10,
            border: "1.5px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: sound ? "pointer" : "not-allowed",
            opacity: sound ? 1 : 0.4,
          }}
        >
          ✕ Clear slot
        </button>

        {/* Tail pointer pointing down at the character */}
        <div
          style={{
            position: "absolute",
            bottom: -10,
            left: "50%",
            transform: "translateX(-50%) rotate(45deg)",
            width: 16, height: 16,
            background: "#0f1828",
            border: "2.5px solid #0a0f1c",
            borderTop: "none",
            borderLeft: "none",
          }}
        />

        <style>{`
          @keyframes jamPanelPop {
            0%   { transform: translate(-50%, calc(-100% - 8px)) scale(0.9); opacity: 0; }
            100% { transform: translate(-50%, calc(-100% - 16px)) scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}
