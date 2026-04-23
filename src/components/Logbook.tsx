import { useState } from "react";
import { useStore } from "../store/useStore";
import { playSong, stopSong, renderSongToWav, downloadWavBlob } from "../audio/engine";
import type { Song } from "../data/types";

/**
 * Inventory viewer. Can replay any past song. Shows tags, collaborators,
 * pitch score. Maps to the "CD item in inventory" idea.
 */
export function Logbook() {
  const { inventory, vocalBuffer, toggleLogbook, placeInBooth, setStage } = useStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  async function togglePlay(song: Song) {
    if (playingId === song.id) {
      stopSong();
      setPlayingId(null);
      return;
    }
    stopSong();
    await playSong(song, null /* vocalBuffer lost on reload; prototype */);
    setPlayingId(song.id);
  }

  async function downloadWav(song: Song) {
    if (exportingId) return;
    // Export and live playback share Tone's sample cache — stop playback first.
    stopSong();
    setPlayingId(null);
    setExportingId(song.id);
    try {
      // vocalBuffer is only in memory for the most recently recorded song;
      // historical logbook songs will render without the vocal stem.
      const wav = await renderSongToWav(song, vocalBuffer);
      downloadWavBlob(wav, song.name);
    } catch (err) {
      console.error("[logbook] export failed:", err);
      alert("Download failed — check the console for details.");
    } finally {
      setExportingId(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-start justify-center p-6 overflow-auto">
      <div className="card w-full max-w-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="chip bg-raised border border-line text-white/70">
              inventory · {inventory.length} CD{inventory.length === 1 ? "" : "s"}
            </div>
            <h2 className="font-display text-2xl font-bold">logbook</h2>
          </div>
          <button className="btn-ghost text-xs" onClick={toggleLogbook}>
            ✕ close
          </button>
        </div>

        {inventory.length === 0 && (
          <div className="text-center text-muted text-sm font-mono py-8">
            nothing here yet. cook your first hook.
          </div>
        )}

        <div className="flex flex-col gap-2">
          {inventory.map((s) => (
            <div key={s.id} className="raised p-3 flex items-center gap-3">
              <button
                className="btn-ghost text-xs"
                onClick={() => togglePlay(s)}
              >
                {playingId === s.id ? "⏸" : "▶"}
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{s.name}</div>
                <div className="text-[11px] font-mono text-white/50">
                  {s.bpm} bpm · {s.bars} bars ·{" "}
                  {s.layers.map((l) => l.kind).join(", ")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {s.tags.map((t) => (
                    <span
                      key={t}
                      className="chip bg-raised border border-line text-white/60"
                    >
                      #{t}
                    </span>
                  ))}
                  {s.collaborators.length > 1 && (
                    <span className="chip bg-accent/10 border border-accent/30 text-accent">
                      collab · {s.collaborators.join(" × ")}
                    </span>
                  )}
                  {s.pitchScore !== undefined && (
                    <span className="chip bg-gold/10 border border-gold/30 text-gold">
                      🎤 {s.pitchScore}/100
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn-ghost text-[11px]"
                onClick={() => downloadWav(s)}
                disabled={exportingId !== null}
                title="Download as 48 kHz / 24-bit WAV"
                style={exportingId === s.id ? { opacity: 0.6, cursor: "wait" } : undefined}
              >
                {exportingId === s.id ? "⏳ rendering…" : "⬇ .wav"}
              </button>
              <button
                className="btn-ghost text-[11px]"
                onClick={() => {
                  placeInBooth(s.id, "from the logbook");
                  toggleLogbook();
                  setStage("booth");
                }}
              >
                drop in booth
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
