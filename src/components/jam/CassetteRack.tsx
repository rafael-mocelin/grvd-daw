/**
 * CassetteRack — clickable in-room furniture that opens the saved-jam
 * library. Sits at an iso position on the floor (just like the band
 * characters).
 *
 * Game-y discoverability cues (mobile-friendly — hover doesn't exist
 * on touch, so the rack still telegraphs "I'm tappable" by default):
 *   - Always-on purple aura behind the rack with a slow breathing
 *     pulse. Bigger / brighter when there are saved cassettes.
 *   - Subtle vertical bob (existing).
 *   - Hover (desktop only): cursor pointer, aura ramps up, rack
 *     scales 1.04, drop-shadow intensifies.
 *
 * Asset: /crib/Cassette-Rack.png — square PNG with transparent
 * background.
 */

import { useState } from "react";

interface CassetteRackProps {
  /** Iso position in % of the room overlay (passed in by JamView so
   *  it tracks the same coord space as the band slots). */
  pos:        { x: number; y: number };
  /** Pixel size of the rack. Driven by the measured room size so the
   *  furniture scales with the viewport. */
  size:       number;
  /** Number of saved jams — drives a count chip + a small accent
   *  boost on the aura. */
  jamCount:   number;
  onClick:    () => void;
}

export function CassetteRack({ pos, size, jamCount, onClick }: CassetteRackProps) {
  const [hovered, setHovered] = useState(false);
  const hasCassettes = jamCount > 0;
  // Aura radius — bigger when populated or hovered.
  const auraScale = hovered ? 1.25 : hasCassettes ? 1.10 : 1.05;

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
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      role="button"
      aria-label={`open jam library — ${jamCount} cassette${jamCount === 1 ? "" : "s"}`}
      title={`open jam library · ${jamCount} cassette${jamCount === 1 ? "" : "s"}`}
    >
      {/* ── Breathing aura ──
       *  Soft purple radial glow behind the rack, always pulsing so
       *  the rack reads as interactive on mobile (no hover available).
       *  The blur + radial-gradient is cheap on the GPU. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${auraScale})`,
          pointerEvents: "none",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 60%, rgba(192, 132, 252, 0.55) 0%, rgba(192, 132, 252, 0.18) 35%, rgba(192, 132, 252, 0) 70%)",
          filter: "blur(4px)",
          animation: "rackAuraPulse 2.8s ease-in-out infinite",
          transition: "transform 0.2s ease-out",
          zIndex: -1,
        }}
      />

      {/* ── Rack art ──
       *  Wrapper handles the gentle vertical bob (always-on
       *  animation); the img handles the hover scale + filter so the
       *  two transforms don't fight. */}
      <div
        style={{
          width:  "100%",
          height: "100%",
          animation: "rackBob 3.2s ease-in-out infinite",
        }}
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
            filter: hovered
              ? "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.65)) drop-shadow(0 0 22px rgba(192, 132, 252, 0.95)) brightness(1.08)"
              : hasCassettes
                ? "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.6)) drop-shadow(0 0 14px rgba(192, 132, 252, 0.55))"
                : "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 10px rgba(192, 132, 252, 0.35))",
            transform: hovered ? "scale(1.04)" : "scale(1)",
            transition: "transform 0.18s ease-out, filter 0.18s",
          }}
        />
      </div>

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
        @keyframes rackBob {
          0%, 100% { transform: translate(0, 0)    scale(1);    }
          50%      { transform: translate(0, -3px) scale(1.005); }
        }
        @keyframes rackAuraPulse {
          0%, 100% { opacity: 0.65; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
