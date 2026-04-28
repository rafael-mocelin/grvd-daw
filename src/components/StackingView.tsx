/**
 * StackingView — the recipe-building UI, UI-v1 game-feel rebuild.
 *
 * Step-through page (manifesto rule #1) with sticky recipe strip below
 * the HUD. Every preserved feature from the prior version:
 *
 *   • Header — template chip, progress, play/abandon
 *   • Sticky recipe strip — chunky candy step pills with glyph readout
 *   • Vocal launchpad — when the current step is "vocal"
 *   • Sound picker grid — auto-fill 1/2 cols, suggested-first, preview button
 *   • Coop shared-pool ribbon
 *   • Per-seat mute toggle for currently picked layer
 *   • Companion needs (collapsible)
 *
 * Visual language: chunky candy buttons, GRVD palette, Lilita display +
 * JetBrains Mono technical readouts.
 */

import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import { NeedsMeters } from "./NeedsMeters";
import { SOUNDS, ALL_SOUNDS, getDynamicSounds, getSound } from "../data/sounds";
import type { LayerKind } from "../data/types";
import { KIND_LABEL } from "../data/types";
import { ensureAudio, playSong, previewLayer, stopPreview, stopSong } from "../audio/engine";
import { LAYER_XP } from "../data/achievements";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";

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
    localMutedLayerIds,
    toggleLocalLayerMute,
  } = useStore();

  /* Coop material union — see prior comment block. */
  const effectiveSoundIds: Set<string> | null = useMemo(() => {
    if (activeCoopRow?.status === "active" && activeCoopRow.availableSoundIds.length > 0) {
      return new Set(activeCoopRow.availableSoundIds);
    }
    return ownedSoundIds;
  }, [activeCoopRow, ownedSoundIds]);

  const coopBreakdown = useMemo(() => {
    if (!activeCoopRow || activeCoopRow.status !== "active") return null;
    const total = activeCoopRow.availableSoundIds.length;
    if (total === 0 || !ownedSoundIds) return null;
    const yours    = activeCoopRow.availableSoundIds.filter((id) => ownedSoundIds.has(id)).length;
    const partner  = total - yours;
    return { yours, partner, total };
  }, [activeCoopRow, ownedSoundIds]);

  void userId;
  void swapLayer;

  const [playing,     setPlaying]     = useState(false);
  const [needsOpen,   setNeedsOpen]   = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const currentKind: LayerKind | null = useMemo(() => {
    if (!activeTemplate) return null;
    return activeTemplate.recipe[recipeIndex] ?? null;
  }, [activeTemplate, recipeIndex]);

  const suggestions = useMemo(() => {
    if (!activeTemplate || !currentKind) return [];
    const suggestedIds = activeTemplate.suggested[currentKind] ?? [];

    const suggested = suggestedIds
      .map((id) => getSound(id))
      .filter(Boolean) as ReturnType<typeof getSound>[];

    if (!effectiveSoundIds) {
      const hasReal = suggested.some((s) => s?.fileUrl);
      if (hasReal) return suggested;
      const others = SOUNDS.filter(
        (s) => s.kind === currentKind && !suggestedIds.includes(s.id),
      );
      return [...suggested, ...others];
    }

    const allowedSuggested = suggested.filter((s) => s && effectiveSoundIds.has(s.id));
    const seen = new Set(allowedSuggested.map((s) => s!.id));
    const allowedRest = [...ALL_SOUNDS, ...getDynamicSounds()].filter(
      (s) => s.kind === currentKind
          && effectiveSoundIds.has(s.id)
          && !seen.has(s.id),
    );

    return [...allowedSuggested, ...allowedRest];
  }, [activeTemplate, currentKind, effectiveSoundIds]);

  useEffect(() => { setIsPlaying(playing); }, [playing, setIsPlaying]);

  useEffect(() => {
    return () => { stopSong(); setIsPlaying(false); };
  }, [setIsPlaying]);

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
      <div className="px-4 py-8 text-center font-mono text-[12px] text-white/55">
        no template selected.{" "}
        <button
          className="underline text-grvd-purple"
          onClick={() => setStage("template")}
        >
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
      null,
      localMutedLayerIds,
    );
  }

  async function handleTogglePlay() {
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
    ensureAudio();
    const tpl = activeTemplate;
    if (!tpl) return;
    const existing = existingForKind(kind);
    const updatedLayers = existing
      ? layers.map((l) => (l.kind === kind ? { ...l, variant, soundId } : l))
      : [...layers, { id: `${kind}-${Date.now()}`, kind, variant, soundId }];
    pickLayer(kind, variant, soundId);
    if (!existing) {
      const xp = LAYER_XP[kind] ?? 0;
      if (xp > 0) addXP(xp, KIND_LABEL[kind], clickX, clickY);
      sayLine(reactionLine(kind), 2200);
    }
    stopPreview();
    await startPlayback(tpl, updatedLayers);
    setPlaying(true);
  }

  return (
    <div className="flex flex-col min-w-0 pt-2">

      {/* ── Header ── */}
      <div className="px-1 pb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ChunkyBadge variant="ghost" size="sm">
            {activeTemplate.name} · {activeTemplate.bpm} bpm · {activeTemplate.bars} bars
          </ChunkyBadge>
          <span className="ml-auto inline-flex gap-1.5">
            <ChunkyPill
              variant={playing ? "purple" : "ghost"}
              size="sm"
              onClick={handleTogglePlay}
              disabled={!layers.length}
            >
              {playing ? "⏸ pause" : "▶ play"}
            </ChunkyPill>
            <ChunkyPill variant="ghost" size="sm" onClick={abandon}>
              ✕ quit
            </ChunkyPill>
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-white/8 rounded-full overflow-hidden shadow-chunky-press">
            <div
              className="h-full bg-gradient-to-r from-grvd-purple to-grvd-magenta transition-[width] duration-300 rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-white/50 tabular-nums whitespace-nowrap">
            {recipeIndex}/{activeTemplate.recipe.length}
          </span>
        </div>
      </div>

      {/* ── Recipe strip: sticky chunky pills below the HUD ── */}
      <div
        className="sticky z-20 -mx-3 px-3 py-2 bg-grvd-base/95 backdrop-blur-sm border-y border-white/6 overflow-x-auto"
        style={{ top: "var(--hud-h, 64px)", scrollbarWidth: "none" }}
      >
        <div className="flex gap-1.5 min-w-max">
          {activeTemplate.recipe.map((kind, i) => {
            const layer     = existingForKind(kind);
            const active    = i === recipeIndex;
            const clickable = !!layer && !active;
            const sound = layer ? getSound(layer.soundId) : null;
            return (
              <button
                key={kind + i}
                onClick={clickable ? () => setRecipeIndex(i) : undefined}
                disabled={!clickable}
                className={[
                  "inline-flex items-center gap-1.5",
                  "px-2.5 py-1 rounded-full",
                  "font-mono text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0",
                  "transition-all",
                  active
                    ? "bg-grvd-purple/25 border-2 border-grvd-purple text-white shadow-glow-purple"
                    : layer
                      ? "bg-white/6 border-2 border-white/15 text-white/65"
                      : "bg-transparent border-2 border-white/8 text-white/30",
                ].join(" ")}
              >
                <span className="opacity-60">{i + 1}</span>
                <span>{KIND_LABEL[kind]}</span>
                {sound && <span className="text-base leading-none">{sound.glyph}</span>}
                {active && !layer && <span className="text-grvd-purple">←</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="min-w-0">
        {currentKind === "vocal" ? (
          /* Vocal launchpad */
          <div className="px-4 py-8 flex flex-col items-center gap-4">
            <div className="text-6xl drop-shadow-[0_4px_8px_rgba(167,139,250,0.5)]">🎤</div>
            <div className="font-display text-2xl text-white text-center leading-tight">
              time to drop the verse
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-white/50 text-center max-w-[280px]">
              the beat's ready. rap along to the karaoke,
              or squad up with a friend to co-create.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[260px]">
              <ChunkyButton
                variant="hero"
                size="lg"
                icon="🎤"
                onClick={() => setStage("vocal")}
                className="w-full"
              >
                record the verse
              </ChunkyButton>
              <ChunkyPill
                variant="ghost"
                size="md"
                onClick={() => { setVocal(null, null, null); setStage("name"); }}
                className="w-full"
              >
                skip vocals →
              </ChunkyPill>
            </div>
          </div>
        ) : currentKind ? (
          <div className="px-1 pt-3 pb-4">
            {/* Kind heading */}
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="font-display text-xl text-white leading-tight">
                pick a <span className="text-grvd-purple">{KIND_LABEL[currentKind]}</span>
              </div>
              <ChunkyPill variant="ghost" size="sm" onClick={skipKind}>
                skip →
              </ChunkyPill>
            </div>

            {/* Coop shared pool */}
            {coopBreakdown && coopBreakdown.partner > 0 && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[10px] font-bold bg-gradient-to-r from-grvd-purple/20 to-grvd-cyan/15 border border-grvd-purple/30 text-white/75 shadow-chunky-press">
                <span>🤝 shared pool</span>
                <span className="opacity-50">·</span>
                <span className="text-white">your {coopBreakdown.yours}</span>
                <span className="opacity-50">+</span>
                <span className="text-grvd-gold">partner {coopBreakdown.partner}</span>
                <span className="opacity-50">=</span>
                <span className="text-grvd-purple">{coopBreakdown.total} sounds</span>
              </div>
            )}

            {/* Picker grid */}
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}
            >
              {suggestions.map((s) => {
                const picked      = existingForKind(currentKind)?.soundId === s!.id;
                const isSuggested = activeTemplate.suggested[currentKind]?.includes(s!.id);
                const isThisPreviewing = previewingId === s!.id;
                return (
                  <button
                    key={s!.id}
                    onClick={(e) => handlePickOrSwap(s!.id, s!.variant, currentKind, e.clientX, e.clientY)}
                    className={[
                      "flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left min-w-0",
                      "border-2 transition-all shadow-chunky-press",
                      "active:scale-[0.98] active:translate-y-[1px]",
                      picked
                        ? "bg-grvd-purple/20 border-grvd-purple shadow-glow-purple"
                        : "bg-white/3 border-white/8 hover:border-grvd-purple/40",
                    ].join(" ")}
                  >
                    <span className="text-2xl shrink-0 leading-none">{s!.glyph}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-display text-base text-white truncate">
                          {s!.name}
                        </span>
                        {isSuggested && !picked && (
                          <ChunkyBadge variant="purple" size="sm">✦</ChunkyBadge>
                        )}
                        {picked && (
                          <ChunkyBadge variant="gold" size="sm">on</ChunkyBadge>
                        )}
                      </div>
                      <div className="font-mono text-[10px] text-white/45 truncate mt-0.5">
                        {s!.vibe}
                      </div>
                    </div>
                    {/* Preview button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        ensureAudio();
                        if (isThisPreviewing) {
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
                      className={[
                        "w-9 h-9 rounded-full shrink-0",
                        "inline-flex items-center justify-center",
                        "border-2 transition-all shadow-chunky-press",
                        isThisPreviewing
                          ? "bg-grvd-purple/35 border-grvd-purple text-white shadow-glow-purple"
                          : "bg-white/6 border-white/12 text-white/55",
                      ].join(" ")}
                      title={isThisPreviewing ? "stop preview" : "preview sound"}
                    >
                      <span className="text-sm">{isThisPreviewing ? "■" : "▶"}</span>
                    </button>
                  </button>
                );
              })}
            </div>

            {/* Mute toggle row */}
            {existingForKind(currentKind) && (() => {
              const layer   = existingForKind(currentKind)!;
              const isMuted = localMutedLayerIds.has(layer.id);
              const isCoop  = !!activeCoopRow;
              return (
                <div className="mt-3 flex items-center justify-between px-3 py-2 rounded-2xl bg-white/3 border border-white/8 shadow-chunky-press">
                  <span className="font-mono text-[10px] text-white/45">
                    {isCoop ? "currently picked · local mute only" : "currently picked"}
                  </span>
                  <ChunkyPill
                    variant={isMuted ? "magenta" : "ghost"}
                    size="sm"
                    onClick={() => toggleLocalLayerMute(layer.id)}
                  >
                    {isMuted ? "unmute" : "mute"}
                  </ChunkyPill>
                </div>
              );
            })()}

            <p className="mt-3 font-mono text-[10px] leading-relaxed text-white/30">
              every option here works with what you've stacked. no bad outcomes.
            </p>
          </div>
        ) : (
          /* Recipe full → name & save */
          <div className="px-4 py-8 text-center flex flex-col items-center gap-3">
            <div className="text-5xl">🎉</div>
            <div className="font-display text-2xl text-white">recipe complete</div>
            <p className="font-mono text-[11px] text-white/50 max-w-[260px]">
              swap any layer before saving — everything's still flexible.
            </p>
            <ChunkyButton
              variant="hero"
              size="lg"
              icon="🏷️"
              onClick={() => setStage("name")}
            >
              name & save
            </ChunkyButton>
          </div>
        )}

        {/* Companion needs (collapsible) */}
        <div className="mt-4 mx-1 border-t border-white/6">
          <button
            onClick={() => setNeedsOpen((o) => !o)}
            className="w-full py-2 flex items-center justify-between text-left"
          >
            <span className="font-mono text-[9px] tracking-[0.16em] uppercase text-white/35">
              companion state
            </span>
            <span className="text-white/30 text-xs">
              {needsOpen ? "▲" : "▼"}
            </span>
          </button>
          {needsOpen && (
            <div className="pb-3">
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
