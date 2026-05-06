/**
 * MicStand — pure-CSS placeholder for the player slot at the front of
 * the Crib stage. Stands in until a real iso player+mic sprite lands.
 *
 * Shape: round chrome base → thin black pole → pivoted boom → mic head
 * with foam windscreen + a subtle red on-air dot. Kept slightly stylized
 * to read at small sizes against the iso room art.
 *
 * No interactivity — this is a visual anchor. When a real player avatar
 * sprite arrives, swap the contents of this component for an <img>
 * pointing at it. The wrapper's outer dimensions and anchor point
 * (translate -50%, -100%) should stay the same so the JamView layout
 * doesn't have to retune positions.
 */

export function MicStand() {
  return (
    <div
      style={{
        position: "relative",
        width:  56,
        height: 180,
        pointerEvents: "none",
        // Soft drop shadow so the stand reads in the room without a
        // dedicated light source.
        filter: "drop-shadow(0 6px 8px rgba(0, 0, 0, 0.55))",
      }}
      aria-label="player microphone — sing/rap here"
    >
      {/* Floor base — a flat ellipse to fake the iso floor projection. */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left:   "50%",
          marginLeft: -22,
          width: 44,
          height: 14,
          borderRadius: "50%",
          background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
          border: "1.5px solid #0a0f1c",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18)",
        }}
      />

      {/* Pole — thin black tube up the spine. */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left:   "50%",
          marginLeft: -2,
          width:  4,
          height: 130,
          background: "linear-gradient(90deg, #0a0a14 0%, #2a2a32 50%, #0a0a14 100%)",
          borderRadius: 2,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
        }}
      />

      {/* Boom arm — pivots out from the pole at a slight angle. */}
      <div
        style={{
          position: "absolute",
          top: 22,
          left: "50%",
          marginLeft: -1,
          width: 30,
          height: 3,
          background: "linear-gradient(180deg, #2a2a32, #0a0a14)",
          borderRadius: 1.5,
          transformOrigin: "0 50%",
          transform: "rotate(-22deg)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.6)",
        }}
      />

      {/* Mic head — capsule shape at the end of the boom. */}
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 0,
          width: 22,
          height: 28,
          background: "linear-gradient(180deg, #4a4a4a, #1a1a22)",
          border: "2px solid #0a0f1c",
          borderRadius: "12px 12px 50% 50% / 14px 14px 80% 80%",
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), 0 2px 0 rgba(0,0,0,0.4)",
        }}
      >
        {/* foam windscreen — slightly lighter dome */}
        <div
          style={{
            position: "absolute",
            top: 2,
            left:  2,
            right: 2,
            height: 14,
            background:
              "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.28), rgba(255,255,255,0) 70%)",
            borderRadius: "10px 10px 50% 50% / 10px 10px 60% 60%",
          }}
        />
        {/* on-air dot — small red blink */}
        <div
          style={{
            position: "absolute",
            bottom: 5,
            left:   "50%",
            marginLeft: -2,
            width:  4,
            height: 4,
            borderRadius: "50%",
            background: "#E94560",
            boxShadow: "0 0 6px rgba(233, 69, 96, 0.85)",
            animation: "micOnAirPulse 1.6s ease-in-out infinite",
          }}
        />
      </div>

      {/* "MIC" pill below the stand — placeholder; lets the player know
       *  this is where they sing. Will go away when the real player
       *  avatar lands. */}
      <div
        style={{
          position: "absolute",
          bottom: -22,
          left: "50%",
          marginLeft: -28,
          width: 56,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.7)",
          textTransform: "uppercase",
          textShadow: "0 1px 0 rgba(0,0,0,0.7)",
        }}
      >
        you
      </div>

      <style>{`
        @keyframes micOnAirPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 1;    }
        }
      `}</style>
    </div>
  );
}
