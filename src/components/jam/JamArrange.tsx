/**
 * JamArrange — floating section-based arrange timeline for the jam
 * stage. Ports the recipe DAW's ArrangeView pattern (intro / verse /
 * hook / bridge / outro with per-layer per-section mute toggles) to
 * the free-place jam model.
 *
 * Layout:
 *   - Floats over the bottom of the room (rendered inside Crib's
 *     overlay so the % positioning anchors to the room-square).
 *     Small horizontal margins + rounded corners on all sides so it
 *     reads as a panel, not a docked footer.
 *   - Section ribbon along the top — coloured pill per section with
 *     bar count + XP-locked state.
 *   - One row per placed character + the player (when filled). Each
 *     row = left character chip + N section blocks. Each block is a
 *     button: tap to drop that character during that section.
 *   - Vertical gold playhead sweeping all rows, fed every animation
 *     frame from Tone.Transport.seconds. Click + drag inside the
 *     lanes scrubs the master transport. On release the slot players
 *     re-stitch via resyncJamSlotsToTransport.
 *
 * Audio behaviour:
 *   - Total song length = sum of unlocked section bar counts.
 *   - The playhead loops through that length. While playing, RAF
 *     reads the current section and calls onSetSectionMute() on the
 *     parent for every (slot, section, mute) tuple. The parent maps
 *     that into jamEngine.setSlotMuted so the audio actually goes
 *     silent for the section the player muted.
 *   - Each character's underlying Tone.Player keeps looping at its
 *     own natural cadence — sections are a *visual* arrangement
 *     overlay implemented via dynamic mute (same approach the
 *     recipe DAW uses).
 *
 * XP gating:
 *   - The panel itself unlocks at ARRANGE_UNLOCK_XP (gate enforced
 *     by the parent JamView before mounting).
 *   - Inside the panel, individual sections (INTRO / BRIDGE / OUTRO)
 *     have their own XP thresholds. Locked sections render as dashed
 *     placeholders that can't be muted.
 */

import { useEffect, useRef, useState } from "react";
import {
  getJamMasterTransportSeconds,
  seekJamTransport,
  resyncJamSlotsToTransport,
} from "../../audio/jamEngine";
import { CHARACTER_SKINS, type CharacterKind } from "../../data/characterSkins";

const PLAYER_ICON = "/characters/player-guy/player-character.png";

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

export interface SectionDef {
  id:        string;
  label:     string;
  bars:      number;
  /** Hex colour used for the section ribbon + lane gradient. */
  color:     string;
  /** True = unlocked from the start. */
  baseUnlocked: boolean;
  /** XP required to unlock when not base-unlocked. */
  xpRequired: number;
}

/** Mirrors the recipe DAW's section list. HOOK & CHORUS were merged
 *  into a single repeating earworm; VERSE & HOOK are unlocked from
 *  the start so a fresh player has a usable 12-bar canvas. */
export const SECTIONS: SectionDef[] = [
  { id: "intro",  label: "INTRO",  bars: 4, color: "#22d3ee", baseUnlocked: false, xpRequired: 600  },
  { id: "verse",  label: "VERSE",  bars: 8, color: "#a78bfa", baseUnlocked: true,  xpRequired: 0    },
  { id: "hook",   label: "HOOK",   bars: 4, color: "#ff4d9c", baseUnlocked: true,  xpRequired: 0    },
  { id: "bridge", label: "BRIDGE", bars: 4, color: "#4ade80", baseUnlocked: false, xpRequired: 1200 },
  { id: "outro",  label: "OUTRO",  bars: 4, color: "#fbbf24", baseUnlocked: false, xpRequired: 2000 },
];

/* -------------------------------------------------------------------------- */
/* Row helpers                                                                 */
/* -------------------------------------------------------------------------- */

