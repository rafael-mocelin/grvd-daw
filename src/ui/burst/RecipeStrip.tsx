/**
 * RecipeStrip — sticky horizontal step pills for the song-creation flow.
 *
 * Renders the active template's recipe (DRUMS, HIHAT, 808, SAMPLE, VOCAL)
 * with a final "SAVE" pill appended at the end. Each pill is a button:
 * tapping a recipe step jumps `recipeIndex` and routes to "stack";
 * tapping SAVE routes to "name". The currently-active pill is non-
 * interactive and highlighted with a purple glow.
 *
 * Mounted in both StackingView and NameAndSave so the player can hop
 * directly to the save page or back to any recipe step at any time.
 */

import { useStore } from "../../store/useStore";
import { KIND_LABEL } from "../../data/types";
import { getSound } from "../../data/sounds";
import type { LayerKind } from "../../data/types";

export function RecipeStrip() {
  const stage          = useStore((s) => s.stage);
  const setStage       = useStore((s) => s.setStage);
  const setRecipeIndex = useStore((s) => s.setRecipeIndex);
  const recipeIndex    = useStore((s) => s.recipeIndex);
  const layers         = useStore((s) => s.layers);
  const activeTemplate = useStore((s) => s.activeTemplate);

  if (!activeTemplate) return null;

  const isOnStack = stage === "stack";
  const isOnSave  = stage === "name";

  const existingForKind = (kind: LayerKind) =>
    layers.find((l) => l.kind === kind);

  function jumpToStep(i: number) {
    setRecipeIndex(i);
    if (!isOnStack) setStage("stack");
  }

  function jumpToSave() {
    setStage("name");
  }

  return (
    <div
      className="sticky z-20 -mx-3 px-3 py-2 bg-grvd-base/95 backdrop-blur-sm border-y border-white/6 overflow-x-auto"
      style={{ top: "var(--hud-h, 64px)", scrollbarWidth: "none" }}
    >
      <div className="flex gap-1.5 min-w-max">
        {activeTemplate.recipe.map((kind, i) => {
          const layer  = existingForKind(kind);
          const active = isOnStack && i === recipeIndex;
          const sound  = layer ? getSound(layer.soundId) : null;
          const clickable = !active;
          return (
            <button
              key={kind + i}
              onClick={clickable ? () => jumpToStep(i) : undefined}
              disabled={!clickable}
              className={[
                "inline-flex items-center gap-1.5",
                "px-2.5 py-1 rounded-full",
                "font-mono text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0",
                "transition-all",
                active
                  ? "bg-grvd-purple/25 border-2 border-grvd-purple text-white shadow-glow-purple"
                  : layer
                    ? "bg-white/6 border-2 border-white/15 text-white/75 hover:border-grvd-purple/45"
                    : "bg-transparent border-2 border-white/12 text-white/55 hover:border-grvd-purple/45",
              ].join(" ")}
            >
              <span className="opacity-60">{i + 1}</span>
              <span>{KIND_LABEL[kind]}</span>
              {sound && <span className="text-base leading-none">{sound.glyph}</span>}
              {active && !layer && <span className="text-grvd-purple">←</span>}
            </button>
          );
        })}

        {/* Final SAVE pill — always at the end. Tapping routes to the
         *  NameAndSave page; on that page the pill is highlighted and
         *  non-interactive. */}
        <button
          onClick={isOnSave ? undefined : jumpToSave}
          disabled={isOnSave}
          className={[
            "inline-flex items-center gap-1.5",
            "px-2.5 py-1 rounded-full",
            "font-mono text-[10px] font-bold uppercase tracking-wide whitespace-nowrap shrink-0",
            "transition-all",
            isOnSave
              ? "bg-grvd-gold/25 border-2 border-grvd-gold text-grvd-gold shadow-glow-gold"
              : "bg-transparent border-2 border-grvd-gold/40 text-grvd-gold/85 hover:border-grvd-gold/70",
          ].join(" ")}
        >
          <span className="opacity-60">{activeTemplate.recipe.length + 1}</span>
          <span>SAVE</span>
          <span className="text-base leading-none">💿</span>
        </button>
      </div>
    </div>
  );
}
