import { useState } from "react";
import { useStore } from "../store/useStore";
import { useAuth } from "../lib/auth";
import { playSong, renderSongToWav, stopSong, downloadWavBlob } from "../audio/engine";
import { SAVE_SONG_XP } from "../data/achievements";

/**
 * Name the song, preview it, export as WAV, or just save as a CD item.
 * This is the last step of the 60-second loop.
 */
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
    // Stop live playback — otherwise the export and preview can contend for
    // the shared Tone.js sample cache and produce a silent or partial render.
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
    // Guest sessions don't persist. If they try to save, show a "sign up to
    // save" gate instead — this is the moment the signup friction is worth it.
    if (isGuest) {
      stopSong();
      setPlaying(false);
      setShowGuestGate(true);
      return;
    }
    stopSong();
    setPlaying(false);
    finalizeSong(coopPeerName ? [coopPeerName] : []);
    // Award save XP, then check if any achievements are newly unlocked
    addXP(SAVE_SONG_XP, "song saved");
    // Small delay so inventory state is updated before checking
    setTimeout(() => checkAndUnlockAchievements(), 50);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="chip bg-raised border border-line text-white/70">
          step 3 / 3 · save
        </div>
        <h2 className="font-display text-3xl font-bold">name the hook</h2>
        <p className="text-muted text-sm font-mono">
          becomes a CD item in your inventory.
        </p>
      </div>

      <div className="card p-6 flex flex-col gap-4">
        <div>
          <label className="text-[10px] font-mono uppercase text-white/50">
            title
          </label>
          <input
            className="w-full mt-1 bg-ink border border-line rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:border-accent"
            value={songName}
            onChange={(e) => setSongName(e.target.value)}
            placeholder="Untitled Hook"
            maxLength={48}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTemplate.tags.map((t) => (
            <span key={t} className="chip bg-raised border border-line text-white/70">
              #{t}
            </span>
          ))}
          {coopPeerName && (
            <span className="chip bg-accent/10 border border-accent/30 text-accent">
              collab · {coopPeerName}
            </span>
          )}
          {vocalBuffer && (
            <span className="chip bg-gold/10 border border-gold/30 text-gold">
              + vocals
            </span>
          )}
        </div>
        <div className="raised p-3 font-mono text-[12px] text-white/70">
          <div>{activeTemplate.bpm} bpm · {activeTemplate.bars} bars · key {activeTemplate.keyRoot}</div>
          <div className="mt-1">
            {layers.length} layer{layers.length === 1 ? "" : "s"}:{" "}
            {layers.map((l) => l.kind).join(" + ")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={handlePlay}>
            {playing ? "⏸ stop" : "▶ preview"}
          </button>
          <button
            className="btn-ghost"
            onClick={handleExport}
            disabled={exporting}
            style={exporting ? { opacity: 0.6, cursor: "wait" } : undefined}
          >
            {exporting ? "⏳ rendering…" : "⬇ export .wav"}
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              // Go back to the last recipe step so StackingView's
              // useEffect doesn't immediately bounce us back to "name".
              if (activeTemplate) {
                setRecipeIndex(activeTemplate.recipe.length - 1);
              }
              setStage("stack");
            }}
          >
            ← keep editing
          </button>
          <button className="btn-primary ml-auto" onClick={handleSave}>
            💿 save to inventory
          </button>
        </div>
      </div>

      {/* Guest-mode gate — only rendered when a guest tries to save. */}
      {showGuestGate && (
        <div
          onClick={() => setShowGuestGate(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10000, padding: 20,
            backdropFilter: "blur(6px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 360,
              background: "#13111d",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 16,
              padding: "24px 22px",
              fontFamily: "monospace",
              boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 40px rgba(124,58,237,0.15)",
            }}
          >
            <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>💿</div>
            <div style={{
              fontSize: 16, fontWeight: 900, letterSpacing: "0.08em",
              color: "#fff", textAlign: "center", textTransform: "uppercase",
              marginBottom: 8,
            }}>
              Save your hook
            </div>
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.55)",
              textAlign: "center", lineHeight: 1.6, marginBottom: 18,
            }}>
              You're in guest mode — nothing is saved yet. Create a free
              account to keep this song in your inventory and pick up where
              you left off.
            </div>
            <button
              onClick={endGuestSession}
              style={{
                width: "100%", padding: "11px 0",
                background: "rgba(124,58,237,0.9)",
                border: "none", borderRadius: 10,
                color: "#fff", fontFamily: "monospace",
                fontSize: 12, fontWeight: 900, letterSpacing: "0.1em",
                cursor: "pointer",
                textTransform: "uppercase",
                boxShadow: "0 0 24px rgba(124,58,237,0.4)",
              }}
            >
              sign up to save →
            </button>
            <button
              onClick={() => setShowGuestGate(false)}
              style={{
                width: "100%", padding: "8px 0", marginTop: 8,
                background: "transparent",
                border: "none",
                color: "rgba(255,255,255,0.35)",
                fontFamily: "monospace",
                fontSize: 10, letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              keep tinkering
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