export interface ArrangeRow {
  /** Stable id; matches the audio engine's slotId. */
  slotId: string;
  /** Display name on the left chip. */
  name:   string;
  /** Image path used as the left chip icon. */
  iconSrc: string;
  /** True if the slot is globally muted (tap character → mute).
   *  When true the row paints in grey regardless of section mutes —
   *  global mute always wins over per-section mute. */
  globalMuted: boolean;
  /** Accent colour for the row chip + active blocks. */
  accent: string;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const ROW_H        = 42;       // height per arrange row
const LABEL_W      = 100;      // width of the left character chip column
const HEADER_H     = 24;       // height of the top label / transport row
const RIBBON_H     = 22;       // height of the section ribbon strip
const BAR_PX       = 14;       // pixels per bar in the timeline

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

interface JamArrangeProps {
  rows:      ArrangeRow[];
  bpm:       number;
  /** Player XP — drives section unlock state. */
  totalXP:   number;
  /** Per-(slot,section) mute state, keyed `${slotId}:${sectionId}`.
   *  true = silent during that section for that slot. */
  arrangeMutes: Record<string, boolean>;
  onToggleSectionMute: (slotId: string, sectionId: string) => void;
  /** Called every animation frame with the slot ids the engine
   *  should mute right now (combining global mute + arrange section
   *  mute for the current playhead position). Parent applies via
   *  jamEngine.setSlotMuted. */
  onApplyEffectiveMutes: (mutedSlotIds: Set<string>) => void;
}

export function JamArrange({
  rows,
  bpm,
  totalXP,
  arrangeMutes,
  onToggleSectionMute,
  onApplyEffectiveMutes,
}: JamArrangeProps) {
  /** Master transport seconds, repainted every animation frame. */
  const [transportSec, setTransportSec] = useState(0);
  const rafRef       = useRef<number | null>(null);
  const isSeekingRef = useRef(false);
  const lanesRef     = useRef<HTMLDivElement>(null);

  // Resolve section unlock state from totalXP.
  const resolvedSections = SECTIONS.map((s) => ({
    ...s,
    locked: !s.baseUnlocked && totalXP < s.xpRequired,
  }));
  const unlockedSections = resolvedSections.filter((s) => !s.locked);
  const unlockedBars     = unlockedSections.reduce((n, s) => n + s.bars, 0);

  // Section x-offsets (left edge of each section block in the lane).
  const sectionOffsets = (() => {
    const map: Record<string, number> = {};
    let x = 0;
    for (const s of resolvedSections) {
      map[s.id] = x;
      x += s.bars * BAR_PX;
    }
    return map;
  })();
  const totalLaneW = resolvedSections.reduce((n, s) => n + s.bars * BAR_PX, 0);

  // Total song duration in seconds (one full pass through the
  // unlocked sections at master BPM).
  const beatsPerSec = bpm / 60;
  const beatsPerBar = 4;
  const loopDur     = unlockedBars * beatsPerBar / beatsPerSec;

  /** Current bar position the playhead is at (in unlocked-bar
   *  coordinates — wraps cleanly back to 0 at loopDur). */
  const phaseSec = loopDur > 0 ? ((transportSec % loopDur) + loopDur) % loopDur : 0;
  const phaseBar = phaseSec * (beatsPerSec / beatsPerBar);

  /** Map a transport-bar position to its pixel x inside the lane.
   *  Walks the unlocked sections so the playhead naturally skips
   *  the (rendered but dashed-out) locked ones. */
  function barToScreenX(bar: number): number {
    let running = 0;
    for (const s of unlockedSections) {
      if (bar < running + s.bars) {
        return sectionOffsets[s.id] + (bar - running) * BAR_PX;
      }
      running += s.bars;
    }
    const last = unlockedSections[unlockedSections.length - 1];
    return last ? sectionOffsets[last.id] + last.bars * BAR_PX : 0;
  }

  /** Reverse: which UNLOCKED section is the current bar inside? */
  function sectionAtBar(bar: number): SectionDef | null {
    let running = 0;
    for (const s of unlockedSections) {
      if (bar >= running && bar < running + s.bars) return s;
      running += s.bars;
    }
    return null;
  }

  // ── Frame loop ──
  // Updates transport seconds for the visual playhead and applies
  // the effective mute set (global mute ∪ section mute for current
  // playhead position) up to the parent. The parent owns the actual
  // engine.setSlotMuted call — we just compute which slots should be
  // silent right now.
  useEffect(() => {
    const tick = () => {
      const t = getJamMasterTransportSeconds();
      setTransportSec(t);

      // Compute "who's muted right now" given the playhead position.
      if (loopDur > 0) {
        const localPhaseSec = ((t % loopDur) + loopDur) % loopDur;
        const localBar      = localPhaseSec * (beatsPerSec / beatsPerBar);
        const sec           = sectionAtBar(localBar);
        const muted         = new Set<string>();
        if (sec) {
          for (const row of rows) {
            if (row.globalMuted) {
              muted.add(row.slotId);
              continue;
            }
            const key = `${row.slotId}:${sec.id}`;
            if (arrangeMutes[key]) muted.add(row.slotId);
          }
        }
        onApplyEffectiveMutes(muted);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, arrangeMutes, loopDur, beatsPerSec]);

  // ── Scrub the master transport ──
  function seekFromClientX(clientX: number) {
    const lanes = lanesRef.current;
    if (!lanes) return;
    const rect = lanes.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    // Walk unlocked sections to find which bar position relX is on.
    let running = 0;
    for (const s of unlockedSections) {
      const x0 = sectionOffsets[s.id];
      const x1 = x0 + s.bars * BAR_PX;
      const scaledX0 = x0 * (rect.width / totalLaneW);
      const scaledX1 = x1 * (rect.width / totalLaneW);
      if (relX >= scaledX0 && relX <= scaledX1) {
        const barWithin = ((relX - scaledX0) / (scaledX1 - scaledX0)) * s.bars;
        const totalBar  = running + barWithin;
        const targetSec = totalBar * beatsPerBar / beatsPerSec;
        // Project into the current loop window — same approach as
        // the recipe DAW's ArrangeView.
        const cur            = getJamMasterTransportSeconds();
        const curWindowStart = loopDur > 0 ? Math.floor(cur / loopDur) * loopDur : 0;
        seekJamTransport(curWindowStart + targetSec);
        setTransportSec(curWindowStart + targetSec);
        return;
      }
      running += s.bars;
    }
  }
  function onLanesPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isSeekingRef.current = true;
    seekFromClientX(e.clientX);
  }
  function onLanesPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSeekingRef.current) return;
    seekFromClientX(e.clientX);
  }
  function onLanesPointerUp() {
    if (!isSeekingRef.current) return;
    isSeekingRef.current = false;
    resyncJamSlotsToTransport();
  }

