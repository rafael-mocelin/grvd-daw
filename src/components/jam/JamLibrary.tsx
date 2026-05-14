/**
 * JamLibrary — modal overlay over the room showing every saved
 * cassette. Each cassette is drawn procedurally (no per-jam image
 * asset needed) — a coloured tape spine + a label with the jam's
 * name + date. Tap a cassette to load it back into the jam stage.
 * The trash icon on hover deletes a cassette.
 */

import { useState } from "react";
import { useJamStore } from "../../store/useJamStore";
import type { JamSong } from "../../data/jamSongs";

interface JamLibraryProps {
  onLoad:  (song: JamSong) => void;
  onClose: () => void;
}

/** Procedural colour for a cassette spine. Derives from the jam id so
 *  the same cassette is always the same colour across sessions. */
function cassetteHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function JamLibrary({ onLoad, onClose }: JamLibraryProps) {
  const songs     = useJamStore((s) => s.songs);
  const deleteJam = useJamStore((s) => s.deleteJam);
  const renameJam = useJamStore((s) => s.renameJam);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  return (
    <>
      {/* Backdrop — translucent, blurred, click outside to close. */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(8, 12, 24, 0.65)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "libFade 0.18s ease-out",
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left:  "50%",
          top:   "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 301,
          width: "min(94vw, 560px)",
          maxHeight: "82vh",
          overflowY: "auto",
          padding: "18px 18px 20px",
          borderRadius: 22,
          background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
          border: "2.5px solid #0a0f1c",
          boxShadow:
            "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 18px 38px rgba(0,0,0,0.6)",
          animation: "libPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 22, marginRight: 8 }}>📼</span>
          <div
            style={{
              fontFamily: "'Lilita One', system-ui",
              fontSize: 22,
              color: "#fff",
              letterSpacing: 0.6,
              textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 14px rgba(192, 132, 252, 0.55)",
            }}
          >
            YOUR CASSETTES
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              width: 30, height: 30, borderRadius: 15,
              border: "2px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer",
              padding: 0, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          tap a tape to load it · long-press the label to rename
        </div>

        {/* Empty state */}
        {songs.length === 0 && (
          <div
            style={{
              padding: "28px 16px",
              borderRadius: 14,
              background: "rgba(0, 0, 0, 0.25)",
              border: "1.5px dashed rgba(255, 255, 255, 0.18)",
              textAlign: "center",
              fontFamily: "'Plus Jakarta Sans', system-ui",
              fontSize: 13,
              color: "rgba(255, 255, 255, 0.55)",
              fontStyle: "italic",
              lineHeight: 1.55,
            }}
          >
            no cassettes yet — hit RECORD up top once you've placed
            some characters
          </div>
        )}

        {/* Cassette grid */}
        {songs.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 10,
            }}
          >
            {songs.map((song) => (
              <CassetteTile
                key={song.id}
                song={song}
                renaming={renaming === song.id}
                renameDraft={renameDraft}
                onPick={() => onLoad(song)}
                onDelete={() => deleteJam(song.id)}
                onStartRename={() => {
                  setRenaming(song.id);
                  setRenameDraft(song.name);
                }}
                onRenameDraftChange={setRenameDraft}
                onCommitRename={() => {
                  renameJam(song.id, renameDraft);
                  setRenaming(null);
                }}
                onCancelRename={() => setRenaming(null)}
              />
            ))}
          </div>
        )}

        <style>{`
          @keyframes libFade { 0% { opacity: 0; } 100% { opacity: 1; } }
          @keyframes libPop {
            0%   { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
            100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          }
        `}</style>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* CassetteTile — one cassette in the grid.                                    */
/* -------------------------------------------------------------------------- */

interface CassetteTileProps {
  song:                JamSong;
  renaming:            boolean;
  renameDraft:         string;
  onPick:              () => void;
  onDelete:            () => void;
  onStartRename:       () => void;
  onRenameDraftChange: (v: string) => void;
  onCommitRename:      () => void;
  onCancelRename:      () => void;
}

