/**
 * NameAndSave — UI v1 game-feel rebuild.
 *
 * Last step of the 60-second loop: name the hook, preview it, export to
 * .wav, or save it to the inventory as a CD item. Visual language now
 * matches the rest of slice 2/3 — chunky candy controls, gradient title
 * field, sticker-style tag chips, palette-aligned guest-gate modal.
 */

import { useState } from "react";
import { useStore } from "../store/useStore";
import { useAuth } from "../lib/auth";
import { playSong, renderSongToWav, stopSong, downloadWavBlob } from "../audio/engine";
import { SAVE_SONG_XP } from "../data/achievements";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";
import { Modal } from "../ui/Modal";
import { CreationToolbar } from "../ui/burst/CreationToolbar";
import { RecipeStrip }     from "../ui/burst/RecipeStrip";

export function NameAndSave() {
  const {
    activeTemplate,
    layers,
    songName,
    setSongName,
    vocalBuffer,
    finalizeSong,
    setStage,
    setRecipeIndex,
    coopPeerName,
    addXP,
    checkAndUnlockAchievements,
  } = useStore();
  const { isGuest, endGuestSession } = useAuth();
  const [playing, setPlaying] = useState(false);
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!activeTemplate) return null;

  async function handlePlay() {
    if (playing) {
      stopSong();
      setPlaying(false);
      return;
    }
    await playSong(
      {
        id: "preview",
        name: songName || "preview",
        bpm: activeTemplate!.bpm,
        bars: activeTemplate!.bars,
        keyRoot: activeTemplate!.keyRoot,
        templateId: activeTemplate!.id,
        layers,
        tags: activeTemplate!.tags,
        collaborators: [],
        createdAt: Date.now(),
      },
      vocalBuffer
    );
    setPlaying(true);
  }

  async function handleExport() {
    if (exporting) return;
    stopSong();
    setPlaying(false);
    setExporting(true);
    try {
      const wav = await renderSongToWav(
        {
          id: "export",
          name: songName || "hook",
          bpm: activeTemplate!.bpm,
          bars: activeTemplate!.bars,
          keyRoot: activeTemplate!.keyRoot,
          templateId: activeTemplate!.id,
          layers,
          tags: activeTemplate!.tags,
          collaborators: [],
          createdAt: Date.now(),
        },
        vocalBuffer
      );
      downloadWavBlob(wav, songName || "hook");
    } catch (err) {
      console.error("[export] render failed:", err);
      alert("Export failed. Check the console for details.");
    } finally {
      setExporting(false);
    }
  }

  function handleSave() {
    if (isGuest) {
      stopSong();
      setPlaying(false);
      setShowGuestGate(true);
      return;
    }
    stopSong();
    setPlaying(false);
    finalizeSong(coopPeerName ? [coopPeerName] : []);
    addXP(SAVE_SONG_XP, "song saved");
    setTimeout(() => checkAndUnlockAchievements(), 50);
  }

  return (
    <div className="pt-3 pb-8 flex flex-col gap-4">
      {/* Recipe strip — same component StackingView uses, with the
       *  SAVE pill auto-highlighted because we're on the "name" stage.
       *  Lets the player jump back to any recipe step from here. */}
      <RecipeStrip />

      {/* Header */}
      <div>
        <ChunkyBadge variant="cyan" size="sm">step 3 / 3 · save</ChunkyBadge>
        <h2 className="font-display text-3xl text-white leading-tight mt-2">
          name the hook
        </h2>
        <p className="font-mono text-[11px] text-white/55 mt-1">
          becomes a CD item in your inventory.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-grvd-purple/10 to-transparent p-4 flex flex-col gap-4 shadow-chunky-press">
        {/* Title input */}
        <div>
          <label className="font-mono text-[10px] tracking-[0.16em] uppercase text-white/55">
            title
          </label>
          <input
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            placeholder="Untitled Hook"
            maxLength={48}
            className={[
              "w-full mt-1.5 px-4 py-3 rounded-2xl",
              "bg-grvd-base/60 border-2 border-white/12",
              "font-display text-2xl text-white",
              "outline-none focus:border-grvd-magenta/60 focus:bg-grvd-base/80",
              "transition-colors shadow-chunky-press",
            ].join(" ")}
          />
        </div>

        {/* Tag stickers */}
        <div className="flex flex-wrap gap-2">
          {activeTemplate.tags.map((t) => (
            <ChunkyBadge key={t} variant="ghost" size="sm">#{t}</ChunkyBadge>
          ))}
          {coopPeerName && (
            <ChunkyBadge variant="cyan" size="sm" icon="🤝">
              {coopPeerName}
            </ChunkyBadge>
          )}
          {vocalBuffer && (
            <ChunkyBadge variant="gold" size="sm" icon="🎤">
              vocals
            </ChunkyBadge>
          )}
        </div>

        {/* Stats readout */}
        <div className="rounded-2xl border border-white/8 bg-black/30 px-3 py-2.5 font-mono text-[11px] text-white/70 leading-relaxed shadow-chunky-press">
          <div>{activeTemplate.bpm} bpm · {activeTemplate.bars} bars · key {activeTemplate.keyRoot}</div>
          <div className="mt-1">
            {layers.length} layer{layers.length === 1 ? "" : "s"}:{" "}
            {layers.map((l) => l.kind).join(" + ")}
          </div>
        </div>

        {/* Persistent creation toolbar — same component used in
         *  StackingView/ArrangeView/MixerView (cook, arrange, mix).
         *  Mid-creation activeTemplate + layers are already in the
         *  store, so the buttons just route. Audio persists. */}
        <CreationToolbar />

        {/* Actions */}
        <div className="flex flex-wrap gap-2 items-center">
          <ChunkyPill variant="ghost" size="md" onClick={handlePlay}>
            {playing ? "⏸ stop" : "▶ preview"}
          </ChunkyPill>
          <ChunkyPill
            variant="ghost"
            size="md"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "⏳ rendering…" : "⬇ export .wav"}
          </ChunkyPill>
          <ChunkyPill
            variant="ghost"
            size="md"
            onClick={() => {
              if (activeTemplate) {
                setRecipeIndex(activeTemplate.recipe.length - 1);
              }
              setStage("stack");
            }}
          >
            ← keep editing
          </ChunkyPill>
          <ChunkyButton
            variant="hero"
            size="md"
            icon="💿"
            onClick={handleSave}
            className="ml-auto"
          >
            save to inventory
          </ChunkyButton>
        </div>
      </div>

      {/* Guest-mode gate */}
      <Modal
        open={showGuestGate}
        onClose={() => setShowGuestGate(false)}
        kicker="💿 save your hook"
        title="sign up to keep this drop"
        accentText="text-grvd-purple"
        accentShadow="shadow-[0_0_32px_rgba(167,139,250,0.22)]"
        footer={
          <div className="flex flex-col gap-2">
            <ChunkyButton
              variant="hero"
              size="md"
              icon="→"
              onClick={endGuestSession}
              className="w-full"
            >
              sign up to save
            </ChunkyButton>
            <ChunkyPill
              variant="ghost"
              size="sm"
              onClick={() => setShowGuestGate(false)}
              className="self-center"
            >
              keep tinkering
            </ChunkyPill>
          </div>
        }
      >
        <p className="font-mono text-[11px] leading-relaxed text-white/65 text-center py-2">
          you're in guest mode — nothing is saved yet. create a free
          account to keep this song in your inventory and pick up where
          you left off.
        </p>
      </Modal>
    </div>
  );
}
