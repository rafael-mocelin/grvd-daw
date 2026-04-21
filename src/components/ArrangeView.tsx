/**
 * ArrangeView — song arrangement with moving playhead.
 *
 * Sections follow DJ/hip-hop phrase logic (8-bar phrases):
 *   INTRO(4) → VERSE(8) → HOOK(4) → CHORUS(4) → BRIDGE(4) → OUTRO(4)
 *   HOOK + CHORUS are unlocked from the start (= the playable 8-bar loop).
 *   Others unlock progressively via XP thresholds.
 *
 * - Click a colored section block to mute/unmute that layer in that section.
 *   The RAF loop detects which section the playhead is in each frame and
 *   applies mute state live to the audio engine — so the same instrument
 *   plays in some sections but not others within the same loop.
 *
 * - Play ▶ / ■ actually calls playSong / stopSong on the engine.
 *
 * - Playhead sweeps only within unlocked sections and maps its X position
 *   to the correct section column in the ruler.
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

/* -------------------------------------------------------------------------- */
/* Section definitions                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Music-theory rationale:
 * Hip-hop / trap works in 4-bar and 8-bar phrases (the "8-bar rule").
 * DJs mix on phrase boundaries — always in multiples of 8 bars.
 * An 8-bar phrase = 1 "unit" of musical thought.
 *
 * Structure: INTRO(4) | VERSE(8) | HOOK(4) | CHORUS(4) | BRIDGE(4) | OUTRO(4)
 *   - HOOK + CHORUS together = 8 bars = 1 complete 8-bar phrase → unlocked
 *   - VERSE = 8 bars (second full phrase) → locked behind 150 XP
 *   - Intro / Bridge / Outro are 4-bar transition phrases → locked behind more
 *
 * The transport loop covers the HOOK+CHORUS = 8 bars.
 * Per-section muting lets you drop layers on the HOOK only, or CHORUS only.
 */
interface SectionDef {
  id: string;
  label: string;
  bars: number;
  color: string;
  baseUnlocked: boolean;  // true = free from start
  xpRequired: number;     // 0 if baseUnlocked
}

const SECTIONS: SectionDef[] = [
  { id: "intro",  label: "INTRO",  bars: 4, color: "#4f46e5", baseUnlocked: false, xpRequired: 600  },
  { id: "verse",  label: "VERSE",  bars: 8, color: "#7c3aed", baseUnlocked: false, xpRequired: 800  },
  { id: "hook",   label: "HOOK",   bars: 4, color: "#db2777", baseUnlocked: true,  xpRequired: 0    },
  { id: "chorus", label: "CHORUS", bars: 4, color: "#9333ea", baseUnlocked: true,  xpRequired: 0    },
  { id: "bridge", label: "BRIDGE", bars: 4, color: "#0891b2", baseUnlocked: false, xpRequired: 1200 },
  { id: "outro",  label: "OUTRO",  bars: 4, color: "#4f46e5", baseUnlocked: false, xpRequired: 2000 },
];

const LAYER_COLORS: Record<string, string> = {
  drums:  "#4f46e5",
  kick:   "#4f46e5",
  snare:  "#7c3aed",
  hat:    "#6d28d9",
  "808":  "#db2777",
  sample: "#0891b2",
  melody: "#059669",
  vocal:  "#d97706",
};

