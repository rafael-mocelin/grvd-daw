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
    return <Wrapper onBack={() => setStage("home")}><div style={emptyState}>loading drops…</div></Wrapper>;
  }
  if (!song) {
    return (
      <Wrapper onBack={() => setStage("home")}>
        <div style={emptyState}>no drops yet. check back soon — artists are cooking.</div>
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
        style={{
          background: "linear-gradient(135deg, rgba(34,211,238,0.05) 0%, rgba(0,0,0,0.4) 100%)",
          border: `1px solid ${revealed ? accentColor + "55" : "rgba(255,255,255,0.08)"}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          boxShadow: revealed
            ? `0 0 22px ${accentColor}33, 0 6px 20px rgba(0,0,0,0.5)`
            : "0 4px 18px rgba(0,0,0,0.45)",
          transition: "border-color 350ms ease, box-shadow 350ms ease",
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
        <div style={{ position: "relative", width: 104, height: 104 }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}77 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 52,
              lineHeight: 1,
              boxShadow: `0 8px 22px ${accentColor}55, inset 0 2px 0 rgba(255,255,255,0.22)`,
              filter: revealed ? "none" : "blur(18px) saturate(1.3)",
              transition: "filter 500ms ease",
              userSelect: "none",
            }}
          >
            <span style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))" }}>
              {song.artistAvatar || "🎧"}
            </span>
          </div>
          {!revealed && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 38,
                opacity: 0.85,
                pointerEvents: "none",
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
              }}
            >
              🎧
            </div>
          )}
        </div>

        {/* ── Title + artist OR anonymous placeholder ────── */}
        <div style={{ textAlign: "center", minHeight: 48 }}>
          {revealed ? (
            <>
              <div
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                }}
              >
                {song.title}
              </div>
              <button
                onClick={() => song.artistId && useStore.getState().openProfile(song.artistId)}
                title={`open ${song.artistName}'s profile`}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  fontFamily: "monospace",
                  fontSize: 11,
                  color: "rgba(255,255,255,0.75)",
                  marginTop: 2,
                  textDecoration: "underline",
                  textDecorationColor: "rgba(255,255,255,0.15)",
                  textUnderlineOffset: 3,
                }}
              >
                {song.artistName}
                {/* Phase 5.A — group attribution. Tap the primary artist
                 * to open their profile; collaborators are listed inline
                 * but non-tappable for now (future iteration: make each
                 * name its own tappable link). */}
                {song.collaboratorNames.length > 0 && (
                  <span style={{ opacity: 0.7 }}>
                    {" × "}
                    {song.collaboratorNames.join(" × ")}
                  </span>
                )}
              </button>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 4,
                  letterSpacing: "0.05em",
                }}
              >
                {song.bpm ? `${song.bpm} BPM` : ""}
                {song.bpm && song.keyRoot ? " · " : ""}
                {song.keyRoot ? song.keyRoot : ""}
                {(song.bpm || song.keyRoot) && song.durationSec ? " · " : ""}
                {song.durationSec ? formatDuration(song.durationSec) : ""}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "rgba(255,255,255,0.5)",
                  fontStyle: "italic",
                  letterSpacing: "0.02em",
                }}
              >
                focus on the audio
              </div>
              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 3,
                  letterSpacing: "0.05em",
                }}
              >
                artist reveals after {REVEAL_MS / 1000}s · let the beat speak first
              </div>
            </>
          )}
        </div>

        {/* ── Play + skip controls ───────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <NavBtn label="←" title="previous" onClick={prev} disabled={index === 0} />
          <button
            onClick={togglePlay}
            title={
              !song.audioUrl
                ? "no audio — tap to reveal"
                : isPlaying ? "pause (space)" : "play (space)"
            }
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              border: "none",
              background: isPlaying
                ? "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)"
                : "rgba(255,255,255,0.12)",
              color: "#fff",
              fontSize: 20,
              cursor: "pointer",
              boxShadow: isPlaying ? "0 0 18px rgba(34,211,238,0.55)" : "0 4px 10px rgba(0,0,0,0.45)",
              transition: "background 150ms ease, box-shadow 150ms ease",
              // Use a glyph with strong font support so it never renders as tofu.
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
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
          <div
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.06)",
              flexWrap: "wrap",
            }}
          >
            <StarRater userStars={userStars} onRate={(s) => rateSong(song.songId, s)} />

            <div
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                color: "rgba(255,255,255,0.5)",
                display: "flex",
                gap: 10,
              }}
            >
              <span title={`${song.ratingCount} ${song.ratingCount === 1 ? "rating" : "ratings"}`}>
                ⭐ {song.ratingCount > 0 ? song.avgStars.toFixed(1) : "–"}
                <span style={{ opacity: 0.55 }}> ({song.ratingCount})</span>
              </span>
              <span title={`${song.endorsementCount} endorsements`}>
                🔥 {song.endorsementCount}
              </span>
            </div>

            <button
              onClick={() => {
                if (!canEndorse) return;
                // Open the EndorseSheet instead of spending immediately.
                // The actual endorseSong call happens inside the modal's
                // confirm handler below. See also TASTEMAKER_PLAN.md § 6.
                setEndorsePromptOpen(true);
              }}
              disabled={!canEndorse}
              title={
                endorsed
                  ? "already pushed"
                  : liveEnergy < ENERGY_COSTS.endorse
                    ? `need ${ENERGY_COSTS.endorse - liveEnergy} more energy`
                    : `push this drop (-${ENERGY_COSTS.endorse} ⚡)`
              }
              style={{
                background: endorsed
                  ? "rgba(255,77,109,0.18)"
                  : canEndorse
                    ? "linear-gradient(135deg, #ff4d6d 0%, #facc15 100%)"
                    : "rgba(255,255,255,0.04)",
                border: endorsed
                  ? "1px solid rgba(255,77,109,0.5)"
                  : canEndorse
                    ? "1px solid rgba(255,77,109,0.6)"
                    : "1px solid rgba(255,255,255,0.08)",
                color: endorsed
                  ? "#ff4d6d"
                  : canEndorse
                    ? "#fff"
                    : "rgba(255,255,255,0.3)",
                fontFamily: "monospace",
                fontSize: 11,
                fontWeight: 800,
                padding: "6px 12px",
                borderRadius: 8,
                cursor: endorsed ? "default" : canEndorse ? "pointer" : "not-allowed",
                flexShrink: 0,
                boxShadow: canEndorse && !endorsed ? "0 0 10px rgba(255,77,109,0.3)" : "none",
                transition: "all 120ms ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {endorsed ? (
                <>🔥 pushed</>
              ) : (
                <>push <span style={{ opacity: 0.8 }}>·</span> {ENERGY_COSTS.endorse}⚡</>
              )}
            </button>
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
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm push"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 380,
          width: "100%",
          background: "linear-gradient(135deg, rgba(255,77,109,0.12) 0%, rgba(0,0,0,0.6) 100%)",
          border: "1px solid rgba(255,77,109,0.4)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 24px rgba(255,77,109,0.2)",
          color: "#fff",
          fontFamily: "'Space Grotesk', system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#ff4d6d",
          }}
        >
          🔥 push this drop
        </div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            lineHeight: 1.1,
          }}
        >
          {song.title}
        </div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            color: "rgba(255,255,255,0.65)",
            marginTop: -6,
          }}
        >
          {song.artistAvatar || "🎧"}  {song.artistName}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 6,
          }}
        >
          <SheetStat
            label="cost"
            value={`-${cost} ⚡`}
            accent="#ff4d6d"
          />
          <SheetStat
            label="you'll have"
            value={`${Math.max(0, liveEnergy - cost)} / 100 ⚡`}
            accent="rgba(255,255,255,0.9)"
          />
        </div>

        <p
          style={{
            fontSize: 11,
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.65)",
            margin: "4px 0 0",
          }}
        >
          pushing bumps this drop's visibility and signals your taste. early pushes earn bonus XP if it trends.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.8)",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            not yet
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #ff4d6d 0%, #facc15 100%)",
              border: "1px solid rgba(255,77,109,0.7)",
              color: "#fff",
              fontFamily: "monospace",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 0 14px rgba(255,77,109,0.35)",
            }}
          >
            push · {cost}⚡
          </button>
        </div>
      </div>
    </div>
  );
}

function SheetStat({
  label, value, accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        padding: "8px 10px",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 9,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "monospace",
          fontSize: 14,
          fontWeight: 800,
          color: accent,
          marginTop: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
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
    <div
      style={{
        padding: "34px 14px 80px", // top pad clears the ScreenTopBar
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#22d3ee",
            }}
          >
            🎧 listening booth
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              marginTop: 2,
            }}
          >
            fresh drops
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.4)",
              marginTop: 2,
            }}
          >
            {typeof idx === "number" && typeof total === "number" && total > 0
              ? `track ${idx + 1} of ${total}`
              : "rate freely · push with energy"}
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          ← back
        </button>
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
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        color: disabled ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.7)",
        fontSize: 16,
        fontFamily: "monospace",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "background 120ms ease, color 120ms ease",
      }}
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
      style={{ display: "flex", alignItems: "center", gap: 2 }}
      onMouseLeave={() => setHover(0)}
      title={userStars ? `your rating: ${userStars}★` : "rate this drop"}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onRate(n)}
          title={`rate ${n} star${n === 1 ? "" : "s"}`}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            lineHeight: 1,
            padding: "2px 1px",
            color: n <= active ? "#facc15" : "rgba(255,255,255,0.2)",
            filter: n <= active ? "drop-shadow(0 0 5px #facc15aa)" : "none",
            transition: "color 80ms ease, filter 80ms ease",
          }}
        >
          ★
        </button>
      ))}
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

const emptyState: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 12,
};

// Keep the PublishedSong type reachable for downstream tooling / future splits.
export type { PublishedSong };
