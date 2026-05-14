/**
 * CassetteRack — clickable in-room furniture that opens the saved-jam
 * library. Sits at an iso position on the floor (just like the band
 * characters); pulses gently when there's at least one cassette
 * stashed, dim and faded when the rack is empty.
 *
 * Asset: /crib/cassette-rack.png — square PNG with transparent
 * background, drop in by the user.
 */

interface CassetteRackProps {
  /** Iso position in % of the room overlay (passed in by JamView so
   *  it tracks the same coord space as the band slots). */
  pos:        { x: number; y: number };
  /** Pixel size of the rack. Driven by the measured room size so the
   *  furniture scales with the viewport. */
  size:       number;
  /** Number of saved jams — drives the pulse glow + a chip showing
   *  the count. */
  jamCount:   number;
  onClick:    () => void;
}

export function CassetteRack({ pos, size, jamCount, onClick }: CassetteRackProps) {
  const hasCassettes = jamCount > 0;
  return (
    <div
      style={{
        position: "absolute",
        left: `${pos.x}%`,
        top:  `${pos.y}%`,
        // Anchor the rack's feet at (x, y) — same trick the band
        // sprites use so the asset sits ON the floor.
        transform: "translate(-50%, -100%)",
        width:  size,
        height: size,
        zIndex: 3,
        cursor: "pointer",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
      onClick={onClick}
      role="button"
      aria-label={`open jam library — ${jamCount} cassette${jamCount === 1 ? "" : "s"}`}
      title={`open jam library · ${jamCount} cassette${jamCount === 1 ? "" : "s"}`}
    >
      <img
        src="/crib/Cassette-Rack.png"
        alt=""
        draggable={false}
        style={{
          width:  "100%",
          height: "100%",
          objectFit: "contain",
          pointerEvents: "none",
          filter: hasCassettes
            ? "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 16px rgba(192, 132, 252, 0.55))"
            : "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))",
          opacity: hasCassettes ? 1 : 0.92,
          animation: hasCassettes
            ? "rackBreathe 3.2s ease-in-out infinite"
            : undefined,
        }}
      />

      {/* Count chip — bottom-right of the rack, only when there's
       *  at least one cassette to brag about. */}
      {hasCassettes && (
        <div
          style={{
            position: "absolute",
            right: "-4%",
            bottom: "8%",
            minWidth: 22,
            height:   22,
            padding:  "0 7px",
            borderRadius: 11,
            background: "linear-gradient(180deg, #c084fc, #7e22ce)",
            border: "2px solid #0a0f1c",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 11,
            color: "#fff",
            letterSpacing: 0.4,
            display: "grid",
            placeItems: "center",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.4), 0 2px 0 rgba(0,0,0,0.45), 0 0 12px rgba(192, 132, 252, 0.7)",
            pointerEvents: "none",
          }}
        >
          {jamCount}
        </div>
      )}

      <style>{`
        @keyframes rackBreathe {
          0%, 100% { transform: translate(0, 0); }
          50%      { transform: translate(0, -2px); }
        }
      `}</style>
    </div>
  );
}
