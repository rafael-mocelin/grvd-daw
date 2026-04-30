/**
 * ArrangeView — song arrangement with playhead. Slice 1 redesign.
 *
 * Lives as its own dedicated post-Done page now (no more canvas window).
 * Every feature from the original preserved:
 *
 *   - ▶/■ play / stop with loading state
 *   - Live transport time (MM:SS · BAR n) + BPM
 *   - Section ruler with XP-gated unlock state (🔒 + required XP)
 *   - Per-layer per-section mute toggles (click a block to drop the layer
 *     in that section only; engine applies mute state on the fly via RAF)
 *   - Waveform-bar visualization inside unmuted blocks
 *   - Draggable playhead (pointer capture on ruler OR head)
 *   - Layer labels with kind + sound name + colored accent stripe
 *   - XP-progressive section unlocking
 *   - Stop restores all layers to unmuted
 *
 * Visuals (new): chunky primitives + GRVD palette tokens, glossy depth,
 * gradient section ribbons, mobile-first sticky transport bar at top.
 * The arrangement grid still scrolls horizontally — expected at this
 * level of musical detail; the chrome around it is the upgrade.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { useStore } from "../store/useStore";
import { getSound } from "../data/sounds";
import { KIND_LABEL } from "../data/types";
import {
  playSong,
  stopSong,
  updateMuteState,
  getTransportSeconds,
  seekTransport,
} from "../audio/engine";
import { ChunkyPill } from "../ui/Chunky";
import { CreationToolbar } from "../ui/burst/CreationToolbar";

/* -------------------------------------------------------------------------- */
/* Section definitions (unchanged from original)                                */
/* -------------------------------------------------------------------------- */

interface SectionDef {
  id: string;
  label: string;
  bars: number;
  /** Brand-palette color the section block + ribbon use. */
  color: string;
  baseUnlocked: boolean;
  xpRequired: number;
}

/**
 * Section list — note that "hook" and "chorus" describe the same musical
 * idea (the repeating earworm), so they were merged into a single HOOK
 * column. To keep two unlocked sections out of the gate, VERSE is also
 * unlocked by default (was previously XP-gated). Net change vs. the
 * earlier shape: CHORUS removed, VERSE.baseUnlocked → true, xpRequired → 0.
 */
const SECTIONS: SectionDef[] = [
  { id: "intro",  label: "INTRO",  bars: 4, color: "#22d3ee", baseUnlocked: false, xpRequired: 600  },
  { id: "verse",  label: "VERSE",  bars: 8, color: "#a78bfa", baseUnlocked: true,  xpRequired: 0    },
  { id: "hook",   label: "HOOK",   bars: 4, color: "#ff4d9c", baseUnlocked: true,  xpRequired: 0    },
  { id: "bridge", label: "BRIDGE", bars: 4, color: "#4ade80", baseUnlocked: false, xpRequired: 1200 },
  { id: "outro",  label: "OUTRO",  bars: 4, color: "#fbbf24", baseUnlocked: false, xpRequired: 2000 },
];

const LAYER_COLORS: Record<string, string> = {
  drums:  "#a78bfa",
  kick:   "#a78bfa",
  snare:  "#ff4d9c",
  hat:    "#22d3ee",
  "808":  "#fb923c",
  sample: "#4ade80",
  melody: "#fbbf24",
  vocal:  "#ff4d9c",
};

