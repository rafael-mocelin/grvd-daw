import { useState } from "react";
import { TEMPLATES } from "../data/templates";
import { useStore } from "../store/useStore";
import { TamagotchiFace } from "./TamagotchiFace";

/**
 * Template picker — the first step of the 60-second loop. Each template
 * is a hook-first skeleton: a short 2–4 bar loop modeled on the structure
 * of a modern hit. The player picks one and immediately moves to stacking.
 */
export function TemplatePicker() {
  const { tamagotchi, pickTemplate, setStage } = useStore();
  const [hover, setHover] = useState<string | null>(null);

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="chip bg-raised border border-line text-white/60 text-[10px]">step 1 · pick a vibe</div>
          <h2 className="font-display text-xl font-bold mt-0.5">vibes</h2>
        </div>
        <TamagotchiFace mood={tamagotchi.mood} size={44} compact />
      </div>

      <div className="flex flex-col gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onMouseEnter={() => setHover(t.id)}
            onMouseLeave={() => setHover(null)}
            onClick={() => pickTemplate(t)}
            className={`card p-3 text-left transition-all hover:border-accent hover:shadow-glow ${
              hover === t.id ? "ring-1 ring-accent/50" : ""
            } ${t.id === "tpl-grvd-real" ? "border-accent/60" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-display text-base font-bold">{t.name}</h3>
              <div className="font-mono text-[10px] text-white/40">{t.bpm} bpm</div>
            </div>
            <p className="text-[10px] text-white/50 font-mono mb-2">{t.subtitle}</p>
            <div className="flex flex-wrap gap-1">
              {t.tags.map((tag) => (
                <span key={tag} className="chip bg-raised border border-line text-white/60 text-[9px]">
                  {tag}
                </span>
              ))}
              {t.id === "tpl-grvd-real" && (
                <span className="chip bg-accent/10 border border-accent/30 text-accent text-[9px]">real sounds</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
