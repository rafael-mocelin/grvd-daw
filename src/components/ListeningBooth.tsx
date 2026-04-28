/**
 * ListeningBooth — the Tastemaker-tier drop radio.
 *
 * The core mechanic is "let the beat speak first." Each drop plays
 * anonymously; after REVEAL_MS of active listening, the artist + song
 * details fade in and the player can rate (free, daily-capped XP) or
 * push (spends energy via endorseSong RPC).
 *
 * The catalog comes from `song_publications` (via store.publishedCatalog).
 * Guests can browse + listen + rate locally; server writes no-op without
 * a user_id.
 *
 * Keyboard: ← / → skip, space toggles play, 1-5 rates.
 *
 * Songs you've already rated or pushed are considered "known" and skip
 * the blur on return.
 */

import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { stopSong } from "../audio/engine";
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";
import { Modal } from "../ui/Modal";
import type { PublishedSong } from "../lib/game-db";

/** Milliseconds of active listening before the artist is revealed. */
const REVEAL_MS = 5000;

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export function ListeningBooth() {
  const publishedCatalog    = useStore((s) => s.publishedCatalog);
  const catalogLoading      = useStore((s) => s.catalogLoading);
  const loadPublishedCatalog = useStore((s) => s.loadPublishedCatalog);
  const userRatings         = useStore((s) => s.userRatings);
  const userEndorsements    = useStore((s) => s.userEndorsements);
  const rateSong            = useStore((s) => s.rateSong);
  const endorseSong         = useStore((s) => s.endorseSong);
  const energy              = useStore((s) => s.energy);
  const energyUpdatedAt     = useStore((s) => s.energyUpdatedAt);
  const setStage            = useStore((s) => s.setStage);
  const sayLine             = useStore((s) => s.sayLine);

  const [index, setIndex]         = useState(0);
  const [listenMs, setListenMs]   = useState(0);
  const [revealed, setRevealed]   = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playPos, setPlayPos]     = useState(0);  // seconds elapsed in current track
  const [playDur, setPlayDur]     = useState(0);  // seconds total (from metadata)
  // EndorseSheet state — when the player taps "push", we open a confirmation
  // modal instead of spending immediately. Only committing on explicit
  // confirm makes the energy spend feel deliberate (the "scarcity ritual"
  // called out in TASTEMAKER_PLAN.md § 6).
  const [endorsePromptOpen, setEndorsePromptOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const song = publishedCatalog[index];
  const userStars = song ? userRatings[song.songId] : undefined;
  const endorsed  = song ? userEndorsements.includes(song.songId) : false;

  /* ── mount: ensure DAW engine is quiet, load catalog, greet ── */
  useEffect(() => {
    stopSong();
    if (publishedCatalog.length === 0 && !catalogLoading) {
      loadPublishedCatalog();
    }
    sayLine("fresh ears. let the beat speak first.", 2800);
    return () => {
      const el = audioRef.current;
      if (el) { el.pause(); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── song change: reset all per-song state ──
   *
   * The blind-listen mechanic is the whole point of the booth, so we
   * reset `revealed` to false on every song change regardless of whether
   * the user has already rated this drop before. You always listen
   * first. The only short-circuit is "no audio" (see togglePlay: tapping
   * play with no audio immediately reveals, since blur would be a dead
   * end).
   *
   * The <audio> element is keyed by song.songId below so React remounts
   * it fresh per song; combined with the `autoPlay` attribute, that's
   * the most browser-reliable way to auto-start a new stream after a
   * user navigation. We don't touch the element imperatively.
   */
  useEffect(() => {
    setListenMs(0);
    setRevealed(false);
    setIsPlaying(false);
    setPlayPos(0);
    setPlayDur(song?.durationSec ?? 0);
  }, [song?.songId, song?.durationSec]);

  /* ── listening timer — only ticks while audio is actively playing ── */
  useEffect(() => {
    if (!isPlaying || revealed) return;
    const id = window.setInterval(() => {
      setListenMs((ms) => {
        const next = ms + 100;
        if (next >= REVEAL_MS) {
          setRevealed(true);
        }
        return Math.min(REVEAL_MS, next);
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [isPlaying, revealed]);

  /* ── companion reacts the moment the artist is unveiled ── */
  useEffect(() => {
    if (revealed) {
      sayLine("there they are", 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  /* ── keyboard: ← → skip, space play/pause, 1-5 rate ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!song) return;
      if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      else if (e.key === "ArrowLeft")  { e.preventDefault(); prev(); }
      else if (e.key === " ")          { e.preventDefault(); togglePlay(); }
      else if (revealed && ["1","2","3","4","5"].includes(e.key)) {
        e.preventDefault();
        rateSong(song.songId, Number(e.key));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song, revealed, index, publishedCatalog.length]);

  function togglePlay() {
    // If the drop has no audio yet, the play button acts as a "reveal"
    // shortcut so the card isn't stuck behind the blur.
    if (!song?.audioUrl) {
      setRevealed(true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
      setIsPlaying(false);
    } else {
      el.play().then(() => setIsPlaying(true)).catch(() => { /* blocked */ });
    }
  }

  function next() {
    setIndex((i) => Math.min(publishedCatalog.length - 1, i + 1));
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  const liveEnergy = computeLiveEnergy(energy, energyUpdatedAt);

  /* ── empty / loading states ─────────────────────────────────── */
  if (catalogLoading && publishedCatalog.length === 0) {
    return (
      <Wrapper onBack={() => setStage("home")}>
        <div className={emptyStateCx}>loading drops…</div>
      </Wrapper>
    );
  }
  if (!song) {
    return (
      <Wrapper onBack={() => setStage("home")}>
        <div className={emptyStateCx}>no drops yet. check back soon — artists are cooking.</div>
      </Wrapper>
    );
  }

  const progressPct = (listenMs / REVEAL_MS) * 100;
  const canEndorse  = !endorsed && liveEnergy >= ENERGY_COSTS.endorse;
  const accentColor = artistHue(song.artistName);

  return (
    <Wrapper onBack={() => setStage("home")} idx={index} total={publishedCatalog.length}>
      {/*
       * Audio element — keyed by songId so React fully remounts it on each
       * song change. Combined with the `autoPlay` attribute, this is the
       * most browser-reliable way to auto-start a fresh stream after a
       * user navigation (much more forgiving than calling .play() inside
       * a useEffect, which can miss the gesture window).
       *
       * If a song has no audio_url, we skip the element entirely and the
       * card falls through to an auto-reveal "no audio yet" state below.
       */}
      {song.audioUrl && (
        <audio
          key={song.songId}
          ref={audioRef}
          src={song.audioUrl}
          autoPlay
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); if (revealed) next(); }}
          onLoadedMetadata={(e) => {
            // Prefer the stream's real duration over the snapshot column
            // (song_publications.duration_sec) — sometimes the published
            // value is stale or wrong. The MP3's metadata is truth.
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setPlayDur(d);
          }}
          onTimeUpdate={(e) => setPlayPos(e.currentTarget.currentTime)}
        />
      )}

      <div
        className="rounded-3xl border-2 p-5 flex flex-col items-center gap-4 transition-all duration-500"
        style={{
          background: "linear-gradient(155deg, rgba(34,211,238,0.06) 0%, rgba(167,139,250,0.04) 60%, rgba(0,0,0,0.5) 100%)",
          borderColor: revealed ? `${accentColor}66` : "rgba(255,255,255,0.10)",
          boxShadow: revealed
            ? `0 12px 32px rgba(0,0,0,0.5), 0 4px 0 rgba(0,0,0,0.4), 0 0 36px ${accentColor}44`
            : "0 12px 32px rgba(0,0,0,0.5), 0 4px 0 rgba(0,0,0,0.4)",
        }}
      >
        {/* ── Progress bar ──────────────────────────────────
         *
         * One visual slot, two modes. Pre-reveal it shows the listening
         * countdown (5s until the artist is unveiled) with a cyan→blue
         * gradient. Post-reveal it turns into the song's playback bar
         * filled to the current position. Fixed-width, not draggable —
         * a drop has to be listened to in full, no seeking allowed.
         */}
        <PlaybackBar
          revealed={revealed}
          accentColor={accentColor}
          revealProgressPct={progressPct}
          playPos={playPos}
          playDur={playDur > 0 ? playDur : REVEAL_MS / 1000}
          caption={
            revealed
              ? (song.audioUrl ? `${formatDuration(playPos)} / ${formatDuration(playDur || 0)}` : "no audio yet")
              : isPlaying
                ? `listening… ${(listenMs / 1000).toFixed(1)}s / ${REVEAL_MS / 1000}s`
                : "tap play · focus on the audio first"
          }
        />

        {/* ── Avatar / identity ─────────────────────────────
         *
         * Emoji-based. Each artist picks a "profile picture" at publish
         * time (stored in song_publications.artist_avatar). Pre-reveal
         * the emoji is heavily blurred behind a generic 🎧 badge so the
         * player has no visual cue about who made the track — the whole
         * point is to judge the audio first, not the artist.
         */}
        {/* Vinyl-disc avatar — concentric grooves, label center, spins
         * while playing. Pre-reveal: blurred + masked behind a 🎧 sticker
         * so the audio gets attention first. */}
        <div className="relative w-[140px] h-[140px]">
          <div
            className="w-full h-full rounded-full select-none transition-[filter] duration-500"
            style={{
              background: `
                radial-gradient(circle at 50% 50%, ${accentColor} 0%, ${accentColor}aa 22%, transparent 24%),
                repeating-radial-gradient(circle at center, rgba(255,255,255,0.04) 0 1.5px, transparent 1.5px 5px),
                radial-gradient(circle at 30% 30%, rgba(255,255,255,0.18) 0%, transparent 35%),
                #0a0814
              `,
              boxShadow: `0 12px 28px ${accentColor}55, 0 4px 0 rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.18)`,
              filter: revealed ? "none" : "blur(16px) saturate(1.2)",
              animation: isPlaying && revealed ? "vinylSpin 5.5s linear infinite" : undefined,
            }}
          >
            {/* Center label — gradient disc with the artist's emoji */}
            <div
              className="absolute inset-0 m-auto rounded-full flex items-center justify-center"
              style={{
                width: 70,
                height: 70,
                top: 0, bottom: 0, left: 0, right: 0,
                background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}aa 100%)`,
                fontSize: 34,
                lineHeight: 1,
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.2), 0 0 8px rgba(0,0,0,0.4)",
              }}
            >
              <span style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }}>
                {song.artistAvatar || "🎧"}
              </span>
            </div>
            {/* Spindle hole */}
            <div
              className="absolute rounded-full bg-grvd-base"
              style={{
                width: 8, height: 8, top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6)",
              }}
            />
          </div>
          {!revealed && (
            <div
              className="absolute inset-0 flex items-center justify-center text-5xl pointer-events-none"
              style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))" }}
            >
              🎧
            </div>
          )}
          <style>{`@keyframes vinylSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* ── Title + artist OR anonymous placeholder ────── */}
        <div className="text-center min-h-[60px] flex flex-col items-center gap-1">
          {revealed ? (
            <>
              <div className="font-display text-2xl text-white leading-tight animate-bubble-in">
                {song.title}
              </div>
              <button
                onClick={() => song.artistId && useStore.getState().openProfile(song.artistId)}
                title={`open ${song.artistName}'s profile`}
                className="font-mono text-[11px] text-white/75 hover:text-white underline decoration-white/20 underline-offset-2 transition-colors"
              >
                {song.artistName}
                {song.collaboratorNames.length > 0 && (
                  <span className="opacity-70">
                    {" × "}
                    {song.collaboratorNames.join(" × ")}
                  </span>
                )}
              </button>
              <div className="font-mono text-[9px] tracking-widest uppercase text-white/40 mt-0.5">
                {song.bpm ? `${song.bpm} BPM` : ""}
                {song.bpm && song.keyRoot ? " · " : ""}
                {song.keyRoot ? song.keyRoot : ""}
                {(song.bpm || song.keyRoot) && song.durationSec ? " · " : ""}
                {song.durationSec ? formatDuration(song.durationSec) : ""}
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-xl text-white/55 italic">
                focus on the audio
              </div>
              <div className="font-mono text-[10px] tracking-wide text-white/40">
                artist reveals after {REVEAL_MS / 1000}s · let the beat speak first
              </div>
            </>
          )}
        </div>

        {/* ── Play + skip controls ───────────────────────── */}
        <div className="flex items-center justify-center gap-4">
          <NavBtn label="←" title="previous" onClick={prev} disabled={index === 0} />
          <button
            onClick={togglePlay}
            title={
              !song.audioUrl
                ? "no audio — tap to reveal"
                : isPlaying ? "pause (space)" : "play (space)"
            }
            className={[
              "w-16 h-16 rounded-full grid place-items-center text-2xl text-white",
              "shadow-chunky active:shadow-chunky-press active:translate-y-[2px] active:scale-[0.96]",
              "transition-all duration-150",
              isPlaying
                ? "bg-gradient-to-br from-grvd-cyan to-grvd-purple shadow-glow-cyan"
                : "bg-grvd-panel border border-grvd-line",
            ].join(" ")}
            style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <NavBtn
            label="→"
            title="skip"
            onClick={next}
            disabled={index >= publishedCatalog.length - 1}
          />
        </div>

        {/* ── Rate + push row (only when revealed) ───────── */}
        {revealed && (
          <div className="w-full flex flex-col gap-3 pt-3 border-t border-white/8 animate-bubble-in">
            {/* Stat readout — mini chunky pills */}
            <div className="flex items-center justify-center gap-2 font-mono text-[10px]">
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-grvd-gold/10 border border-grvd-gold/25 text-grvd-gold tabular-nums"
                title={`${song.ratingCount} ${song.ratingCount === 1 ? "rating" : "ratings"}`}
              >
                ⭐ {song.ratingCount > 0 ? song.avgStars.toFixed(1) : "–"}
                <span className="opacity-55">({song.ratingCount})</span>
              </span>
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-grvd-magenta/10 border border-grvd-magenta/25 text-grvd-magenta tabular-nums"
                title={`${song.endorsementCount} endorsements`}
              >
                🔥 {song.endorsementCount}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <StarRater userStars={userStars} onRate={(s) => rateSong(song.songId, s)} />

              <button
                onClick={() => { if (canEndorse) setEndorsePromptOpen(true); }}
                disabled={!canEndorse}
                title={
                  endorsed
                    ? "already pushed"
                    : liveEnergy < ENERGY_COSTS.endorse
                      ? `need ${ENERGY_COSTS.endorse - liveEnergy} more energy`
                      : `push this drop (-${ENERGY_COSTS.endorse} ⚡)`
                }
                className={[
                  "inline-flex items-center gap-1.5",
                  "px-5 py-2.5 rounded-full font-display tracking-wider text-sm",
                  "shadow-chunky active:shadow-chunky-press active:translate-y-[2px] active:scale-[0.97]",
                  "transition-all duration-150 select-none shrink-0",
                  endorsed
                    ? "bg-grvd-magenta/20 border-2 border-grvd-magenta/55 text-grvd-magenta"
                    : canEndorse
                      ? "bg-gradient-to-r from-grvd-magenta to-grvd-orange text-white shadow-glow-magenta"
                      : "bg-grvd-panel border border-grvd-line text-white/30 cursor-not-allowed",
                ].join(" ")}
              >
                {endorsed ? "🔥 PUSHED" : `🔥 PUSH · ${ENERGY_COSTS.endorse}⚡`}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm-push ritual. Opens from the push button; commits on
       * confirm, closes on cancel. Portaled under the card so it floats
       * above the reveal card without stacking-context fights. */}
      {endorsePromptOpen && (
        <EndorseSheet
          song={song}
          cost={ENERGY_COSTS.endorse}
          liveEnergy={liveEnergy}
          onCancel={() => setEndorsePromptOpen(false)}
          onConfirm={async () => {
            setEndorsePromptOpen(false);
            await endorseSong(song.songId);
          }}
        />
      )}
    </Wrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* EndorseSheet — confirmation modal for energy spends                         */
/*                                                                             */
/* Shown when the player taps "push" on a revealed drop. Lists what they're   */
/* about to spend, what they get back, and forces an explicit confirm. The    */
/* store-level endorseSong already returns a message on failure; the sheet    */
/* closes optimistically and any failure surface lands in the companion       */
/* ticker. Design goal: make the spend feel deliberate, not reflexive.         */
/* -------------------------------------------------------------------------- */

function EndorseSheet({
  song,
  cost,
  liveEnergy,
  onCancel,
  onConfirm,
}: {
  song: PublishedSong;
  cost: number;
  liveEnergy: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open
      onClose={onCancel}
      kicker="🔥 push this drop"
      title={song.title}
      subtitle={`${song.artistAvatar || "🎧"}  ${song.artistName}`}
      accentText="text-grvd-magenta"
      accentShadow="shadow-[0_0_36px_rgba(255,77,156,0.22)]"
      footer={
        <div className="flex gap-2">
          <ChunkyPill variant="ghost" size="md" onClick={onCancel} className="flex-1">
            not yet
          </ChunkyPill>
          <ChunkyButton
            variant="magenta"
            size="md"
            icon="🔥"
            onClick={onConfirm}
            autoFocus
            className="flex-1"
          >
            push · {cost}⚡
          </ChunkyButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <div className="grid grid-cols-2 gap-2.5">
          <SheetStat label="cost"        value={`-${cost} ⚡`}                                  tint="magenta" />
          <SheetStat label="you'll have" value={`${Math.max(0, liveEnergy - cost)} / 100 ⚡`}   tint="white" />
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-white/55">
          pushing bumps this drop's visibility and signals your taste.
          early pushes earn bonus XP if it trends.
        </p>
      </div>
    </Modal>
  );
}

function SheetStat({
  label, value, tint = "white",
}: {
  label: string;
  value: string;
  tint?: "magenta" | "white";
}) {
  const valueClass = tint === "magenta" ? "text-grvd-magenta" : "text-white/90";
  return (
    <div className="rounded-2xl border border-white/8 bg-black/30 px-3 py-2 shadow-chunky-press">
      <div className="font-mono text-[9px] tracking-[0.18em] uppercase text-white/45">
        {label}
      </div>
      <div className={`font-display text-lg leading-none mt-1 tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page chrome                                                                  */
/* -------------------------------------------------------------------------- */

function Wrapper({
  children, onBack, idx, total,
}: {
  children: React.ReactNode;
  onBack: () => void;
  idx?: number;
  total?: number;
}) {
  return (
    <div className="pt-3 pb-8 flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <ChunkyPill onClick={onBack} icon="←" size="sm">
          back
        </ChunkyPill>
        <span className="font-display text-grvd-cyan text-[11px] tracking-widest uppercase">
          🎧 BOOTH
        </span>
        <span className="w-12" />
      </div>
      <div className="text-center px-2">
        <h2 className="font-display text-3xl text-white tracking-wide">
          FRESH DROPS
        </h2>
        <div className="mt-1 font-sans text-grvd-purple/70 text-[11px] tracking-widest uppercase">
          {typeof idx === "number" && typeof total === "number" && total > 0
            ? `track ${idx + 1} of ${total}`
            : "rate freely · push with energy"}
        </div>
      </div>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Controls                                                                     */
/* -------------------------------------------------------------------------- */

function NavBtn({
  label, title, onClick, disabled,
}: {
  label: string; title: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "w-11 h-11 rounded-full grid place-items-center",
        "text-base text-white/70",
        "bg-grvd-panel border border-grvd-line",
        "shadow-chunky-press active:translate-y-[1px]",
        "transition-all duration-150",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function StarRater({
  userStars,
  onRate,
}: {
  userStars: number | undefined;
  onRate: (stars: number) => void;
}) {
  const [hover, setHover] = useState<number>(0);
  const active = hover || userStars || 0;

  return (
    <div
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
      title={userStars ? `your rating: ${userStars}★` : "rate this drop"}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const lit = n <= active;
        return (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onClick={() => onRate(n)}
            title={`rate ${n} star${n === 1 ? "" : "s"}`}
            className={[
              "w-9 h-9 rounded-full inline-flex items-center justify-center",
              "text-2xl leading-none select-none transition-all duration-100",
              "active:scale-90",
              lit
                ? "text-grvd-gold drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]"
                : "text-white/20 hover:text-grvd-gold/70",
            ].join(" ")}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Playback / reveal bar                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Single visual slot that lives at the top of the booth card.
 *
 * Two modes, one shape:
 *   • Pre-reveal — shows the listening countdown (cyan→blue gradient
 *     filling from 0 to REVEAL_MS). This is the "focus on the audio"
 *     nag bar.
 *   • Post-reveal — turns into the song's playback bar filling to the
 *     current position. Fixed width, non-draggable — intentionally not
 *     a seekable slider. A drop has to be listened to from the top.
 *
 * The width of the container is consistent regardless of song length;
 * only the fill rate differs (longer song = slower-moving fill).
 */
function PlaybackBar({
  revealed,
  accentColor,
  revealProgressPct,
  playPos,
  playDur,
  caption,
}: {
  revealed: boolean;
  accentColor: string;
  revealProgressPct: number;  // 0..100 (how close to artist reveal)
  playPos: number;            // seconds into the track
  playDur: number;            // seconds total
  caption: string;
}) {
  const playPct = playDur > 0 ? Math.min(100, (playPos / playDur) * 100) : 0;
  const fillPct = revealed ? playPct : revealProgressPct;

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 6,
          background: "rgba(255,255,255,0.08)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fillPct}%`,
            height: "100%",
            background: revealed
              ? `linear-gradient(90deg, ${accentColor}dd 0%, ${accentColor} 100%)`
              : "linear-gradient(90deg, #22d3ee 0%, #3b82f6 100%)",
            boxShadow: revealed
              ? `0 0 10px ${accentColor}`
              : "0 0 8px rgba(59,130,246,0.6)",
            transition: "width 150ms linear, background 400ms ease",
          }}
        />
        {/* Playhead dot — post-reveal only, purely decorative */}
        {revealed && (
          <div
            style={{
              position: "absolute",
              left: `calc(${fillPct}% - 5px)`,
              top: -2,
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: `0 0 8px ${accentColor}`,
              transition: "left 150ms linear",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
          marginTop: 4,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {caption}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                      */
/* -------------------------------------------------------------------------- */

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Deterministic "avatar" color for a given artist name. Hashes the string
 * to a hue in [0, 360) so each artist has a consistent identity across
 * sessions without us storing real avatars in the DB.
 */
function artistHue(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  const hue = h % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

const emptyStateCx = [
  "rounded-2xl border border-dashed border-white/12",
  "px-5 py-10 text-center",
  "font-mono text-[11px] text-white/45",
].join(" ");

// Keep the PublishedSong type reachable for downstream tooling / future splits.
export type { PublishedSong };
