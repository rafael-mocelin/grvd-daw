/**
 * StackingView — the recipe-building UI inside the canvas Recipe window.
 *
 * Layout is SINGLE-COLUMN so it works at any window width without clipping.
 * Tailwind md:/lg: viewport-based breakpoints are intentionally avoided here —
 * this component lives inside a resizable CanvasWindow, not the full viewport.
 *
 * Structure (top → bottom):
 *   [Header: template info + play/abandon]
 *   [Recipe strip: horizontal scrollable step pills]
 *   [Divider]
 *   [Current kind heading + skip]
 *   [Sound cards: 1 or 2 columns depending on window width via CSS grid auto-fill]
 *   [Footer hint]
 *   [Companion needs (collapsed)]
 */

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { NeedsMeters } from "./NeedsMeters";
import { SOUNDS, ALL_SOUNDS, getDynamicSounds, getSound } from "../data/sounds";
import type { LayerKind } from "../data/types";
import { KIND_LABEL } from "../data/types";
import { ensureAudio, playSong, previewLayer, stopPreview, stopSong, updateMuteState } from "../audio/engine";
import { LAYER_XP } from "../data/achievements";

export function StackingView() {
  const {
    activeTemplate,
    layers,
    recipeIndex,
    pickLayer,
    swapLayer,
    setRecipeIndex,
    skipKind,
    abandon,
    setStage,
    setVocal,
    tamagotchi,
    setIsPlaying,
    addXP,
    sayLine,
    ownedSoundIds,
    activeCoopRow,
    userId,
  } = useStore();

  /* Phase 5.B step 7 — coop material union.
   *
   * In an active coop session the picker swaps from "what I own" to "what
   * the group owns combined." Each seat sees the partner's exclusive
   * producer drops alongside their own. The union is snapshotted at
   * session activation server-side; we read it via the live coop row.
   *
   * Outside coop, this returns null → picker uses ownedSoundIds as before. */
  const effectiveSoundIds: Set<string> | null = useMemo(() => {
    if (activeCoopRow?.status === "active" && activeCoopRow.availableSoundIds.length > 0) {
      return new Set(activeCoopRow.availableSoundIds);
    }
    return ownedSoundIds;
  }, [activeCoopRow, ownedSoundIds]);

  // For the shared-pool pill: how many of the union ids does the LOCAL
  // user already own (so we can show "your N + partner M = total").
  const coopBreakdown = useMemo(() => {
    if (!activeCoopRow || activeCoopRow.status !== "active") return null;
    const total = activeCoopRow.availableSoundIds.length;
    if (total === 0 || !ownedSoundIds) return null;
    const yours    = activeCoopRow.availableSoundIds.filter((id) => ownedSoundIds.has(id)).length;
    const partner  = total - yours;
    return { yours, partner, total };
  }, [activeCoopRow, ownedSoundIds]);

  // userId is read above so the picker re-derives if auth flips.
  void userId;

  const [playing,     setPlaying]     = useState(false);
  const [needsOpen,   setNeedsOpen]   = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const currentKind: LayerKind | null = useMemo(() => {
    if (!activeTemplate) return null;
    return activeTemplate.recipe[recipeIndex] ?? null;
  }, [activeTemplate, recipeIndex]);

  /* Phase 5.B step 6 — picker filters to the player's inventory.
   *
   * Logic:
   *   1. Pull template-suggested ids; resolve via getSound (covers static
   *      starter sounds AND producer drops registered at inventory load).
   *   2. If we have an owned-set, drop suggestions the player doesn't own
   *      AND backfill the kind section with the rest of THEIR inventory
   *      (starter + producer drops they've claimed).
   *   3. If the owned-set is null (guest mode, or pre-load), preserve the
   *      original behavior: full ALL_SOUNDS catalog, suggested-first.
   *
   * Producer drops register in the dynamic registry on inventory load, so
   * getSound + getDynamicSounds resolve them transparently here. */
  const suggestions = useMemo(() => {
    if (!activeTemplate || !currentKind) return [];
    const suggestedIds = activeTemplate.suggested[currentKind] ?? [];

    // Resolve suggested ids first.
    const suggested = suggestedIds
      .map((id) => getSound(id))
      .filter(Boolean) as ReturnType<typeof getSound>[];

    // Guest / pre-load: keep the original "everything in catalog" behavior.
    if (!effectiveSoundIds) {
      const hasReal = suggested.some((s) => s?.fileUrl);
      if (hasReal) return suggested;
      const others = SOUNDS.filter(
        (s) => s.kind === currentKind && !suggestedIds.includes(s.id),
      );
      return [...suggested, ...others];
    }

    // Owned-set (or coop union) known: filter suggestions + backfill with
    // every sound in the effective pool of this kind (static starters +
    // producer drops claimed or borrowed via coop).
    const allowedSuggested = suggested.filter((s) => s && effectiveSoundIds.has(s.id));

    const seen = new Set(allowedSuggested.map((s) => s!.id));
    const allowedRest = [...ALL_SOUNDS, ...getDynamicSounds()].filter(
      (s) => s.kind === currentKind
          && effectiveSoundIds.has(s.id)
          && !seen.has(s.id),
    );

    return [...allowedSuggested, ...allowedRest];
  }, [activeTemplate, currentKind, effectiveSoundIds]);

  // Sync to store so CanvasBoard wires know when audio is live
  useEffect(() => { setIsPlaying(playing); }, [playing, setIsPlaying]);

  // Stop audio on unmount
  useEffect(() => {
    return () => { stopSong(); setIsPlaying(false); };
  }, [setIsPlaying]);

  // Advance stage when recipe is complete
  useEffect(() => {
    if (!activeTemplate) return;
    if (recipeIndex >= activeTemplate.recipe.length) {
      const last = activeTemplate.recipe[activeTemplate.recipe.length - 1];
      if (last === "vocal") setStage("vocal");
      else setStage("name");
    }
  }, [recipeIndex, activeTemplate, setStage]);

  if (!activeTemplate) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "rgba(255,255,255,0.5)", fontFamily: "monospace", fontSize: 12 }}>
        no template selected.{" "}
        <button style={{ textDecoration: "underline", background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          onClick={() => setStage("template")}>
          pick one
        </button>
      </div>
    );
  }

  const progressPct     = Math.min(100, (recipeIndex / activeTemplate.recipe.length) * 100);
  const existingForKind = (kind: LayerKind) => layers.find((l) => l.kind === kind);

  async function startPlayback(tpl: typeof activeTemplate, songLayers: typeof layers) {
    if (!tpl) return;
    await playSong(
      {
        id: "preview", name: "preview",
        bpm: tpl.bpm, bars: tpl.bars, keyRoot: tpl.keyRoot,
        templateId: tpl.id,
        layers: songLayers.filter((l) => l.kind !== "vocal"),
        tags: tpl.tags, collaborators: [], createdAt: Date.now(),
      },
      null
    );
  }

  async function handleTogglePlay() {
    /* iOS/Safari: Tone.start() must be INVOKED inside the synchronous
     * portion of a user gesture. Calling ensureAudio() without awaiting
     * it here kicks off the unlock promise on the right stack frame;
     * later async audio work can safely assume the context is live. */
    ensureAudio();
    if (playing) { stopSong(); setPlaying(false); return; }
    if (!activeTemplate || !layers.length) return;
    stopPreview();
    await startPlayback(activeTemplate, layers);
    setPlaying(true);
  }

  async function handlePickOrSwap(
    soundId: string,
    variant: string,
    kind: LayerKind,
    clickX?: number,
    clickY?: number
  ) {
    /* Prime iOS audio context synchronously — picking a sound leads to
     * startPlayback() which needs the context already unlocked. */
    ensureAudio();
    const tpl = activeTemplate;
    if (!tpl) return;
    const existing = existingForKind(kind);
    const updatedLayers = existing
      ? layers.map((l) => (l.kind === kind ? { ...l, variant, soundId } : l))
      : [...layers, { id: `${kind}-${Date.now()}`, kind, variant, soundId }];
    pickLayer(kind, variant, soundId);
    if (!existing) {
      // First time picking this kind → award XP
      const xp = LAYER_XP[kind] ?? 0;
      if (xp > 0) addXP(xp, KIND_LABEL[kind], clickX, clickY);
      // DAW's reaction appears in the speech bubble above the mouth.
      sayLine(reactionLine(kind), 2200);
    }
    stopPreview();
    await startPlayback(tpl, updatedLayers);
    setPlaying(true);
  }

  /* ── render ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minWidth: 0 }}>

      {/* ── Header ── */}
      <div style={{
        padding: "12px 14px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Template chip */}
            <div style={{
              display: "inline-flex", alignItems: "center",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6, padding: "2px 8px",
              fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.55)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              maxWidth: "100%",
            }}>
              {activeTemplate.name} · {activeTemplate.bpm} bpm · {activeTemplate.bars} bars
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${progressPct}%`,
                  background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                  borderRadius: 3, transition: "width 0.3s",
                }} />
              </div>
              <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                {recipeIndex}/{activeTemplate.recipe.length}
              </span>
            </div>
          </div>

          {/* Play / Abandon */}
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              onClick={handleTogglePlay}
              disabled={!layers.length}
              style={pillBtn(playing ? "#7c3aed" : "rgba(255,255,255,0.08)")}
            >
              {playing ? "⏸" : "▶"}
            </button>
            <button onClick={abandon} style={pillBtn("rgba(255,255,255,0.06)")}>✕</button>
          </div>
        </div>
        {/* DAW reactions (e.g. "that's fat.") now appear in the speech bubble
            above the MouthWave at the bottom of the shell. */}
      </div>

      {/* ── Recipe strip: horizontal scrollable step pills ── */}
      <div style={{
        padding: "8px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          {activeTemplate.recipe.map((kind, i) => {
            const layer     = existingForKind(kind);
            const active    = i === recipeIndex;
            const clickable = !!layer && !active;
            return (
              <button
                key={kind + i}
                onClick={clickable ? () => setRecipeIndex(i) : undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "4px 10px",
                  borderRadius: 20,
                  border: active
                    ? "1.5px solid #7c3aed"
                    : layer
                      ? "1.5px solid rgba(255,255,255,0.15)"
                      : "1.5px solid rgba(255,255,255,0.06)",
                  background: active
                    ? "rgba(124,58,237,0.18)"
                    : layer
                      ? "rgba(255,255,255,0.05)"
                      : "transparent",
                  cursor: clickable ? "pointer" : "default",
                  transition: "all 0.15s",
                  boxShadow: active ? "0 0 10px rgba(124,58,237,0.35)" : "none",
                  flexShrink: 0,
                }}
              >
                <span style={{
                  fontFamily: "monospace", fontSize: 9, fontWeight: 700,
                  color: active ? "#a78bfa"
                    : layer ? "rgba(255,255,255,0.6)"
                    : "rgba(255,255,255,0.2)",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                }}>
                  {i + 1}
                </span>
                <span style={{
                  fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                  color: active ? "#fff"
                    : layer ? "rgba(255,255,255,0.65)"
                    : "rgba(255,255,255,0.25)",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {KIND_LABEL[kind]}
                </span>
                {layer && (
                  <span style={{ fontSize: 12 }}>{getSound(layer.soundId)?.glyph ?? "●"}</span>
                )}
                {active && !layer && (
                  <span style={{ fontSize: 9, color: "#a78bfa" }}>←</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable body: sound picker or "done" state ── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minWidth: 0, scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
        {currentKind === "vocal" ? (
          /* ── Vocal step: launch pad to VocalRecorder ── */
          <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 40 }}>🎤</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 900, color: "#fff", textAlign: "center" }}>
              time to drop the verse
            </div>
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.45)", textAlign: "center", maxWidth: 280, lineHeight: 1.6 }}>
              the beat's ready. rap along to the karaoke,
              or squad up with a friend to co-create.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 240 }}>
              <button
                onClick={() => setStage("vocal")}
                style={{
                  ...pillBtn("rgba(124,58,237,0.85)"),
                  padding: "10px 0", width: "100%",
                  boxShadow: "0 0 20px rgba(124,58,237,0.4)",
                  fontSize: 13, fontWeight: 900,
                }}
              >
                🎤 record the verse
              </button>
              <button
                onClick={() => { setVocal(null, null, null); setStage("name"); }}
                style={{ ...pillBtn("rgba(255,255,255,0.05)"), padding: "7px 0", width: "100%", fontSize: 11 }}
              >
                skip vocals →
              </button>
            </div>
          </div>
        ) : currentKind ? (
          <div style={{ padding: "12px 14px 16px" }}>

            {/* Kind heading */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10, gap: 8,
            }}>
              <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 900, color: "#fff" }}>
                pick a{" "}
                <span style={{ color: "#a78bfa" }}>{KIND_LABEL[currentKind]}</span>
              </div>
              <button
                onClick={skipKind}
                style={{
                  ...pillBtn("rgba(255,255,255,0.06)"),
                  fontSize: 10, padding: "3px 10px", whiteSpace: "nowrap",
                }}
              >
                skip →
              </button>
            </div>

            {/* Phase 5.B step 7 — shared pool indicator. Only when a coop
                session is active and the union has more than just my sounds. */}
            {coopBreakdown && coopBreakdown.partner > 0 && (
              <div style={{
                fontFamily:    "monospace",
                fontSize:      9.5,
                fontWeight:    700,
                color:         "rgba(255,255,255,0.65)",
                background:    "linear-gradient(90deg, rgba(124,58,237,0.18), rgba(34,211,238,0.12))",
                border:        "1px solid rgba(167,139,250,0.32)",
                borderRadius:  18,
                padding:       "5px 12px",
                display:       "inline-flex",
                alignItems:    "center",
                gap:           6,
                marginBottom:  10,
                letterSpacing: "0.02em",
              }}>
                <span>🤝 shared pool</span>
                <span style={{ opacity: 0.5 }}>·</span>
                <span style={{ color: "#fff" }}>your {coopBreakdown.yours}</span>
                <span style={{ opacity: 0.5 }}>+</span>
                <span style={{ color: "#fbbf24" }}>partner {coopBreakdown.partner}</span>
                <span style={{ opacity: 0.5 }}>=</span>
                <span style={{ color: "#a78bfa", fontWeight: 900 }}>{coopBreakdown.total} sounds</span>
              </div>
            )}

            {/*
              Sound cards: auto-fill grid.
              minmax(180px, 1fr) means:
               • window ≥ ~376px  → 2 columns
               • window < 376px   → 1 column
              No viewport breakpoints — purely container-driven.
            */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 8,
            }}>
              {suggestions.map((s) => {
                const picked      = existingForKind(currentKind)?.soundId === s!.id;
                const isSuggested = activeTemplate.suggested[currentKind]?.includes(s!.id);
                return (
                  <button
                    key={s!.id}
                    onClick={(e) => handlePickOrSwap(s!.id, s!.variant, currentKind, e.clientX, e.clientY)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      background: picked ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${picked ? "#7c3aed" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 10,
                      cursor: "pointer", textAlign: "left",
                      transition: "all 0.14s",
                      boxShadow: picked ? "0 0 12px rgba(124,58,237,0.3)" : "none",
                      minWidth: 0,
                    }}
                    onMouseEnter={(e) => { if (!picked) e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)"; }}
                    onMouseLeave={(e) => { if (!picked) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1 }}>{s!.glyph}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 5,
                        flexWrap: "wrap",
                      }}>
                        <span style={{
                          fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                          color: "#fff",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {s!.name}
                        </span>
                        {isSuggested && !picked && (
                          <span style={{
                            fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                            background: "rgba(124,58,237,0.2)",
                            border: "1px solid rgba(124,58,237,0.4)",
                            color: "#a78bfa", borderRadius: 4, padding: "1px 5px",
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            flexShrink: 0,
                          }}>✦</span>
                        )}
                        {picked && (
                          <span style={{
                            fontFamily: "monospace", fontSize: 8, fontWeight: 700,
                            background: "rgba(250,204,21,0.15)",
                            border: "1px solid rgba(250,204,21,0.35)",
                            color: "#facc15", borderRadius: 4, padding: "1px 5px",
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            flexShrink: 0,
                          }}>on</span>
                        )}
                      </div>
                      <div style={{
                        fontFamily: "monospace", fontSize: 10,
                        color: "rgba(255,255,255,0.4)", marginTop: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {s!.vibe}
                      </div>
                    </div>
                    {/* Preview button */}
                    {(() => {
                      const isThisPreviewing = previewingId === s!.id;
                      return (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            // iOS unlock: fire-and-forget ensureAudio() inside
                            // the synchronous gesture handler so Tone's audio
                            // context starts on the right stack frame.
                            ensureAudio();
                            if (isThisPreviewing) {
                              // Second click stops preview
                              stopPreview();
                              setPreviewingId(null);
                              return;
                            }
                            setPreviewingId(s!.id);
                            previewLayer(
                              { id: "preview", kind: s!.kind, variant: s!.variant, soundId: s!.id },
                              activeTemplate.keyRoot,
                              activeTemplate.bpm,
                              () => setPreviewingId(null),
                            );
                          }}
                          style={{
                            width: 28, height: 28, borderRadius: "50%",
                            background: isThisPreviewing
                              ? "rgba(124,58,237,0.35)"
                              : "rgba(255,255,255,0.07)",
                            border: `1.5px solid ${isThisPreviewing ? "#a78bfa" : "rgba(255,255,255,0.1)"}`,
                            color: isThisPreviewing ? "#a78bfa" : "rgba(255,255,255,0.45)",
                            fontSize: isThisPreviewing ? 9 : 10,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                            transition: "all 0.15s",
                            boxShadow: isThisPreviewing ? "0 0 8px rgba(124,58,237,0.5)" : "none",
                            animation: isThisPreviewing ? "previewPulse 0.9s ease-in-out infinite alternate" : "none",
                          }}
                          title={isThisPreviewing ? "stop preview" : "preview sound"}
                        >
                          {isThisPreviewing ? "■" : "▶"}
                        </button>
                      );
                    })()}
                    <style>{`
                      @keyframes previewPulse {
                        from { box-shadow: 0 0 6px rgba(124,58,237,0.4); }
                        to   { box-shadow: 0 0 14px rgba(167,139,250,0.8); }
                      }
                    `}</style>
                  </button>
                );
              })}
            </div>

            {/* Currently picked — mute toggle row */}
            {existingForKind(currentKind) && (() => {
              const layer = existingForKind(currentKind)!;
              return (
                <div style={{
                  marginTop: 10,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "6px 10px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>
                    currently picked
                  </span>
                  <button
                    onClick={() => {
                      updateMuteState(layer.id, !layer.muted);
                      swapLayer(layer.kind, layer.variant, layer.soundId);
                    }}
                    style={{
                      ...pillBtn(layer.muted ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)"),
                      fontSize: 10, padding: "3px 10px",
                      border: `1px solid ${layer.muted ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}`,
                      color: layer.muted ? "#f87171" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {layer.muted ? "unmute" : "mute"}
                  </button>
                </div>
              );
            })()}

            <p style={{
              marginTop: 10,
              fontFamily: "monospace", fontSize: 10,
              color: "rgba(255,255,255,0.25)", lineHeight: 1.5,
            }}>
              every option here works with what you've stacked. no bad outcomes.
            </p>
          </div>
        ) : (
          /* ── Recipe full (no currentKind): prompt to save ── */
          <div style={{ padding: "24px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 6 }}>
              recipe complete
            </div>
            <p style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>
              swap any layer before saving — everything's still flexible.
            </p>
            <button
              onClick={() => setStage("name")}
              style={{
                ...pillBtn("#7c3aed"),
                fontSize: 12, padding: "8px 20px", fontWeight: 700,
                boxShadow: "0 0 20px rgba(124,58,237,0.4)",
              }}
            >
              🏷️ name & save
            </button>
          </div>
        )}

        {/* ── Companion needs (collapsible) ── */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          margin: "0 14px 14px",
        }}>
          <button
            onClick={() => setNeedsOpen((o) => !o)}
            style={{
              width: "100%", padding: "7px 0",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
              companion state
            </span>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>
              {needsOpen ? "▲" : "▼"}
            </span>
          </button>
          {needsOpen && (
            <div style={{ paddingBottom: 8 }}>
              <NeedsMeters tam={tamagotchi} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                       */
/* -------------------------------------------------------------------------- */

function pillBtn(bg: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "4px 12px", borderRadius: 20,
    background: bg,
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.75)",
    fontFamily: "monospace", fontSize: 12, fontWeight: 700,
    cursor: "pointer", transition: "all 0.12s",
  };
}

function reactionLine(kind: LayerKind): string {
  const lines: Record<LayerKind, string[]> = {
    drums:  ["that's the foundation.", "drums locked in.", "now it's moving."],
    kick:   ["boom. keep going.",       "head-nodder.",    "locked in."],
    snare:  ["now it's hitting.",       "that's the one.", "clean."],
    hat:    ["oh, it's alive now.",     "oooo.",           "yeah yeah."],
    "808":  ["basement shaker.",        "that's fat.",     "wooom."],
    sample: ["vibey.",                  "that flip works.","layered."],
    melody: ["catchy.",                 "there's the hook.","that's sticky."],
    vocal:  ["ok, drop the bars.",      "your moment.",    "let's hear it."],
  };
  const list = lines[kind];
  return list[Math.floor(Math.random() * list.length)];
}