const BAR_PX  = 22;   // bumped from 18 → 22 for better tap targets on mobile
const TRACK_H = 52;   // bumped from 44
const HEADER_H = 32;
const LABEL_W  = 92;

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export function ArrangeView() {
  const {
    layers,
    activeTemplate,
    vocalBuffer,
    isPlaying,
    setIsPlaying,
    totalXP,
    arrangeMutes,
    setArrangeMutes,
    setStage,
  } = useStore();

  const muted = arrangeMutes;
  const [headBars, setHeadBars] = useState(0);
  const [loading, setLoading]   = useState(false);

  const rafRef       = useRef<number | null>(null);
  const rulerRef     = useRef<HTMLDivElement>(null);
  const mutedRef     = useRef(muted);
  const isSeekingRef = useRef(false);
  mutedRef.current   = muted;

  const resolvedSections = SECTIONS.map((s) => ({
    ...s,
    locked: !s.baseUnlocked && totalXP < s.xpRequired,
  }));

  const unlockedSections = resolvedSections.filter((s) => !s.locked);
  const unlockedBars     = unlockedSections.reduce((n, s) => n + s.bars, 0);

  const bpm = activeTemplate?.bpm ?? 140;
  const BARS_PER_SECOND = bpm / 60 / 4;
  const loopDurationSecs = unlockedBars / BARS_PER_SECOND;

  const sectionOffsets = (() => {
    const map: Record<string, number> = {};
    let x = 0;
    for (const s of resolvedSections) {
      map[s.id] = x;
      x += s.bars * BAR_PX;
    }
    return map;
  })();

  function barToScreenX(transportBar: number): number {
    let runningBar = 0;
    for (const s of unlockedSections) {
      if (transportBar < runningBar + s.bars) {
        return sectionOffsets[s.id] + (transportBar - runningBar) * BAR_PX;
      }
      runningBar += s.bars;
    }
    const last = unlockedSections[unlockedSections.length - 1];
    return last ? sectionOffsets[last.id] + last.bars * BAR_PX : 0;
  }

  function sectionAtBar(transportBar: number): SectionDef | null {
    let runningBar = 0;
    for (const s of unlockedSections) {
      if (transportBar >= runningBar && transportBar < runningBar + s.bars) {
        return s;
      }
      runningBar += s.bars;
    }
    return null;
  }

  const tick = useCallback(() => {
    const secs = getTransportSeconds();
    const loopedSecs = loopDurationSecs > 0 ? secs % loopDurationSecs : 0;
    const bar = loopedSecs * BARS_PER_SECOND;

    setHeadBars(bar);

    const sec = sectionAtBar(bar);
    if (sec) {
      for (const layer of layers) {
        const shouldMute = !!mutedRef.current[`${layer.kind}:${sec.id}`];
        updateMuteState(layer.id, shouldMute);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, bpm, unlockedBars, loopDurationSecs, BARS_PER_SECOND]);

  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      for (const layer of layers) {
        updateMuteState(layer.id, false);
      }
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, tick, layers]);

  function seekFromClientX(clientX: number) {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const relX  = clientX - rect.left - LABEL_W;

    let runningBar = 0;
    for (const s of unlockedSections) {
      const x0 = sectionOffsets[s.id];
      const x1 = x0 + s.bars * BAR_PX;
      if (relX >= x0 && relX <= x1) {
        const barWithin = (relX - x0) / BAR_PX;
        const totalBar  = runningBar + barWithin;
        seekTransport(totalBar / BARS_PER_SECOND);
        setHeadBars(totalBar);
        return;
      }
      runningBar += s.bars;
    }
    const first = unlockedSections[0];
    if (first && relX < sectionOffsets[first.id]) {
      seekTransport(0);
      setHeadBars(0);
      return;
    }
    const last = unlockedSections[unlockedSections.length - 1];
    if (last && relX > sectionOffsets[last.id] + last.bars * BAR_PX) {
      const endBar = unlockedBars - 0.01;
      seekTransport(endBar / BARS_PER_SECOND);
      setHeadBars(endBar);
    }
  }

  function onRulerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    isSeekingRef.current = true;
    seekFromClientX(e.clientX);
  }
  function onRulerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSeekingRef.current) return;
    seekFromClientX(e.clientX);
  }
  function onRulerPointerUp() {
    isSeekingRef.current = false;
  }

  function toggleSectionMute(layerKind: string, sectionId: string) {
    const key = `${layerKind}:${sectionId}`;
    setArrangeMutes({ ...arrangeMutes, [key]: !arrangeMutes[key] });
  }

  async function handleTogglePlay() {
    if (isPlaying) {
      stopSong();
      setIsPlaying(false);
      setHeadBars(0);
      seekTransport(0);
      return;
    }
    if (!layers.length) return;
    setLoading(true);
    try {
      await playSong(
        {
          id: "arrange-preview",
          name: "preview",
          bpm,
          bars: unlockedBars,
          keyRoot: activeTemplate?.keyRoot ?? "C",
          templateId: activeTemplate?.id ?? "",
          layers: [...layers],
          tags: [],
          collaborators: [],
          createdAt: Date.now(),
        },
        vocalBuffer ?? null,
      );
      setIsPlaying(true);
    } catch (err) {
      console.error("playSong failed", err);
    } finally {
      setLoading(false);
    }
  }

  const headScreenX = barToScreenX(headBars);
  const elapsedSecs = headBars / BARS_PER_SECOND;
  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsedSecs % 60)).padStart(2, "0");

  /* -------------------------------------------------------------------------- */
  /* Empty state                                                                  */
  /* -------------------------------------------------------------------------- */

  if (!layers.length) {
    return (
      <div className="pt-4 pb-8 flex flex-col gap-4">
        <Header onBack={() => setStage(useStore.getState().editorReturnStage)} />
        {/* Toolbar still visible in the empty state so the player can
         *  hop back to cook even before they have any layers. */}
        <div className="px-1">
          <CreationToolbar />
        </div>
        <div className="mx-auto px-6 py-10 rounded-2xl bg-grvd-panel/60 border border-grvd-line text-center">
          <div className="text-4xl mb-2">🎚️</div>
          <div className="font-display text-lg text-white">no layers yet</div>
          <div className="font-sans text-grvd-purple/70 text-sm mt-1">
            cook a track first — its sections will arrange here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-8 flex flex-col gap-3">
      <Header onBack={() => setStage(useStore.getState().editorReturnStage)} />

      {/* Persistent creation toolbar — same component lives on
       *  StackingView and MixerView so the player hops between the
       *  three without losing audio. */}
      <div className="px-1">
        <CreationToolbar />
      </div>

      {/* ── Sticky transport bar ──
       * Sits just below the HUD (height comes from --hud-h on PageShell). */}
      <div
        className={[
          "sticky z-20 mx-auto",
          "rounded-2xl bg-grvd-panel border border-grvd-line shadow-chunky-press",
          "px-3 py-2.5 flex items-center gap-3 w-full max-w-[420px]",
        ].join(" ")}
        style={{ top: "var(--hud-h, 64px)" }}
      >
        <button
          onClick={handleTogglePlay}
          disabled={loading}
          className={[
            "shrink-0 w-11 h-11 rounded-full grid place-items-center",
            isPlaying
              ? "bg-grvd-magenta shadow-glow-magenta"
              : "bg-grvd-purple shadow-glow-purple",
            "text-white font-display text-base",
            "shadow-chunky active:shadow-chunky-press active:translate-y-[1px]",
            "disabled:opacity-50",
          ].join(" ")}
        >
          {loading ? "…" : isPlaying ? "■" : "▶"}
        </button>

        <div className="flex flex-col leading-tight">
          <span className="font-display text-white text-base tabular-nums">
            {mm}:{ss}
          </span>
          <span className="font-sans text-grvd-purple/75 text-[10px] tracking-widest uppercase">
            BAR {Math.floor(headBars) + 1}
          </span>
        </div>

        <div className="ml-auto flex flex-col items-end leading-tight">
          <span className="font-display text-grvd-gold text-sm tabular-nums">
            {bpm}
          </span>
          <span className="font-sans text-grvd-purple/75 text-[10px] tracking-widest uppercase">
            bpm
          </span>
        </div>
      </div>

      {/* ── Arrangement grid ──
       * Full-width horizontal scroll (escapes PageShell's 480px column
       * via negative margin). Section ruler + per-layer rows + playhead. */}
      <div className="-mx-3 overflow-x-auto pl-3 pr-3 pb-2" style={{ userSelect: "none" }}>
        <div style={{ position: "relative", display: "inline-block", minWidth: "100%" }}>
          {/* Section ruler */}
          <div
            ref={rulerRef}
            onPointerDown={onRulerPointerDown}
            onPointerMove={onRulerPointerMove}
            onPointerUp={onRulerPointerUp}
            onPointerCancel={onRulerPointerUp}
            style={{ display: "flex", paddingLeft: LABEL_W, marginBottom: 6, cursor: "col-resize" }}
          >
            {resolvedSections.map((s) => (
              <SectionRibbon key={s.id} section={s} width={s.bars * BAR_PX} headerH={HEADER_H} />
            ))}
          </div>

          {/* Track rows */}
          {layers.map((layer) => {
            const sound = getSound(layer.soundId);
            const trackColor = LAYER_COLORS[layer.kind] ?? "#a78bfa";
            return (
              <div key={layer.id} style={{ display: "flex", height: TRACK_H, alignItems: "center", marginBottom: 4 }}>
                {/* Layer label */}
                <div
                  style={{
                    width: LABEL_W,
                    flexShrink: 0,
                    paddingRight: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 4, height: 32, borderRadius: 2,
                      background: trackColor,
                      flexShrink: 0,
                      boxShadow: `0 0 8px ${trackColor}88`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="font-display text-white text-[11px] uppercase tracking-wider leading-none">
                      {KIND_LABEL[layer.kind]}
                    </div>
                    <div className="font-sans text-white/55 text-[10px] truncate" style={{ maxWidth: 64 }}>
                      {sound?.name ?? "—"}
                    </div>
                  </div>
                </div>

                {/* Section blocks */}
                {resolvedSections.map((s) => {
                  const blockW = s.bars * BAR_PX - 2;
                  const isMutedHere = !!muted[`${layer.kind}:${s.id}`];

                  if (s.locked) {
                    return (
                      <div
                        key={s.id}
                        style={{
                          width: blockW,
                          height: TRACK_H - 12,
                          marginLeft: 1,
                          marginRight: 1,
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.02)",
                          border: "1px dashed rgba(255,255,255,0.06)",
                          flexShrink: 0,
                        }}
                      />
                    );
                  }

                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleSectionMute(layer.kind, s.id)}
                      style={{
                        width: blockW,
                        height: TRACK_H - 12,
                        marginLeft: 1,
                        marginRight: 1,
                        borderRadius: 8,
                        background: isMutedHere
                          ? "rgba(255,255,255,0.04)"
                          : `linear-gradient(135deg, ${trackColor}dd 0%, ${trackColor}88 100%)`,
                        border: `1px solid ${isMutedHere ? "rgba(255,255,255,0.08)" : trackColor + "88"}`,
                        cursor: "pointer",
                        position: "relative",
                        overflow: "hidden",
                        flexShrink: 0,
                        boxShadow: isMutedHere
                          ? "none"
                          : `0 4px 0 0 rgba(0,0,0,0.25), 0 0 12px ${trackColor}44, inset 0 1px 0 rgba(255,255,255,0.25)`,
                        transition: "all 0.12s",
                      }}
                      className="active:translate-y-[1px] active:shadow-chunky-press"
                    >
                      {!isMutedHere &&
                        Array.from({ length: Math.max(1, s.bars * 2) }).map((_, i) => {
                          const total = s.bars * 2;
                          const h = 28 + 42 * Math.sin((i / total) * Math.PI);
                          return (
                            <div
                              key={i}
                              style={{
                                position: "absolute",
                                left: `${(i / total) * 100}%`,
                                width: 2,
                                height: `${h}%`,
                                background: "rgba(255,255,255,0.32)",
                                borderRadius: 1.5,
                                top: "50%",
                                transform: "translateY(-50%)",
                              }}
                            />
                          );
                        })}
                      {isMutedHere && (
                        <span className="absolute inset-0 grid place-items-center font-display text-[10px] text-white/30 tracking-widest">
                          OFF
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* Playhead */}
          {unlockedSections.length > 0 && (
            <div
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                isSeekingRef.current = true;
                seekFromClientX(e.clientX);
              }}
              onPointerMove={(e) => {
                if (!isSeekingRef.current) return;
                seekFromClientX(e.clientX);
              }}
              onPointerUp={() => { isSeekingRef.current = false; }}
              onPointerCancel={() => { isSeekingRef.current = false; }}
              style={{
                position: "absolute",
                top: 0,
                left: LABEL_W + headScreenX,
                width: 24,
                marginLeft: -11,
                height: "100%",
                cursor: "col-resize",
                zIndex: 10,
                transition: isPlaying && !isSeekingRef.current ? "none" : "left 0.04s",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 3,
                  height: "100%",
                  background: "linear-gradient(180deg, #fbbf24 0%, #ff4d9c 100%)",
                  borderRadius: 2,
                  boxShadow: "0 0 12px rgba(255,77,156,0.7), 0 0 24px rgba(251,191,36,0.4)",
                  pointerEvents: "none",
                  position: "relative",
                }}
              >
                {/* Triangle cap */}
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 0,
                    height: 0,
                    borderLeft: "7px solid transparent",
                    borderRight: "7px solid transparent",
                    borderTop: "9px solid #fbbf24",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helper hint at bottom */}
      <div className="px-3 mt-1 font-sans text-[11px] text-grvd-purple/65 leading-snug">
        tap a block to drop the layer in that section. drag the playhead to scrub.
        🔒 sections unlock with XP.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                       */
/* -------------------------------------------------------------------------- */

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-1">
      <ChunkyPill onClick={onBack} icon="←" size="sm">
        back
      </ChunkyPill>
      <span className="font-display text-grvd-purple text-[11px] tracking-widest uppercase">
        🎚️ arrange
      </span>
      <span className="w-12" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionRibbon — chunky labeled column header                                 */
/* -------------------------------------------------------------------------- */

function SectionRibbon({
  section, width, headerH,
}: { section: SectionDef & { locked: boolean }; width: number; headerH: number }) {
  const locked = section.locked;
  return (
    <div
      style={{
        width,
        height: headerH,
        flexShrink: 0,
        // One line — both locked and unlocked. The previous locked layout
        // stacked 🔒 / LABEL / XP across three rows which clipped against
        // the 32 px ribbon height; the lock glyph and XP text overflowed
        // the frame on mobile. Single horizontal row keeps every glyph
        // inside the box.
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        marginRight: 2,
        borderRadius: 8,
        background: locked
          ? "rgba(255,255,255,0.04)"
          : `linear-gradient(135deg, ${section.color}aa 0%, ${section.color}55 100%)`,
        border: locked
          ? "1px dashed rgba(255,255,255,0.10)"
          : `1px solid ${section.color}aa`,
        boxShadow: locked
          ? "none"
          : `0 2px 0 0 rgba(0,0,0,0.25), 0 0 10px ${section.color}33, inset 0 1px 0 rgba(255,255,255,0.25)`,
        cursor: locked ? "default" : "col-resize",
        position: "relative",
        padding: "0 4px",
        overflow: "hidden",
      }}
    >
      {locked ? (
        // Compact single-line lock pill: 🔒 followed by required XP.
        // The section label is dropped here because column position
        // already implies which section it is, and we'd rather give
        // the player the actionable info (how much XP to unlock) than
        // the label they can't interact with anyway.
        <>
          <span style={{ fontSize: 10, lineHeight: 1, opacity: 0.7 }}>🔒</span>
          <span
            className="font-sans text-white/45"
            style={{ fontSize: 9, fontWeight: 600, lineHeight: 1, whiteSpace: "nowrap" }}
          >
            {section.xpRequired} XP
          </span>
        </>
      ) : (
        <span
          className="font-display text-[10px] text-white tracking-widest"
          style={{ textShadow: `0 0 6px ${section.color}cc`, lineHeight: 1 }}
        >
          {section.label}
        </span>
      )}
    </div>
  );
}
