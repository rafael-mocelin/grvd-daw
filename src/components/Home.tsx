/**
 * Home — UI v1 hero stage view.
 *
 * Faithful 9:16-mobile adaptation of the hero mockup:
 *
 *   ┌────────────────────────────┐
 *   │ [HUD: lvl, energy, xp, $] │   ← lives in PageShell, not here
 *   │                            │
 *   │ ┌────────────────────────┐ │
 *   │ │   studio scene         │ │   ← StudioScene backdrop
 *   │ │  🎧                🤝  │ │
 *   │ │  BOOTH         FRIENDS │ │
 *   │ │       MASCOT 🎧       │ │
 *   │ │       "let's cook 🤝" │ │
 *   │ │  🎚️                🏆  │ │
 *   │ │  STUDIO         CHARTS │ │
 *   │ └────────────────────────┘ │
 *   │                            │
 *   │   ┌──────────────────┐     │
 *   │   │  🎛️ COOK A TRACK │     │   ← hero CTA, full-width
 *   │   └──────────────────┘     │
 *   │                            │
 *   │       [crib]  [logbook]    │   ← tertiary nav
 *   └────────────────────────────┘
 *
 * Mobile-first: tuned for 375-414px viewport widths. Stage is taller
 * than wide (9:16-ish) so the mascot has presence and the orbitals
 * have room to breathe.
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { CharacterFace } from "../ui/CharacterFace";
import { StudioScene }   from "../ui/StudioScene";
import { ChunkyButton }  from "../ui/Chunky";
import type { Mood } from "../data/types";

const TALK_LINES: Record<Mood, string> = {
  asleep: "zzz...",
  sleepy: "ok... what we doing today",
  chill:  "pick a vibe. the booth's open too.",
  happy:  "let's cook 🤝",
  hyped:  "LET'S GOOOO 🔥",
  sad:    "put on something. it helps.",
  lonely: "wanna see what someone's been working on?",
};

interface OrbitalSpec {
  id:        "booth" | "studio" | "friends" | "charts";
  label:     string;
  icon:      string;
  /** Tailwind background class for the disc. */
  bg:        string;
  /** Tailwind glow class for the halo. */
  glow:      string;
  /** Inner-text color override (cyan/gold need dark text, magenta/purple
   *  need white text). */
  textColor: string;
  /** Position around the character — top-left/top-right/bot-left/bot-right. */
  position:  "tl" | "tr" | "bl" | "br";
  /** Stage to navigate to. */
  target:    string;
}

const ORBITAL: OrbitalSpec[] = [
  { id: "booth",   label: "BOOTH",   icon: "🎧", bg: "bg-grvd-cyan",    glow: "shadow-glow-cyan",    textColor: "text-grvd-base", position: "tl", target: "booth"       },
  { id: "friends", label: "FRIENDS", icon: "🤝", bg: "bg-grvd-magenta", glow: "shadow-glow-magenta", textColor: "text-white",     position: "tr", target: "friends"     },
  { id: "studio",  label: "STUDIO",  icon: "🎚️", bg: "bg-grvd-purple",  glow: "shadow-glow-purple",  textColor: "text-white",     position: "bl", target: "studio"      },
  { id: "charts",  label: "CHARTS",  icon: "🏆", bg: "bg-grvd-gold",    glow: "shadow-glow-gold",    textColor: "text-grvd-base", position: "br", target: "leaderboard" },
];

const ORBITAL_OFFSET: Record<OrbitalSpec["position"], string> = {
  tl: "top-3 left-3",
  tr: "top-3 right-3",
  bl: "bottom-3 left-3",
  br: "bottom-3 right-3",
};

export function Home() {
  const tamagotchi    = useStore((s) => s.tamagotchi);
  const moodOverride  = useStore((s) => s.moodOverride);
  const setStage      = useStore((s) => s.setStage);
  const toggleLogbook = useStore((s) => s.toggleLogbook);
  const sayLine       = useStore((s) => s.sayLine);
  const dawTalk       = useStore((s) => s.dawTalk);
  const inventory     = useStore((s) => s.inventory);
  const hasTracks     = inventory.length > 0;

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  useEffect(() => {
    sayLine(TALK_LINES[mood], 6000);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  return (
    <div className="pt-3 pb-6 flex flex-col gap-4 min-h-[calc(100dvh-120px)]">
      {/* ── Stage area ──
       * 9:16-ish aspect on phones; the mascot + 4 orbitals + a studio
       * backdrop all live inside this rounded panel. */}
      <div className="relative mx-auto w-full max-w-[400px] aspect-[5/6]">
        {/* Backdrop scene */}
        <StudioScene />

        {/* Orbital nav buttons — labelled, in the four corners. */}
        {ORBITAL.map((o) => (
          <button
            key={o.id}
            onClick={() => setStage(o.target as never)}
            className={[
              "absolute z-10",
              ORBITAL_OFFSET[o.position],
              "flex flex-col items-center gap-1.5",
              "select-none",
            ].join(" ")}
            aria-label={o.label}
          >
            <span
              className={[
                "w-[64px] h-[64px] rounded-full",
                "flex items-center justify-center",
                o.bg, o.glow,
                "shadow-chunky",
                "active:shadow-chunky-press active:translate-y-[2px] active:scale-[0.96]",
                "transition-all duration-150",
                "border-2 border-white/30",
              ].join(" ")}
            >
              <span className="text-3xl leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {o.icon}
              </span>
            </span>
            <span
              className={[
                "font-display text-[11px] tracking-[0.2em] leading-none",
                "text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.8)]",
              ].join(" ")}
            >
              {o.label}
            </span>
          </button>
        ))}

        {/* Mascot — center stage, with headphones. */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <CharacterFace size={170} headphones />
        </div>

        {/* Speech bubble — anchored next to the mascot's bottom-right. */}
        {dawTalk && (
          <div
            className="absolute z-20 pointer-events-none"
            style={{ left: "58%", top: "60%" }}
          >
            <div
              className={[
                "max-w-[150px] px-3 py-2",
                "rounded-2xl rounded-bl-sm",
                "bg-white text-grvd-base",
                "font-sans font-bold text-[12px] leading-tight",
                "shadow-chunky",
                "animate-bubble-in",
              ].join(" ")}
            >
              {dawTalk}
            </div>
          </div>
        )}
      </div>

      {/* ── Hero CTA ── */}
      <div className="px-2">
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="🎛️"
          onClick={() => setStage("template")}
          className="w-full text-xl tracking-[0.08em] py-4"
        >
          {hasTracks ? "COOK A TRACK" : "MAKE YOUR FIRST TRACK"}
        </ChunkyButton>
      </div>

      {/* ── Tertiary row — small icon pills for the lower-priority surfaces. */}
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