function CassetteTile({
  song,
  renaming,
  renameDraft,
  onPick,
  onDelete,
  onStartRename,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
}: CassetteTileProps) {
  const hue = cassetteHue(song.id);
  const dateStr = new Date(song.createdAt).toLocaleString("en-US", {
    month: "short",
    day:   "numeric",
    hour:   "numeric",
    minute: "2-digit",
  });

  return (
    <div
      style={{
        position: "relative",
        padding: 8,
        borderRadius: 12,
        background: "linear-gradient(180deg, rgba(36, 51, 88, 0.6) 0%, rgba(15, 24, 40, 0.6) 100%)",
        border: "2px solid rgba(0,0,0,0.55)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.4)",
        cursor: renaming ? "default" : "pointer",
        transition: "transform 0.12s ease",
      }}
      onClick={renaming ? undefined : onPick}
      onMouseEnter={(e) => {
        if (!renaming) (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {/* Tape body — coloured spine, two reels. Pure CSS. */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 8,
          overflow: "hidden",
          background: `linear-gradient(180deg, hsl(${hue} 70% 55%) 0%, hsl(${(hue + 18) % 360} 60% 32%) 100%)`,
          border: "2px solid #0a0f1c",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.22), inset 0 -2px 0 rgba(0,0,0,0.35)",
        }}
      >
        {/* Label band */}
        <div
          style={{
            position: "absolute",
            top: "16%", left: "10%", right: "10%",
            height: "42%",
            background: "linear-gradient(180deg, #fff 0%, #e2e4f0 100%)",
            border: "1.5px solid #0a0f1c",
            borderRadius: 3,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 6px",
            boxShadow: "inset 0 1px 0 rgba(0,0,0,0.04)",
          }}
        >
          {renaming ? (
            <input
              autoFocus
              value={renameDraft}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onRenameDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommitRename(); }
                if (e.key === "Escape") { e.preventDefault(); onCancelRename(); }
              }}
              onBlur={onCommitRename}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 10,
                color: "#0a0f1c",
                letterSpacing: 0.3,
                textAlign: "center",
              }}
            />
          ) : (
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 10,
                color: "#0a0f1c",
                letterSpacing: 0.3,
                textAlign: "center",
                lineHeight: 1.05,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                width: "100%",
              }}
            >
              {song.name}
            </div>
          )}
        </div>
        {/* Two reels (left + right) */}
        <CassetteReel side="left" />
        <CassetteReel side="right" />
      </div>

      {/* Footer — date + BPM + delete + rename. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 6,
          gap: 4,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {dateStr} · {song.bpm}BPM
        </div>
        <button
          aria-label="rename"
          onClick={(e) => { e.stopPropagation(); onStartRename(); }}
          style={miniIconBtn}
        >
          ✎
        </button>
        <button
          aria-label="delete"
          onClick={(e) => {
            e.stopPropagation();
            // Light confirmation — single tap deletes; double-tap
            // protection would be nicer but keeps the surface simple.
            if (window.confirm(`Toss out "${song.name}"?`)) {
              onDelete();
            }
          }}
          style={{
            ...miniIconBtn,
            color: "#ff7a8e",
            borderColor: "rgba(233, 69, 96, 0.5)",
            background: "rgba(233, 69, 96, 0.12)",
          }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

const miniIconBtn: React.CSSProperties = {
  width:  20,
  height: 20,
  borderRadius: 10,
  border: "1.5px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(255,255,255,0.7)",
  fontSize: 10,
  cursor: "pointer",
  padding: 0,
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
};

function CassetteReel({ side }: { side: "left" | "right" }) {
  const offset = side === "left" ? "24%" : "76%";
  return (
    <div
      style={{
        position: "absolute",
        top: "70%",
        left: offset,
        transform: "translate(-50%, -50%)",
        width: "14%",
        aspectRatio: "1 / 1",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 60%, #0a0f1c 100%)",
        border: "1.5px solid rgba(0,0,0,0.85)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {/* tiny tooth marks around the reel rim */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 1.5,
            height: "30%",
            background: "rgba(255,255,255,0.18)",
            transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-100%)`,
            transformOrigin: "50% 100%",
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}
