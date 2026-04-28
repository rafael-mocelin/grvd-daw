/**
 * Home — UI v1 stage view (slice 2.2).
 *
 * Replaces the old three-equal-CTA list with the manifesto-aligned shape:
 *   - Avatar-forward (rule #2): a big CharacterFace dead center, idle-bobbing,
 *     speech bubble pops next to it on `sayLine`
 *   - Studio-room backdrop (subtle illustration via gradient layers + drifting
 *     particles, no commissioned art yet)
 *   - Four orbital circular icon-buttons around the avatar (booth / studio /
 *     friends / charts) — secondary navigation
 *   - ONE huge hero CTA at the bottom: "🎛️ COOK A TRACK" (rule #6)
 *
 * The HUD's avatar puck still shows in the top-left always — this Home page
 * is the avatar's "main view" where it's centered and expressive.
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { CharacterFace } from "../ui/CharacterFace";
import { ChunkyButton } from "../ui/Chunky";
import type { Mood } from "../data/types";

const TALK_LINES: Record<Mood, string> = {
  asleep: "zzz...",
  sleepy: "ok... what we doing today",
  chill:  "pick a vibe. the booth's open too.",
  happy:  "let's cook 🫶",
  hyped:  "LET'S GOOOO 🔥",
  sad:    "put on something. it helps.",
  lonely: "wanna see what someone's been working on?",
};

interface OrbitalSpec {
  id:        "booth" | "studio" | "friends" | "charts";
  label:     string;
  icon:      string;
  /** Tailwind gradient class for the disc background. */
  bg:        string;
  /** Tailwind shadow class for the glow halo. */
  glow:      string;
  /** Position around the character — top-left/top-right/bot-left/bot-right. */
  position:  "tl" | "tr" | "bl" | "br";
  onClick:   string;  // stage to navigate to (or "logbook" for the logbook toggle)
}

const ORBITAL: OrbitalSpec[] = [
  { id: "booth",   label: "BOOTH",   icon: "🎧", bg: "bg-grvd-cyan",    glow: "shadow-glow-cyan",    position: "tl", onClick: "booth"       },
  { id: "friends", label: "FRIENDS", icon: "🤝", bg: "bg-grvd-magenta", glow: "shadow-glow-magenta", position: "tr", onClick: "friends"     },
  { id: "studio",  label: "STUDIO",  icon: "🎚️", bg: "bg-grvd-purple",  glow: "shadow-glow-purple",  position: "bl", onClick: "studio"      },
  { id: "charts",  label: "CHARTS",  icon: "🏆", bg: "bg-grvd-gold",    glow: "shadow-glow-gold",    position: "br", onClick: "leaderboard" },
];

const ORBITAL_OFFSET: Record<OrbitalSpec["position"], string> = {
  tl: "top-2 left-2",
  tr: "top-2 right-2",
  bl: "bottom-2 left-2",
  br: "bottom-2 right-2",
};

export function Home() {
  const tamagotchi   = useStore((s) => s.tamagotchi);
  const moodOverride = useStore((s) => s.moodOverride);
  const setStage     = useStore((s) => s.setStage);
  const toggleLogbook = useStore((s) => s.toggleLogbook);
  const sayLine      = useStore((s) => s.sayLine);
  const inventory    = useStore((s) => s.inventory);
  const hasTracks    = inventory.length > 0;

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  useEffect(() => {
    sayLine(TALK_LINES[mood], 4000);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  return (
    <div className="pt-3 pb-6 flex flex-col items-stretch gap-5 min-h-[calc(100dvh-120px)]">
      {/* ── Stage area ──
       * Studio-room backdrop with drifting note particles + the centered
       * character + four orbital buttons. Aspect ratio stays roughly 1:1
       * so character + orbits fit at common phone widths (375-414px). */}
      <div className="relative mx-auto w-full max-w-[400px] aspect-square">
        {/* Backdrop layer — soft radial purple/magenta with a faint floor */}
        <div
          className="absolute inset-0 rounded-3xl overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse 90% 80% at 50% 30%, rgba(167,139,250,0.20) 0%, rgba(255,77,156,0.10) 35%, transparent 70%), " +
              "linear-gradient(180deg, rgba(20,16,40,0.50) 0%, rgba(10,8,20,0.85) 100%)",
            border: "1px solid rgba(167,139,250,0.18)",
            boxShadow: "inset 0 -40px 80px -20px rgba(0,0,0,0.5)",
          }}
        >
          {/* Drifting music notes — pure decoration */}
          <FloatingNote left="12%" top="22%" delay={0}    char="♪" />
          <FloatingNote left="80%" top="18%" delay={1.2}  char="♫" />
          <FloatingNote left="22%" top="62%" delay={0.6}  char="♩" />
          <FloatingNote left="76%" top="56%" delay={1.8}  char="♪" />
          <FloatingNote left="48%" top="78%" delay={0.9}  char="♬" />
        </div>

        {/* Orbital buttons */}
        {ORBITAL.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              if (o.onClick === "logbook") toggleLogbook();
              else setStage(o.onClick as never);
            }}
            className={[
              "absolute z-10",
              ORBITAL_OFFSET[o.position],
              "w-[68px] h-[68px] rounded-full",
              "flex flex-col items-center justify-center gap-0.5",
              o.bg, o.glow,
              "shadow-chunky active:shadow-chunky-press active:translate-y-[2px] active:scale-[0.96]",
              "transition-all duration-150",
              "select-none cursor-pointer",
            ].join(" ")}
            aria-label={o.label}
          >
            <span className="text-2xl leading-none">{o.icon}</span>
            <span className="font-display text-[8px] tracking-widest text-grvd-base">
              {o.label}
            </span>
          </button>
        ))}

        {/* Character — center, on top of backdrop, behind nothing */}
        <div className="absolute inset-0 flex items-center justify-center">
          <CharacterFace size={200} />
        </div>
      </div>

      {/* ── Hero CTA ── */}
      <div className="px-2">
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="🎛️"
          onClick={() => setStage("template")}
          className="w-full text-xl tracking-wider"
        >
          {hasTracks ? "COOK A TRACK" : "MAKE YOUR FIRST TRACK"}
        </ChunkyButton>
      </div>

      {/* ── Tertiary row — single row of small icon pills for the lower-priority
       *  surfaces. Logbook lives here since it's a "look back" affordance,
       *  not a primary loop. */}
      <div className="flex items-center justify-center gap-2 px-2">
        <button
          onClick={() => setStage("crib")}
          className="px-3 py-1.5 rounded-full bg-grvd-panel border border-grvd-line text-white/70 text-xs font-sans"
          title="visit the crib"
        >
          🏠 crib
        </button>
        <button
          onClick={toggleLogbook}
          className="px-3 py-1.5 rounded-full bg-grvd-panel border border-grvd-line text-white/70 text-xs font-sans"
          title="your saved songs"
        >
          📓 logbook {hasTracks && <span className="text-grvd-gold">· {inventory.length}</span>}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* FloatingNote — drifting decoration in the backdrop                          */
/* -------------------------------------------------------------------------- */

function FloatingNote({
  left, top, delay, char,
}: { left: string; top: string; delay: number; char: string }) {
  return (
    <span
      aria-hidden
      className="absolute text-grvd-purple/30 text-2xl select-none"
      style={{
        left, top,
        animation: `puck-bob 3s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        textShadow: "0 0 8px rgba(167,139,250,0.4)",
      }}
    >
      {char}
    </span>
  );
}
