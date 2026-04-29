/**
 * CreationToolbar — three persistent icon buttons for the song-creation
 * pipeline: COOK (stack), ARRANGE, MIX.
 *
 * Single horizontal row of icon-only chunky buttons. Mounted on every
 * screen in the creation flow (StackingView, ArrangeView, MixerView)
 * so the player can hop between the three at any time. The audio
 * engine keeps playing across navigation — none of these handlers
 * stop the song.
 *
 *   👨‍🍳   COOK     → stack (the recipe builder)
 *   🎚️   ARRANGE  → arrange (sections / playhead)
 *   🎛️   MIX      → mixer (vol/pan/FX channel strips)
 *
 * The active stage's button gets a brighter ring + glow so the player
 * always knows where they are.
 */

import { useStore } from "../../store/useStore";

type Target = "stack" | "arrange" | "mixer";

interface ButtonSpec {
  target:    Target;
  icon:      string;
  label:     string; // for aria-label only
  bg:        string; // tailwind bg color
  glow:      string; // tailwind shadow-glow-* class
}

const BUTTONS: ButtonSpec[] = [
  { target: "stack",   icon: "👨‍🍳", label: "cook",    bg: "bg-grvd-gold",    glow: "shadow-glow-gold"    },
  { target: "arrange", icon: "🎚️",   label: "arrange", bg: "bg-grvd-cyan",    glow: "shadow-glow-cyan"    },
  { target: "mixer",   icon: "🎛️",   label: "mix",     bg: "bg-grvd-magenta", glow: "shadow-glow-magenta" },
];

export function CreationToolbar() {
  const stage    = useStore((s) => s.stage);
  const setStage = useStore((s) => s.setStage);

  function go(target: Target) {
    if (stage === target) return;
    // Set the editor return stage so back from arrange/mixer drops the
    // player back into the creation pipeline (stack), not done/home.
    useStore.setState({ editorReturnStage: "stack" });
    setStage(target as never);
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      {BUTTONS.map((b) => {
        const active = stage === b.target;
        return (
          <button
            key={b.target}
            onClick={() => go(b.target)}
            aria-label={b.label}
            className={[
              "w-14 h-14 rounded-2xl",
              "flex items-center justify-center",
              "border-[3px] border-[#0a0f1c]",
              "transition-all duration-150 select-none cursor-pointer",
              b.bg,
              active ? b.glow : "",
              active
                ? "shadow-chunky scale-[1.06]"
                : "shadow-chunky-press opacity-85 hover:opacity-100",
              "active:translate-y-[2px] active:scale-[0.96]",
            ].join(" ")}
          >
            <span
              className="text-[28px] leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.55)]"
              style={{ filter: active ? "none" : "saturate(0.85)" }}
            >
              {b.icon}
            </span>
          </button>
        );
      })}
    </div>
  );
}
