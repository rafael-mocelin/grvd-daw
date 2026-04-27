import { useEffect, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { playSong, stopSong, renderSongToWav, downloadWavBlob } from "../audio/engine";
import { checkSongEditLock, type SongEditLockResult } from "../lib/game-db";
import type { Song } from "../data/types";

/**
 * Inventory viewer. Can replay any past song. Shows tags, collaborators,
 * pitch score. Maps to the "CD item in inventory" idea.
 */
export function Logbook() {
  const {
    inventory, vocalBuffer, toggleLogbook,
    publishSong, publishingSongId, energy, energyUpdatedAt,
    activeCoopSessionId,
  } = useStore();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  /** Phase 5.B step 8 — when set, renders the lock-status modal for that song. */
  const [lockSongId, setLockSongId] = useState<string | null>(null);
  const liveEnergy = computeLiveEnergy(energy, energyUpdatedAt);

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

        {lockSongId && (
          <EditLockModal
            song={inventory.find((s) => s.id === lockSongId)!}
            coopSessionId={activeCoopSessionId}
            onClose={() => setLockSongId(null)}
          />
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
                  {/* Phase 5.B step 8 — group-song lock badge. Only published
                      group songs have meaningful collaborator_ids on the
                      publication; un-published group songs show a quieter
                      "publish first" hint. */}
                  {s.collaborators.length > 1 && (
                    <button
                      onClick={() => setLockSongId(s.id)}
                      title={s.publishedPublicationId
                        ? "check edit-lock status for this group song"
                        : "publish first to set up the group lock"}
                      className="chip bg-purple-500/10 border border-purple-400/30 text-purple-300 cursor-pointer hover:bg-purple-500/20"
                      style={{ cursor: "pointer" }}
                    >
                      🔒 group song
                    </button>
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
              {(() => {
                const isPublished  = !!s.publishedPublicationId;
                const isPublishing = publishingSongId === s.id;
                const canAfford    = liveEnergy >= ENERGY_COSTS.publishSong;
                const disabled     = isPublished || isPublishing || !canAfford;
                const label        = isPublished  ? "✓ published"
                                   : isPublishing ? "⏳ publishing…"
                                   : !canAfford   ? `${ENERGY_COSTS.publishSong}⚡ short`
                                   :                `publish · ${ENERGY_COSTS.publishSong}⚡`;
                return (
                  <button
                    className="btn-ghost text-[11px]"
                    disabled={disabled}
                    style={disabled ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
                    onClick={() => publishSong(s.id)}
                    title={
                      isPublished
                        ? "already live in the booth"
                        : !canAfford
                          ? `need ${ENERGY_COSTS.publishSong - liveEnergy} more ⚡`
                          : `publish to the listening booth (-${ENERGY_COSTS.publishSong} ⚡)`
                    }
                  >
                    {label}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit-lock status modal — Phase 5.B step 8                                   */
/*                                                                              */
/* Surfaces the result of check_song_edit_lock for a given group song. The     */
/* actual "open this song to edit" flow doesn't exist yet in the app, so this  */
/* modal is informational: it shows the player WHY a group song is locked or   */
/* WHO needs to be present, so they can plan the next jam.                     */
/* -------------------------------------------------------------------------- */

interface EditLockModalProps {
  song:           Song;
  coopSessionId:  string | null;
  onClose:        () => void;
}

function EditLockModal({ song, coopSessionId, onClose }: EditLockModalProps) {
  const [result,  setResult]  = useState<SongEditLockResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!song.publishedPublicationId) {
      // Pre-publish group songs: no collaborator_ids resolved yet, so the
      // RPC has nothing to check. Render a "publish first" message
      // without calling the server.
      setResult(null);
      return;
    }
    setLoading(true);
    setError(null);
    (async () => {
      const r = await checkSongEditLock(song.id, coopSessionId);
      if (cancelled) return;
      if (!r) setError("could not reach the lock service");
      else    setResult(r);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [song.id, song.publishedPublicationId, coopSessionId]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position:       "absolute",
        inset:          0,
        background:     "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "center",
        padding:        "30px 14px",
        zIndex:         50,
      }}
    >
      <div
        style={{
          width:          "100%",
          maxWidth:       420,
          background:     "linear-gradient(180deg, rgba(20,18,40,0.98), rgba(10,10,18,0.98))",
          border:         "1px solid rgba(167,139,250,0.35)",
          borderRadius:   16,
          padding:        "16px 16px 18px",
          display:        "flex",
          flexDirection:  "column",
          gap:            12,
          boxShadow:      "0 12px 40px rgba(0,0,0,0.5), 0 0 30px rgba(167,139,250,0.15)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontFamily: "monospace", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.2em", textTransform: "uppercase", color: "#a78bfa",
            }}>
              🔒 group song
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 2,
            }}>
              {song.name}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-xs">✕</button>
        </div>

        {!song.publishedPublicationId && (
          <Note kind="info">
            this song hasn't been published yet — the lock turns on once it goes
            to the booth, snapshotting who collaborated.
          </Note>
        )}

        {loading && <Note kind="info">checking…</Note>}
        {error   && <Note kind="error">{error}</Note>}

        {result?.canEdit && (
          <Note kind="success">
            ✓ ready to edit — the crew is together and every sound is still
            in someone's bag.
            <div style={{ opacity: 0.55, fontSize: 10, marginTop: 4 }}>
              the actual edit flow ships in a later update; this is just the
              door, not the room.
            </div>
          </Note>
        )}

        {result && !result.canEdit && (
          <>
            <Note kind="lock">
              {lockHeadline(result.reason)}
            </Note>

            {result.missingCollaborators.length > 0 && (
              <Section title="needs back in the room">
                {result.missingCollaborators.map((id) => (
                  <code key={id} style={chipMono}>{shortId(id)}</code>
                ))}
              </Section>
            )}

            {result.missingSounds.length > 0 && (
              <Section title="missing materials">
                {result.missingSounds.map((m, i) => (
                  <div key={i} style={chipRow}>
                    <code style={chipMono}>{m.soundId}</code>
                    <span style={{ opacity: 0.5, fontSize: 9 }}>owned by</span>
                    <code style={chipMono}>{shortId(m.sourceOwnerId)}</code>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Tiny presentational helpers for the modal. */

function lockHeadline(reason: SongEditLockResult["reason"]): string {
  switch (reason) {
    case "no_coop_session":      return "the whole crew needs to be in a coop session together to edit this.";
    case "not_in_coop_session":  return "you'd need to be in the active coop session for this group.";
    case "missing_collaborators":return "some collaborators aren't in the current session yet.";
    case "missing_sounds":       return "someone has traded away a sound this song was built on.";
    case "not_a_collaborator":   return "you weren't on this drop's credits.";
    default:                     return "locked for now.";
  }
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8);
}

function Note({ kind, children }: { kind: "info" | "success" | "error" | "lock"; children: React.ReactNode }) {
  const palette = {
    info:    { bg: "rgba(124,58,237,0.10)",  border: "rgba(167,139,250,0.30)", text: "rgba(255,255,255,0.75)" },
    success: { bg: "rgba(74,222,128,0.10)",  border: "rgba(74,222,128,0.30)",  text: "#86efac" },
    error:   { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)",   text: "#fca5a5" },
    lock:    { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.30)",  text: "#fcd34d" },
  }[kind];
  return (
    <div style={{
      background: palette.bg, border: `1px solid ${palette.border}`,
      borderRadius: 10, padding: "10px 12px",
      fontFamily: "monospace", fontSize: 11, lineHeight: 1.5, color: palette.text,
    }}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{
        fontFamily: "monospace", fontSize: 9, fontWeight: 800,
        letterSpacing: "0.16em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
      }}>
        {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

const chipMono: React.CSSProperties = {
  fontFamily:   "monospace",
  fontSize:     10,
  background:   "rgba(255,255,255,0.06)",
  border:       "1px solid rgba(255,255,255,0.10)",
  borderRadius: 6,
  padding:      "2px 6px",
  color:        "rgba(255,255,255,0.85)",
};

const chipRow: React.CSSProperties = {
  display:    "inline-flex",
  alignItems: "center",
  gap:        6,
};