  const headScreenPct = totalLaneW > 0 ? (barToScreenX(phaseBar) / totalLaneW) * 100 : 0;

  return (
    <div
      style={{
        // ── Float over the bottom of the room ──
        // Mounted inside Crib's overlay so the % values resolve
        // against the room-square (not the whole stage). Rounded
        // corners on all sides + drop shadow so it reads as a
        // hovering panel.
        position: "absolute",
        left:  "3%",
        right: "3%",
        bottom: "3%",
        zIndex: 8,
        padding: "8px 10px 10px",
        borderRadius: 16,
        background: "linear-gradient(180deg, rgba(15, 24, 40, 0.92) 0%, rgba(8, 12, 24, 0.96) 100%)",
        border: "2px solid rgba(0, 0, 0, 0.55)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 6px 0 rgba(0,0,0,0.5), 0 14px 30px rgba(0,0,0,0.55), 0 0 28px rgba(167, 139, 250, 0.18)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* ── Header — title + transport time ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: HEADER_H,
          paddingLeft: 4,
        }}
      >
        <span
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 12,
            color: "#fff",
            letterSpacing: 0.5,
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          🎚 ARRANGE
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: "rgba(255,255,255,0.55)",
            whiteSpace: "nowrap",
          }}
        >
          {fmtTime(phaseSec)} / {fmtTime(loopDur)} · BAR {Math.floor(phaseBar) + 1}/{unlockedBars} · {bpm} BPM
        </span>
      </div>

      {/* ── Section ribbon ── */}
      <div
        style={{
          display: "flex",
          paddingLeft: LABEL_W,
          marginTop: 2,
          marginBottom: 4,
          gap: 2,
        }}
      >
        {resolvedSections.map((s) => (
          <SectionRibbon key={s.id} section={s} flexBars={s.bars} />
        ))}
      </div>

      {/* ── Rows + lanes ── */}
      <div style={{ position: "relative", display: "flex" }}>
        {/* Left column — labels. */}
        <div style={{ width: LABEL_W, flexShrink: 0 }}>
          {rows.map((row) => (
            <RowLabel key={row.slotId} row={row} />
          ))}
        </div>

        {/* Right column — lanes (per-section blocks) + scrub area. */}
        <div
          ref={lanesRef}
          onPointerDown={onLanesPointerDown}
          onPointerMove={onLanesPointerMove}
          onPointerUp={onLanesPointerUp}
          onPointerCancel={onLanesPointerUp}
          style={{
            position: "relative",
            flex: 1,
            cursor: "col-resize",
            touchAction: "none",
          }}
        >
          {rows.map((row) => (
            <RowLane
              key={row.slotId}
              row={row}
              sections={resolvedSections}
              arrangeMutes={arrangeMutes}
              onToggleSectionMute={onToggleSectionMute}
            />
          ))}

          {/* Vertical playhead — full height across rows. */}
          {unlockedSections.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${headScreenPct}%`,
                width: 2,
                marginLeft: -1,
                background: "linear-gradient(180deg, #facc15, #fff)",
                boxShadow: "0 0 10px rgba(250, 204, 21, 0.95), 0 0 18px rgba(250, 204, 21, 0.5)",
                pointerEvents: "none",
                borderRadius: 1,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionRibbon — one coloured pill at the top, labelled with name + bars.   */
/* -------------------------------------------------------------------------- */

function SectionRibbon({ section, flexBars }: { section: SectionDef & { locked: boolean }; flexBars: number }) {
  return (
    <div
      style={{
        flex: flexBars,
        height: RIBBON_H,
        borderRadius: 8,
        background: section.locked
          ? "rgba(255,255,255,0.04)"
          : `linear-gradient(180deg, ${section.color}cc, ${section.color}66)`,
        border: section.locked
          ? "1px dashed rgba(255,255,255,0.18)"
          : `1px solid ${section.color}88`,
        display: "grid",
        placeItems: "center",
        boxShadow: section.locked
          ? "none"
          : `inset 0 1px 0 rgba(255,255,255,0.2), 0 0 8px ${section.color}55`,
      }}
    >
      <div
        style={{
          fontFamily: "'Lilita One', system-ui",
          fontSize: 9,
          color: section.locked ? "rgba(255,255,255,0.4)" : "#0a0f1c",
          letterSpacing: 0.4,
          textShadow: section.locked ? "none" : "0 1px 0 rgba(255,255,255,0.35)",
          whiteSpace: "nowrap",
        }}
      >
        {section.locked ? `🔒 ${section.xpRequired}xp` : `${section.label}`}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RowLabel — character thumbnail + name in the left column.                   */
/* -------------------------------------------------------------------------- */

function RowLabel({ row }: { row: ArrangeRow }) {
  return (
    <div
      style={{
        height: ROW_H,
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingRight: 6,
        opacity: row.globalMuted ? 0.4 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <div
        style={{
          width: 3,
          height: ROW_H - 14,
          borderRadius: 2,
          flexShrink: 0,
          background: row.accent,
          boxShadow: `0 0 6px ${row.accent}aa`,
        }}
      />
      <div
        style={{
          width: ROW_H - 20,
          height: ROW_H - 20,
          borderRadius: "50%",
          flexShrink: 0,
          overflow: "hidden",
          border: `1.5px solid ${row.accent}88`,
          background: `radial-gradient(ellipse at 50% 110%, ${row.accent}55, rgba(15, 24, 40, 0.7) 70%)`,
          display: "grid",
          placeItems: "center",
        }}
      >
        <img
          src={row.iconSrc}
          alt=""
          draggable={false}
          style={{
            width:  "130%",
            height: "130%",
            objectFit: "contain",
            objectPosition: "center 60%",
            pointerEvents: "none",
          }}
        />
      </div>
      <div style={{ minWidth: 0, lineHeight: 1.05 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 10,
            color: "#fff",
            letterSpacing: 0.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: "0 1px 0 rgba(0,0,0,0.55)",
          }}
        >
          {row.name}
        </div>
        {row.globalMuted && (
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 7,
              fontWeight: 700,
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.18em",
              marginTop: 1,
              textTransform: "uppercase",
            }}
          >
            muted
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* RowLane — N section blocks side by side, each tappable to toggle mute.     */
/* -------------------------------------------------------------------------- */

interface RowLaneProps {
  row:                  ArrangeRow;
  sections:             (SectionDef & { locked: boolean })[];
  arrangeMutes:         Record<string, boolean>;
  onToggleSectionMute:  (slotId: string, sectionId: string) => void;
}

function RowLane({ row, sections, arrangeMutes, onToggleSectionMute }: RowLaneProps) {
  return (
    <div
      style={{
        display: "flex",
        height: ROW_H,
        alignItems: "center",
        gap: 2,
      }}
    >
      {sections.map((s) => {
        const flex = s.bars;
        const key  = `${row.slotId}:${s.id}`;
        const sectionMuted = !!arrangeMutes[key];
        const dimmed = row.globalMuted || sectionMuted;

        if (s.locked) {
          return (
            <div
              key={s.id}
              style={{
                flex,
                height: ROW_H - 12,
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
                border: "1px dashed rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            />
          );
        }

        return (
          <button
            key={s.id}
            onClick={(e) => {
              e.stopPropagation();    // don't scrub when clicking a block
              if (row.globalMuted) return;
              onToggleSectionMute(row.slotId, s.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={row.globalMuted}
            style={{
              flex,
              height: ROW_H - 12,
              borderRadius: 8,
              border: `1px solid ${dimmed ? "rgba(255,255,255,0.08)" : s.color + "aa"}`,
              background: dimmed
                ? "rgba(255,255,255,0.03)"
                : `linear-gradient(135deg, ${s.color}dd 0%, ${s.color}88 100%)`,
              boxShadow: dimmed
                ? "none"
                : `0 3px 0 rgba(0,0,0,0.25), 0 0 10px ${s.color}33, inset 0 1px 0 rgba(255,255,255,0.22)`,
              cursor: row.globalMuted ? "not-allowed" : "pointer",
              padding: 0,
              position: "relative",
              overflow: "hidden",
              transition: "background 0.15s, box-shadow 0.15s",
            }}
            title={`${row.name} · ${s.label} — ${sectionMuted ? "muted" : "playing"}`}
          >
            {/* Waveform-bar visualisation when block is active. */}
            {!dimmed &&
              Array.from({ length: Math.max(2, s.bars * 2) }).map((_, i) => {
                const total = s.bars * 2;
                const h = 24 + 40 * Math.sin((i / total) * Math.PI);
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${((i + 0.5) / total) * 100}%`,
                      width: 2,
                      height: `${h}%`,
                      background: "rgba(255,255,255,0.30)",
                      borderRadius: 1.5,
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      pointerEvents: "none",
                    }}
                  />
                );
              })}
            {sectionMuted && !row.globalMuted && (
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.45)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  pointerEvents: "none",
                }}
              >
                off
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* fmtTime — MM:SS string used in the header. seconds are floored.            */
/* -------------------------------------------------------------------------- */

function fmtTime(secs: number): string {
  if (!isFinite(secs)) return "00:00";
  const total = Math.max(0, Math.floor(secs));
  const mm = String(Math.floor(total / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* -------------------------------------------------------------------------- */
/* Row helpers (re-exports for JamView)                                       */
/* -------------------------------------------------------------------------- */

export function playerArrangeRow(opts: {
  slotId:      string;
  globalMuted: boolean;
  filled:      boolean;
}): ArrangeRow | null {
  if (!opts.filled) return null;
  return {
    slotId:      opts.slotId,
    name:        "YOU",
    iconSrc:     PLAYER_ICON,
    globalMuted: opts.globalMuted,
    accent:      "#ff4d9c",
  };
}

export const ARRANGE_ACCENT: Record<CharacterKind, string> = {
  "drum-guy":   "#22d3ee",
  "beat-guy":   "#fb923c",
  "guitar-guy": "#4ade80",
};

export function characterIconFor(kind: CharacterKind, soundId: string): string {
  const skinSet = CHARACTER_SKINS[kind];
  const skin    = skinSet[soundId] ?? skinSet[Object.keys(skinSet)[0]];
  return skin.right;
}
