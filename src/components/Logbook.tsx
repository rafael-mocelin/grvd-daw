import { useEffect, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { playSong, stopSong, renderSongToWav, downloadWavBlob } from "../audio/engine";
import { checkSongEditLock, type SongEditLockResult } from "../lib/game-db";
import type { Song } from "../data/types";
import { Modal } from "../ui/Modal";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";

/**
 * Inventory viewer. Can replay any past song. Shows tags, collaborators,
 * pitch score. Maps to the "CD item in inventory" idea.
 */
export function Logbook() {
  const {
    inventory, vocalBuffer, toggleLogbook,
    publishSong, publishingSongId, energy, energyUpdatedAt,
    activeCoopSessionId, editSong, sayLine,
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
    <div
      onClick={(e) => { if (e.target === e.currentTarget) toggleLogbook(); }}
      className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-start justify-center px-3 py-7 overflow-auto"
    >
      <div className="w-full max-w-[480px] flex flex-col gap-4 rounded-3xl bg-gradient-to-b from-[#1a1632]/98 to-[#0a0814]/98 border border-white/10 shadow-chunky px-4 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[0.22em] uppercase text-grvd-cyan">
              💿 inventory · {inventory.length} CD{inventory.length === 1 ? "" : "s"}
            </div>
            <h2 className="font-display text-3xl text-white leading-tight mt-1">
              logbook
            </h2>
          </div>
          <ChunkyPill variant="ghost" size="sm" onClick={toggleLogbook} aria-label="close">
            ✕
          </ChunkyPill>
        </div>

        {inventory.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/12 px-4 py-8 text-center font-mono text-[11px] text-white/45">
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

        <div className="flex flex-col gap-2.5">
          {inventory.map((s) => {
            const isPublished  = !!s.publishedPublicationId;
            const isPublishing = publishingSongId === s.id;
            const canAfford    = liveEnergy >= ENERGY_COSTS.publishSong;
            const isPlaying    = playingId === s.id;
            const isExporting  = exportingId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-2xl border-2 border-white/8 bg-white/3 px-3 py-3 flex flex-col gap-2 shadow-chunky-press"
              >
                {/* Top row: play + name + meta */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePlay(s)}
                    className={[
                      "w-11 h-11 rounded-full grid place-items-center text-lg shrink-0",
                      "border-2 transition-all shadow-chunky-press",
                      "active:scale-95",
                      isPlaying
                        ? "bg-grvd-purple/30 border-grvd-purple text-white shadow-glow-purple"
                        : "bg-white/6 border-white/12 text-white/70",
                    ].join(" ")}
                    title={isPlaying ? "pause" : "play"}
                  >
                    {isPlaying ? "❚❚" : "▶"}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg text-white truncate leading-tight">
                      {s.name}
                    </div>
                    <div className="font-mono text-[10px] text-white/50 mt-0.5 truncate">
                      {s.bpm} bpm · {s.bars} bars · {s.layers.map((l) => l.kind).join(", ")}
                    </div>
                  </div>
                </div>

                {/* Tag stickers */}
                <div className="flex flex-wrap gap-1.5">
                  {s.tags.map((t) => (
                    <ChunkyBadge key={t} variant="ghost" size="sm">#{t}</ChunkyBadge>
                  ))}
                  {s.collaborators.length > 1 && (
                    <ChunkyBadge variant="cyan" size="sm" icon="🤝">
                      {s.collaborators.join(" × ")}
                    </ChunkyBadge>
                  )}
                  {s.collaborators.length > 1 && (
                    <button
                      onClick={() => setLockSongId(s.id)}
                      title={s.publishedPublicationId
                        ? "check edit-lock status for this group song"
                        : "publish first to set up the group lock"}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-display text-[11px] text-grvd-purple bg-grvd-purple/15 border border-grvd-purple/35 shadow-chunky-press hover:bg-grvd-purple/25 transition-colors"
                    >
                      🔒 group song
                    </button>
                  )}
                  {s.pitchScore !== undefined && (
                    <ChunkyBadge variant="gold" size="sm" icon="🎤">
                      {s.pitchScore}/100
                    </ChunkyBadge>
                  )}
                </div>

                {/* Action row */}
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  {/* Re-enter the editor for this saved song.
                   * editSong rehydrates activeTemplate + layers + vocal
                   * blob URL + arrangeMutes from the inventory row, then
                   * routes to arrange/mixer. Returns false if the song's
                   * template is unknown (e.g. deprecated since save). */}
                  <ChunkyPill
                    variant="cyan"
                    size="sm"
                    icon="🎚️"
                    onClick={() => {
                      stopSong();
                      const ok = editSong(s.id, "arrange");
                      if (ok) toggleLogbook();
                      else sayLine("can't load that song's template", 2400);
                    }}
                  >
                    arrange
                  </ChunkyPill>
                  <ChunkyPill
                    variant="magenta"
                    size="sm"
                    icon="🎛️"
                    onClick={() => {
                      stopSong();
                      const ok = editSong(s.id, "mixer");
                      if (ok) toggleLogbook();
                      else sayLine("can't load that song's template", 2400);
                    }}
                  >
                    mix
                  </ChunkyPill>
                  <ChunkyPill
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadWav(s)}
                    disabled={exportingId !== null}
                  >
                    {isExporting ? "⏳ rendering…" : "⬇ .wav"}
                  </ChunkyPill>
                  <ChunkyButton
                    variant={isPublished ? "ghost" : "hero"}
                    size="sm"
                    onClick={() => publishSong(s.id)}
                    disabled={isPublished || isPublishing || !canAfford}
                    className="ml-auto"
                    title={
                      isPublished ? "already live in the booth" :
                      !canAfford ? `need ${ENERGY_COSTS.publishSong - liveEnergy} more ⚡` :
                      `publish (-${ENERGY_COSTS.publishSong} ⚡)`
                    }
                  >
                    {isPublished
                      ? "✓ published"
                      : isPublishing
                        ? "⏳ publishing…"
                        : !canAfford
                          ? `${ENERGY_COSTS.publishSong}⚡ short`
                          : `publish · ${ENERGY_COSTS.publishSong}⚡`}
                  </ChunkyButton>
                </div>
              </div>
            );
          })}
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
    <Modal
      open
      onClose={onClose}
      kicker="🔒 group song"
      title={song.name}
      subtitle="who needs to be in the room to edit"
    >
      <div className="flex flex-col gap-3 pb-2">
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
            <div className="opacity-55 text-[10px] mt-1">
              the actual edit flow ships in a later update; this is just the
              door, not the room.
            </div>
          </Note>
        )}

        {result && !result.canEdit && (
          <>
            <Note kind="lock">{lockHeadline(result.reason)}</Note>

            {result.missingCollaborators.length > 0 && (
              <Section title="needs back in the room">
                {result.missingCollaborators.map((id) => (
                  <code key={id} className={chipMonoCx}>{shortId(id)}</code>
                ))}
              </Section>
            )}

            {result.missingSounds.length > 0 && (
              <Section title="missing materials">
                {result.missingSounds.map((m, i) => (
                  <div key={i} className="inline-flex items-center gap-1.5">
                    <code className={chipMonoCx}>{m.soundId}</code>
                    <span className="opacity-50 text-[9px]">owned by</span>
                    <code className={chipMonoCx}>{shortId(m.sourceOwnerId)}</code>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
    </Modal>
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
  const cx = {
    info:    "bg-grvd-purple/10 border-grvd-purple/30 text-white/75",
    success: "bg-grvd-lime/10 border-grvd-lime/30 text-grvd-lime",
    error:   "bg-red-400/10 border-red-400/30 text-red-300",
    lock:    "bg-grvd-gold/10 border-grvd-gold/30 text-grvd-gold",
  }[kind];
  return (
    <div className={[
      "rounded-2xl border px-3 py-2.5",
      "font-mono text-[11px] leading-relaxed",
      "shadow-chunky-press",
      cx,
    ].join(" ")}>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-white/55">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {children}
      </div>
    </div>
  );
}

const chipMonoCx = [
  "font-mono text-[10px]",
  "bg-white/6 border border-white/10 rounded-md",
  "px-1.5 py-0.5 text-white/85",
].join(" ");
