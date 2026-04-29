/**
 * StudioScene — backdrop illustration for the Home stage.
 *
 * Best HTML/CSS approximation of the studio-room scene from the hero
 * mockup (warm hanging lamp spot, vinyl records, MPC + keyboard
 * silhouettes, speaker cabinets, drifting music notes). Designed to
 * sit BEHIND the centered mascot on Home — the mascot uses
 * absolute-center positioning, this fills the same wrapper.
 *
 * Designed to be replaced later with a real commissioned illustration.
 * Until then this gives the home stage actual scene depth instead of
 * a flat gradient.
 */

interface StudioSceneProps {
  className?: string;
}

export function StudioScene({ className = "" }: StudioSceneProps) {
  return (
    <div
      aria-hidden
      className={[
        "absolute inset-0 rounded-3xl overflow-hidden",
        "border-2 border-grvd-purple/40",
        "shadow-[0_0_28px_rgba(167,139,250,0.18)_inset]",
        className,
      ].join(" ")}
      style={{
        background:
          // Warm spotlight from a hanging lamp at top-center
          "radial-gradient(ellipse 55% 35% at 50% 18%, rgba(255,180,120,0.28) 0%, rgba(255,140,90,0.12) 25%, transparent 55%), " +
          // Pink/purple ambience filling the room
          "radial-gradient(ellipse 100% 90% at 50% 60%, rgba(255,77,156,0.18) 0%, rgba(167,139,250,0.10) 40%, transparent 80%), " +
          // Floor gradient — slightly lighter at the bottom
          "linear-gradient(180deg, rgba(20,12,40,0.55) 0%, rgba(40,18,60,0.6) 60%, rgba(50,15,55,0.5) 100%)",
      }}
    >
      {/* Hanging lamp — black wire from top + warm bulb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-[18%] bg-black/60" />
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "16%",
          width: 28, height: 22,
          borderRadius: "0 0 14px 14px",
          background: "linear-gradient(180deg, #2a1a3a, #0f0824)",
          border: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
        }}
      />
      {/* Bulb glow */}
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: "26%",
          width: 8, height: 8,
          background: "radial-gradient(circle, #ffe39b, #fbbf24)",
          boxShadow: "0 0 18px 6px rgba(251,191,36,0.55), 0 0 40px 16px rgba(251,146,60,0.3)",
        }}
      />

      {/* Vinyl records — left side, layered behind the gear */}
      <Vinyl style={{ left: "8%",  top: "30%", scale: 0.85 }} />
      <Vinyl style={{ left: "15%", top: "65%", scale: 1.05 }} />
      <Vinyl style={{ right: "12%", top: "70%", scale: 0.95 }} />

      {/* Speaker cabinets — left + right back of stage */}
      <Speaker style={{ left: "5%",  bottom: "8%" }} />
      <Speaker style={{ right: "5%", bottom: "8%" }} />

      {/* MPC drum machine — center-left on the desk */}
      <MPC style={{ left: "22%", top: "44%" }} />

      {/* Keyboard — center-right on the desk */}
      <Keyboard style={{ right: "16%", top: "46%" }} />

      {/* Floating music notes — drift loop */}
      <FloatingNote left="18%" top="22%" delay={0}    char="♪" />
      <FloatingNote left="78%" top="20%" delay={1.3}  char="♫" />
      <FloatingNote left="32%" top="80%" delay={0.6}  char="♩" />
      <FloatingNote left="68%" top="82%" delay={1.9}  char="♪" />
      <FloatingNote left="50%" top="38%" delay={1.0}  char="♬" />

      {/* Bottom shadow gradient — anchors the scene */}
      <div
        className="absolute inset-x-0 bottom-0 h-12 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45), transparent)" }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene pieces — small, no logic, mostly decorative                           */
/* -------------------------------------------------------------------------- */

function Vinyl({ style }: { style: React.CSSProperties & { scale?: number } }) {
  const { scale = 1, ...rest } = style;
  return (
    <div
      className="absolute rounded-full"
      style={{
        width:  44 * scale, height: 44 * scale,
        background:
          "radial-gradient(circle at center, #fbbf24 0% 18%, #1a0f24 18% 22%, #2a1a3a 22% 60%, #1a0f24 60% 64%, #2a1a3a 64% 100%)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        ...rest,
      }}
    />
  );
}

function Speaker({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute"
      style={{
        width: 38, height: 56,
        background: "linear-gradient(180deg, #2a1a3a, #14081e)",
        border: "1px solid rgba(0,0,0,0.6)",
        borderRadius: 6,
        boxShadow: "0 6px 14px rgba(0,0,0,0.5)",
        ...style,
      }}
    >
      {/* Tweeter */}
      <span
        className="block mx-auto mt-2 rounded-full"
        style={{
          width: 14, height: 14,
          background: "radial-gradient(circle, #1a0f24, #050308)",
          border: "1px solid rgba(0,0,0,0.7)",
        }}
      />
      {/* Woofer */}
      <span
        className="block mx-auto mt-1.5 rounded-full"
        style={{
          width: 26, height: 26,
          background: "radial-gradient(circle, #1a0f24, #050308)",
          border: "1px solid rgba(0,0,0,0.7)",
        }}
      />
    </div>
  );
}

function MPC({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute"
      style={{
        width: 56, height: 36,
        background: "linear-gradient(180deg, #2a1a3a, #1a0f24)",
        border: "1px solid rgba(0,0,0,0.6)",
        borderRadius: 4,
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        padding: 3,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridTemplateRows:    "repeat(2, 1fr)",
        gap: 2,
        ...style,
      }}
    >
      {[
        "#ff4d9c", "#fbbf24", "#22d3ee", "#a78bfa",
        "#4ade80", "#fb923c", "#a78bfa", "#22d3ee",
      ].map((c, i) => (
        <span
          key={i}
          style={{
            background: c,
            borderRadius: 1.5,
            boxShadow: `0 0 4px ${c}aa`,
          }}
        />
      ))}
    </div>
  );
}

function Keyboard({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute flex"
      style={{
        width: 70, height: 24,
        background: "#1a0f24",
        border: "1px solid rgba(0,0,0,0.6)",
        borderRadius: 3,
        boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
        padding: 2,
        gap: 1,
        ...style,
      }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <span
          key={i}
          className="flex-1 rounded-[1px]"
          style={{ background: i % 7 === 1 || i % 7 === 3 || i % 7 === 4 || i % 7 === 6 ? "#1a0f24" : "#fff" }}
        />
      ))}
    </div>
  );
}

function FloatingNote({
  left, top, delay, char,
}: { left: string; top: string; delay: number; char: string }) {
  return (
    <span
      aria-hidden
      className="absolute text-grvd-magenta/40 text-2xl select-none"
      style={{
        left, top,
        animation: "puck-bob 3.5s ease-in-out infinite",
        animationDelay: `${delay}s`,
        textShadow: "0 0 10px rgba(255,77,156,0.5)",
      }}
    >
      {char}
    </span>
  );
}