const BAR_PX  = 18;
const TRACK_H = 44;
const HEADER_H = 26;
const LABEL_W  = 80;

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
  } = useStore();

  /*
   * arrangeMutes lives in the Zustand store so it survives re-renders,
   * is included when the song is saved, and stays consistent across tabs.
   * Keyed by "kind:sectionId" — kind is stable across sound swaps.
   */
  const muted = arrangeMutes;

  /* playhead visual position in bars (within the unlocked timeline) */
  const [headBars, setHeadBars] = useState(0);

  /* loading guard while playSong async resolves */
  const [loading, setLoading] = useState(false);

  const rafRef      = useRef<number | null>(null);
  const rulerRef    = useRef<HTMLDivElement>(null);
  const mutedRef    = useRef(muted);
  const isSeekingRef = useRef(false);   // true while pointer is held on ruler/head
  mutedRef.current  = muted;            // keep RAF loop in sync without re-subscribing

  /* resolved sections (locked state may flip as XP increases) */
  const resolvedSections = SECTIONS.map((s) => ({
    ...s,
    locked: !s.baseUnlocked && totalXP < s.xpRequired,
  }));

  const unlockedSections = resolvedSections.filter((s) => !s.locked);
  const unlockedBars     = unlockedSections.reduce((n, s) => n + s.bars, 0);

  const bpm = activeTemplate?.bpm ?? 140;
  const BARS_PER_SECOND = bpm / 60 / 4;  // 4/4 time
  const loopDurationSecs = unlockedBars / BARS_PER_SECOND;

  /* pre-compute each section's cumulative left offset in canvas px */
  const sectionOffsets = (() => {
    const map: Record<string, number> = {};
    let x = 0;
    for (const s of resolvedSections) {
      map[s.id] = x;
      x += s.bars * BAR_PX;
    }
    return map;
  })();

  /* map transport bar position → screen X (relative to ruler left edge) */
  function barToScreenX(transportBar: number): number {
    let runningBar = 0;
    for (const s of unlockedSections) {
      if (transportBar < runningBar + s.bars) {
        return sectionOffsets[s.id] + (transportBar - runningBar) * BAR_PX;
      }
      runningBar += s.bars;
    }
    // Clamp to last unlocked section's right edge
    const last = unlockedSections[unlockedSections.length - 1];
    return last ? sectionOffsets[last.id] + last.bars * BAR_PX : 0;
  }

  /* which unlocked section does this transport bar fall in? */
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

  /* RAF loop ── move playhead + apply per-section mutes */
  const tick = useCallback(() => {
    const secs = getTransportSeconds();
    const loopedSecs = loopDurationSecs > 0 ? secs % loopDurationSecs : 0;
    const bar = loopedSecs * BARS_PER_SECOND;

    setHeadBars(bar);

    // Apply per-section mute state to engine (keyed by kind, stable across swaps)
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
      // Restore all layers to unmuted when stopped
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

  /*
   * Convert a clientX value into a transport seek position.
   *
   * The ruler div has paddingLeft=LABEL_W, so the section columns start
   * LABEL_W px from the ruler's left edge. sectionOffsets is relative to
   * the first section's left edge (i.e. 0-based from after the label column).
   * We must subtract both rect.left AND LABEL_W before comparing offsets.
   *
   * If the pointer is outside all unlocked sections we clamp to the
   * nearest unlocked boundary so dragging past the edge stays valid.
   */
  function seekFromClientX(clientX: number) {
    if (!rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();
    const relX  = clientX - rect.left - LABEL_W;   // px from section 0 left edge

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

    // Clamp: before first unlocked section
    const first = unlockedSections[0];
    if (first && relX < sectionOffsets[first.id]) {
      seekTransport(0);
      setHeadBars(0);
      return;
    }
    // Clamp: after last unlocked section
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

  /* toggle mute for a layer in a specific section (keyed by kind) */
  function toggleSectionMute(layerKind: string, sectionId: string) {
    const key = `${layerKind}:${sectionId}`;
    setArrangeMutes({ ...arrangeMutes, [key]: !arrangeMutes[key] });
  }

  /* play / stop */
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
          bars: unlockedBars,          // span HOOK+CHORUS = 8 bars
          keyRoot: activeTemplate?.keyRoot ?? "C",
          templateId: activeTemplate?.id ?? "",
          layers: [...layers],         // include vocal layer — engine handles null buffer gracefully
          tags: [],
          collaborators: [],
          createdAt: Date.now(),
        },
        vocalBuffer ?? null
      );
      setIsPlaying(true);
    } catch (err) {
      console.error("playSong failed", err);
    } finally {
      setLoading(false);
    }
  }

  /* ── Playhead screen X ── */
  const headScreenX = barToScreenX(headBars);

  /* ── elapsed time display ── */
  const elapsedSecs = headBars / BARS_PER_SECOND;
  const mm = String(Math.floor(elapsedSecs / 60)).padStart(2, "0");
  const ss = String(Math.floor(elapsedSecs % 60)).padStart(2, "0");

  if (!layers.length) {
    return (
      <div
        style={{
          padding: 32,
          color: "rgba(255,255,255,0.18)",
          fontFamily: "monospace",
          fontSize: 10,
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        pick your first sound<br />
        <span style={{ opacity: 0.5 }}>and watch it appear here</span>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 20px", overflowX: "auto", position: "relative", userSelect: "none" }}>

      {/* ── Transport header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingLeft: LABEL_W }}>
        <button
          onClick={handleTogglePlay}
          disabled={loading}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.15)",
            background: isPlaying
              ? "rgba(220,38,38,0.25)"
              : loading
              ? "rgba(255,255,255,0.05)"
              : "rgba(255,255,255,0.07)",
            color: isPlaying ? "#f87171" : "rgba(255,255,255,0.7)",
            fontSize: isPlaying ? 10 : 11,
            cursor: loading ? "wait" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
            boxShadow: isPlaying ? "0 0 10px rgba(220,38,38,0.4)" : "none",
          }}
        >
          {loading ? "…" : isPlaying ? "■" : "▶"}
        </button>
        <span style={{ fontSize: 8, fontFamily: "monospace", color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>
          {mm}:{ss} · BAR {Math.floor(headBars) + 1}
        </span>
        <span style={{ fontSize: 7, fontFamily: "monospace", color: "rgba(255,255,255,0.12)", marginLeft: "auto" }}>
          {bpm} BPM
        </span>
      </div>

      {/* ── Grid (ruler + tracks + playhead) ── */}
      <div style={{ position: "relative", display: "inline-block", minWidth: "100%" }}>

        {/* Section ruler — pointer down+drag to scrub */}
        <div
          ref={rulerRef}
          onPointerDown={onRulerPointerDown}
          onPointerMove={onRulerPointerMove}
          onPointerUp={onRulerPointerUp}
          onPointerCancel={onRulerPointerUp}
          style={{ display: "flex", paddingLeft: LABEL_W, marginBottom: 3, cursor: "col-resize" }}
        >
          {resolvedSections.map((s) => (
            <div
              key={s.id}
              style={{
                width: s.bars * BAR_PX,
                height: HEADER_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 1,
                fontSize: 7,
                fontFamily: "monospace",
                fontWeight: 800,
                letterSpacing: "0.1em",
                color: s.locked ? "rgba(255,255,255,0.15)" : s.color,
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                background: s.locked ? "rgba(255,255,255,0.012)" : "transparent",
                flexShrink: 0,
                position: "relative",
                cursor: s.locked ? "default" : "col-resize",
              }}
            >
              {s.locked ? (
                <>
                  <span style={{ opacity: 0.4, fontSize: 8 }}>🔒</span>
                  <span>{s.label}</span>
                  <span style={{ fontSize: 6, opacity: 0.4, marginTop: 1 }}>{s.xpRequired} XP</span>
                </>
              ) : (
                <span style={{ textShadow: `0 0 8px ${s.color}88` }}>{s.label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Track rows */}
        {layers.map((layer) => {
          const sound = getSound(layer.soundId);
          const trackColor = LAYER_COLORS[layer.kind] ?? "#7c3aed";

          return (
            <div
              key={layer.id}
              style={{ display: "flex", height: TRACK_H, alignItems: "center", marginBottom: 2 }}
            >
              {/* Label */}
              <div
                style={{
                  width: LABEL_W,
                  flexShrink: 0,
                  paddingRight: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: 26,
                    borderRadius: 2,
                    background: trackColor,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${trackColor}66`,
                  }}
                />
                <div>
                  <div style={{ fontSize: 8, fontFamily: "monospace", fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {KIND_LABEL[layer.kind]}
                  </div>
                  <div style={{ fontSize: 7, color: "rgba(255,255,255,0.2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 56 }}>
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
                        height: TRACK_H - 10,
                        marginLeft: 1,
                        marginRight: 1,
                        borderRadius: 5,
                        background: "rgba(255,255,255,0.012)",
                        border: "1px solid rgba(255,255,255,0.03)",
                        flexShrink: 0,
                      }}
                    />
                  );
                }

                return (
                  <div
                    key={s.id}
                    onClick={() => toggleSectionMute(layer.kind, s.id)}
                    style={{
                      width: blockW,
                      height: TRACK_H - 10,
                      marginLeft: 1,
                      marginRight: 1,
                      borderRadius: 5,
                      background: isMutedHere
                        ? "rgba(255,255,255,0.03)"
                        : `linear-gradient(135deg, ${trackColor}cc 0%, ${trackColor}77 100%)`,
                      border: `1px solid ${isMutedHere ? "rgba(255,255,255,0.07)" : trackColor + "66"}`,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                      overflow: "hidden",
                      flexShrink: 0,
                      transition: "all 0.12s",
                    }}
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
                              width: 1.5,
                              height: `${h}%`,
                              background: "rgba(255,255,255,0.22)",
                              borderRadius: 1,
                              top: "50%",
                              transform: "translateY(-50%)",
                            }}
                          />
                        );
                      })}
                    {isMutedHere && (
                      <span style={{ fontSize: 7, fontFamily: "monospace", fontWeight: 700, color: "rgba(255,255,255,0.13)", letterSpacing: "0.04em" }}>
                        off
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* ── Playhead — only over unlocked section area ── */}
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
              width: 18,            // wide hit-target
              marginLeft: -8,       // center the 2px line inside the hit-target
              height: "100%",
              cursor: "col-resize",
              zIndex: 10,
              transition: isPlaying && !isSeekingRef.current ? "none" : "left 0.04s",
              display: "flex",
              justifyContent: "center",
            }}
          >
            {/* Visible line */}
            <div style={{
              width: 2,
              height: "100%",
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 0 8px rgba(255,255,255,0.5), 0 0 20px rgba(255,255,255,0.12)",
              pointerEvents: "none",
              position: "relative",
            }}>
              {/* Triangle cap */}
              <div style={{
                position: "absolute",
                top: -1,
                left: "50%",
                transform: "translateX(-50%)",
                width: 0,
                height: 0,
                borderLeft: "5px solid transparent",
                borderRight: "5px solid transparent",
                borderTop: "7px solid rgba(255,255,255,0.9)",
              }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
