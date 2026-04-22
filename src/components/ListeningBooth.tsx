/**
 * ListeningBooth — the Tastemaker-tier drop radio.
 *
 * Pulls from `song_publications` via the store's publishedCatalog and lets the
 * player:
 *   • Stream each track (plays the MP3/WAV published by the artist)
 *   • Rate 1-5 stars (earns daily-capped XP via rate_song RPC)
 *   • Endorse a track ("push it") which spends energy and earns XP
 *
 * Free actions: listen + rate. Energy-gated: endorse.
 * Guests get the browsing/listening experience but mutations no-op server-side.
 *
 * Design goals:
 *   • Tactile — each card feels like a 45 on a counter at a record shop
 *   • Honest aggregates — ratingCount + avgStars + endorsementCount all visible
 *   • Low-friction listening — one click plays; clicking another card swaps
 */

import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { stopSong } from "../audio/engine";
import type { PublishedSong } from "../lib/game-db";

/* -------------------------------------------------------------------------- */
/* Root                                                                        */
/* -------------------------------------------------------------------------- */

export function ListeningBooth() {
  const publishedCatalog = useStore((s) => s.publishedCatalog);
  const catalogLoading   = useStore((s) => s.catalogLoading);
  const loadPublishedCatalog = useStore((s) => s.loadPublishedCatalog);
  const userRatings      = useStore((s) => s.userRatings);
  const userEndorsements = useStore((s) => s.userEndorsements);
  const rateSong         = useStore((s) => s.rateSong);
  const endorseSong      = useStore((s) => s.endorseSong);
  const energy           = useStore((s) => s.energy);
  const energyUpdatedAt  = useStore((s) => s.energyUpdatedAt);
  const setStage         = useStore((s) => s.setStage);
  const sayLine          = useStore((s) => s.sayLine);

  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);

  // Load on mount (works for guests too — catalog is public read).
  useEffect(() => {
    // Ensure the DAW engine isn't still playing a recipe when we enter.
    stopSong();
    if (publishedCatalog.length === 0 && !catalogLoading) {
      loadPublishedCatalog();
    }
    // Fresh-ears greeting
    sayLine("fresh drops. tap a card to listen.", 2600);
    // Make sure audio stops when leaving the booth.
    return () => {
      setNowPlayingId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const liveEnergy = computeLiveEnergy(energy, energyUpdatedAt);

  return (
    <div
      style={{
        padding: "34px 14px 80px", // top pad clears the ScreenTopBar
        display: "flex",
        flexDirection: "column",
        gap: 12,
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      <Header onBack={() => { setNowPlayingId(null); setStage("home"); }} />

      {catalogLoading && publishedCatalog.length === 0 && (
        <div style={emptyState}>loading drops…</div>
      )}

      {!catalogLoading && publishedCatalog.length === 0 && (
        <div style={emptyState}>
          no drops yet. check back soon — artists are cooking.
        </div>
      )}

      {publishedCatalog.map((song) => (
        <SongCard
          key={song.songId}
          song={song}
          userStars={userRatings[song.songId]}
          endorsed={userEndorsements.includes(song.songId)}
          isPlaying={nowPlayingId === song.songId}
          liveEnergy={liveEnergy}
          onPlay={() => setNowPlayingId((id) => (id === song.songId ? null : song.songId))}
          onRate={(stars) => rateSong(song.songId, stars)}
          onEndorse={() => endorseSong(song.songId)}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                      */
/* -------------------------------------------------------------------------- */

function Header({ onBack }: { onBack: () => void }) {
  return (
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
          rate freely · push with energy
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
  );
}

/* -------------------------------------------------------------------------- */
/* Song card                                                                   */
/* -------------------------------------------------------------------------- */

function SongCard({
  song,
  userStars,
  endorsed,
  isPlaying,
  liveEnergy,
  onPlay,
  onRate,
  onEndorse,
}: {
  song: PublishedSong;
  userStars: number | undefined;
  endorsed: boolean;
  isPlaying: boolean;
  liveEnergy: number;
  onPlay: () => void;
  onRate: (stars: number) => void;
  onEndorse: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync play/pause with isPlaying flag
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.play().catch(() => { /* autoplay blocked; user can tap again */ });
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [isPlaying]);

  const avgStars = song.ratingCount > 0 ? song.avgStars.toFixed(1) : "–";
  const canEndorse = !endorsed && liveEnergy >= ENERGY_COSTS.endorse;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(0,0,0,0.35) 100%)",
        border: isPlaying
          ? "1.5px solid rgba(34,211,238,0.55)"
          : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: isPlaying
          ? "0 0 18px rgba(34,211,238,0.25), 0 4px 14px rgba(0,0,0,0.45)"
          : "0 2px 10px rgba(0,0,0,0.35)",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
      }}
    >
      {/* Hidden audio element */}
      {song.audioUrl && (
        <audio
          ref={audioRef}
          src={song.audioUrl}
          preload="none"
          onEnded={onPlay /* toggle back off */}
        />
      )}

      {/* Top row: play + title + artist */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onPlay}
          disabled={!song.audioUrl}
          title={song.audioUrl ? (isPlaying ? "pause" : "play") : "no audio"}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: "none",
            background: isPlaying
              ? "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)"
              : "rgba(255,255,255,0.08)",
            color: "#fff",
            fontSize: 16,
            cursor: song.audioUrl ? "pointer" : "not-allowed",
            opacity: song.audioUrl ? 1 : 0.35,
            flexShrink: 0,
            boxShadow: isPlaying ? "0 0 14px rgba(34,211,238,0.5)" : "none",
          }}
        >
          {isPlaying ? "▮▮" : "▶"}
        </button>
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {song.title}
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              color: "rgba(255,255,255,0.55)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {song.artistName}
            {song.bpm ? ` · ${song.bpm} BPM` : ""}
            {song.keyRoot ? ` · ${song.keyRoot}` : ""}
            {song.durationSec ? ` · ${formatDuration(song.durationSec)}` : ""}
          </div>
        </div>
      </div>

      {/* Bottom row: rating + aggregates + endorse */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <StarRater userStars={userStars} onRate={onRate} />
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.5)",
            display: "flex",
            gap: 10,
            flex: 1,
            minWidth: 0,
          }}
        >
          <span title={`${song.ratingCount} ${song.ratingCount === 1 ? "rating" : "ratings"}`}>
            ⭐ {avgStars} <span style={{ opacity: 0.6 }}>({song.ratingCount})</span>
          </span>
          <span title={`${song.endorsementCount} endorsements`}>
            🔥 {song.endorsementCount}
          </span>
        </div>
        <button
          onClick={() => canEndorse && onEndorse()}
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
          }}
        >
          {endorsed ? "🔥 pushed" : `push · ${ENERGY_COSTS.endorse}⚡`}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Star rater                                                                  */
/* -------------------------------------------------------------------------- */

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
            fontSize: 16,
            lineHeight: 1,
            padding: "2px 1px",
            color: n <= active ? "#facc15" : "rgba(255,255,255,0.2)",
            filter: n <= active ? "drop-shadow(0 0 4px #facc15aa)" : "none",
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
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
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
