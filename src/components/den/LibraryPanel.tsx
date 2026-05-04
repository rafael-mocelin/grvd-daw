/**
 * LibraryPanel — slide-out panel listing every track saved to the den
 * library. Tap a track to play it back (just the drum pattern in v1).
 *
 * Cover art is generative — a CSS gradient + glyph + accent ring driven
 * by the track's persisted cover seed.
 */

import { useEffect, useState } from "react";
import { useDenStore, type DenTrack } from "../../lib/denStore";
import { startDrumPattern, stopDrumPattern } from "../../audio/denEngine";

interface LibraryPanelProps {
  onClose: () => void;
}

export function LibraryPanel({ onClose }: LibraryPanelProps) {
  const library = useDenStore((s) => s.library);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    return () => { stopDrumPattern(); };
  }, []);

  async function togglePlay(track: DenTrack) {
    if (playingId === track.id) {
      stopDrumPattern();
      setPlayingId(null);
      return;
    }
    if (!track.drumPattern) return;
    await startDrumPattern(track.drumPattern, track.bpm);
    setPlayingId(track.id);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        display: "flex",
        animation: "denLibraryIn 0.22s ease-out both",
      }}
    >
      {/* backdrop */}
      <div
        onClick={() => { stopDrumPattern(); onClose(); }}
        style={{
          flex: 1,
          background: "rgba(8, 10, 24, 0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          cursor: "pointer",
        }}
      />

      <div
        style={{
          width: "min(100%, 420px)",
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          borderLeft: "2.5px solid #0a0f1c",
          boxShadow: "inset 2px 0 0 rgba(255,255,255,0.18), 0 0 32px rgba(0,0,0,0.55)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          animation: "denLibrarySlide 0.32s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* header */}
        <div
          style={{
            flexShrink: 0,
            padding: "16px 18px 12px",
            borderBottom: "1.5px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.32em",
              color: "#a78bfa",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            ★ YOUR LIBRARY ★
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 26,
                color: "#fff",
                letterSpacing: 1,
                lineHeight: 1.05,
                textShadow: "0 2px 0 rgba(0,0,0,0.6)",
              }}
            >
              TRACKS
            </div>
            <button
              onClick={() => { stopDrumPattern(); onClose(); }}
              aria-label="close"
              style={{
                width: 28, height: 28, borderRadius: 14,
                border: "1.5px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.7)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 14, fontWeight: 700,
                cursor: "pointer",
                padding: 0, lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: "rgba(255,255,255,0.55)",
              letterSpacing: "0.06em",
            }}
          >
            {library.length} {library.length === 1 ? "track" : "tracks"} saved
          </div>
        </div>

        {/* tracks */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 18px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {library.length === 0 ? (
            <div
              style={{
                padding: "32px 18px",
                textAlign: "center",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.08em",
                fontStyle: "italic",
              }}
            >
              no tracks yet — visit a station to make one
            </div>
          ) : (
            library.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                playing={playingId === track.id}
                onTogglePlay={() => togglePlay(track)}
              />
            ))
          )}
        </div>

        <style>{`
          @keyframes denLibraryIn {
            0%   { opacity: 0; }
            100% { opacity: 1; }
          }
          @keyframes denLibrarySlide {
            0%   { transform: translateX(100%); }
            100% { transform: translateX(0);    }
          }
        `}</style>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Track row + cover art                                                       */
/* -------------------------------------------------------------------------- */

function TrackRow({
  track, playing, onTogglePlay,
}: { track: DenTrack; playing: boolean; onTogglePlay: () => void }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        background: playing
          ? "linear-gradient(180deg, rgba(74, 222, 128, 0.20), rgba(15, 24, 40, 0.85))"
          : "linear-gradient(180deg, rgba(36, 51, 88, 0.65), rgba(15, 24, 40, 0.65))",
        border: `1.5px solid ${playing ? "#4ade80" : "rgba(255,255,255,0.10)"}`,
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      <CoverArt cover={track.cover} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 16,
            color: "#fff",
            letterSpacing: 0.5,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {track.name}
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.08em",
            marginTop: 2,
          }}
        >
          {track.bpm} BPM · {new Date(track.createdAt).toLocaleDateString()}
        </div>
      </div>
      <button
        onClick={onTogglePlay}
        style={{
          padding: "8px 12px",
          borderRadius: 10,
          border: "2px solid #0a0f1c",
          background: playing
            ? "linear-gradient(180deg, #facc15, #a07a0c)"
            : "linear-gradient(180deg, #6bf395, #16a34a)",
          color: "#0a0f1c",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 12,
          letterSpacing: 0.5,
          cursor: "pointer",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(0,0,0,0.45)",
        }}
      >
        {playing ? "■" : "▶"}
      </button>
    </div>
  );
}

function CoverArt({ cover }: { cover: DenTrack["cover"] }) {
  return (
    <div
      style={{
        width: 56, height: 56,
        borderRadius: 12,
        background:
          `linear-gradient(135deg, hsl(${cover.hue} 70% 55%), hsl(${(cover.hue + 60) % 360} 60% 30%))`,
        border: `2px solid ${cover.accent}`,
        boxShadow: `0 0 14px ${cover.accent}55`,
        display: "grid",
        placeItems: "center",
        fontSize: 28,
        flexShrink: 0,
      }}
    >
      {cover.glyph}
    </div>
  );
}
