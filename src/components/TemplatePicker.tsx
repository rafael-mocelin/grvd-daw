import { useEffect, useMemo, useState } from "react";
import { TEMPLATES } from "../data/templates";
import { useStore } from "../store/useStore";
import { fetchProducerTemplates, type ProducerTemplate } from "../lib/sounds-db";
import type { Template, LayerKind } from "../data/types";

/**
 * Template picker — the first step of the 60-second loop. Each template
 * is a hook-first skeleton: a short 2–4 bar loop modeled on the structure
 * of a modern hit. The player picks one and immediately moves to stacking.
 *
 * Phase 5.B step 10 — producer-published templates show up alongside the
 * static ones, filtered to recipes the current player can fulfil (owns
 * every referenced sound). Locked producer templates are surfaced too
 * with a hint about which sounds they're missing — drives sound claims.
 */
export function TemplatePicker() {
  const { pickTemplate, ownedSoundIds } = useStore();
  const [hover, setHover] = useState<string | null>(null);
  const [producerRows, setProducerRows] = useState<ProducerTemplate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchProducerTemplates(60);
      if (!cancelled) setProducerRows(rows);
    })();
    return () => { cancelled = true; };
  }, []);

  // Convert producer rows → Template shape so pickTemplate works uniformly.
  const producerTemplates = useMemo(() => {
    return (producerRows ?? []).map((p) => producerRowToTemplate(p));
  }, [producerRows]);

  // Partition producer templates into "playable" (own all sounds) vs locked.
  const partitioned = useMemo(() => {
    const playable: { tpl: Template; row: ProducerTemplate }[] = [];
    const locked:   { tpl: Template; row: ProducerTemplate; missingCount: number }[] = [];
    for (let i = 0; i < producerTemplates.length; i++) {
      const tpl = producerTemplates[i];
      const row = producerRows![i];
      if (!ownedSoundIds) {
        // Guest / pre-load — render as playable; server still rejects on save if needed.
        playable.push({ tpl, row });
        continue;
      }
      const missing = row.soundIds.filter((sid) => !ownedSoundIds.has(sid));
      if (missing.length === 0) playable.push({ tpl, row });
      else                       locked.push({ tpl, row, missingCount: missing.length });
    }
    return { playable, locked };
  }, [producerTemplates, producerRows, ownedSoundIds]);

  return (
    <div
      style={{
        padding: "34px 14px 80px",
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      <div className="mb-3">
        <div className="chip bg-raised border border-line text-white/60 text-[10px]">step 1 · pick a vibe</div>
        <h2 className="font-display text-xl font-bold mt-0.5">vibes</h2>
      </div>

      <div className="flex flex-col gap-2">
        {/* Static seed templates */}
        {TEMPLATES.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            highlight={t.id === "tpl-grvd-real"}
            badge={t.id === "tpl-grvd-real" ? "real sounds" : null}
            hovered={hover === t.id}
            onHover={(v) => setHover(v ? t.id : null)}
            onPick={() => pickTemplate(t)}
          />
        ))}

        {/* Producer-published, playable */}
        {partitioned.playable.map(({ tpl, row }) => (
          <TemplateCard
            key={tpl.id}
            template={tpl}
            highlight={false}
            badge={`🎛️ producer · ${row.usageCount} uses`}
            hovered={hover === tpl.id}
            onHover={(v) => setHover(v ? tpl.id : null)}
            onPick={() => pickTemplate(tpl)}
          />
        ))}

        {/* Locked producer templates — visible but un-pickable */}
        {partitioned.locked.length > 0 && (
          <>
            <div className="mt-3 text-[10px] font-mono text-white/40 uppercase tracking-widest">
              🔒 producer drops · need sounds
            </div>
            {partitioned.locked.map(({ tpl, missingCount }) => (
              <div
                key={tpl.id}
                className="card p-3 opacity-60 cursor-not-allowed"
                title={`claim ${missingCount} more sound${missingCount === 1 ? "" : "s"} to unlock this`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display text-base font-bold">{tpl.name}</h3>
                  <div className="font-mono text-[10px] text-white/40">{tpl.bpm} bpm</div>
                </div>
                <p className="text-[10px] text-white/50 font-mono mb-2">{tpl.subtitle}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="chip bg-purple-500/10 border border-purple-400/30 text-purple-300 text-[9px]">
                    🔒 missing {missingCount}
                  </span>
                  {tpl.tags.map((tag) => (
                    <span key={tag} className="chip bg-raised border border-line text-white/60 text-[9px]">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/** Inline reusable card for the picker. */
function TemplateCard({
  template, highlight, badge, hovered, onHover, onPick,
}: {
  template:  Template;
  highlight: boolean;
  badge:     string | null;
  hovered:   boolean;
  onHover:   (v: boolean) => void;
  onPick:    () => void;
}) {
  return (
    <button
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onPick}
      className={`card p-3 text-left transition-all hover:border-accent hover:shadow-glow ${
        hovered ? "ring-1 ring-accent/50" : ""
      } ${highlight ? "border-accent/60" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display text-base font-bold">{template.name}</h3>
        <div className="font-mono text-[10px] text-white/40">{template.bpm} bpm</div>
      </div>
      <p className="text-[10px] text-white/50 font-mono mb-2">{template.subtitle}</p>
      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <span key={tag} className="chip bg-raised border border-line text-white/60 text-[9px]">
            {tag}
          </span>
        ))}
        {badge && (
          <span className="chip bg-accent/10 border border-accent/30 text-accent text-[9px]">{badge}</span>
        )}
      </div>
    </button>
  );
}

/**
 * Shape-shift a server ProducerTemplate into the local Template type the
 * pickTemplate flow expects. Producer templates don't carry a hookLine /
 * verse / suggested map; we synthesize sensible defaults so the karaoke
 * step doesn't crash and the picker's suggestion logic still works
 * (StackingView's `suggestions` already has a fallback path for templates
 * without per-kind suggested ids).
 */
function producerRowToTemplate(p: ProducerTemplate): Template {
  // Build a per-kind suggested map by intersecting recipe positions with sound_ids.
  // Producer templates are recipe[i] paired with soundIds[i] — so for the kind
  // at recipe[i], the suggested sound is soundIds[i].
  const suggested: Partial<Record<LayerKind, string[]>> = {};
  for (let i = 0; i < p.recipe.length; i++) {
    const kind  = p.recipe[i];
    const sound = p.soundIds[i];
    if (!sound) continue;
    (suggested[kind] ??= []).push(sound);
  }
  return {
    id:        p.id,
    name:      p.name,
    subtitle:  p.subtitle ?? "producer drop",
    bpm:       p.bpm,
    bars:      p.bars,
    keyRoot:   p.keyRoot,
    tags:      p.tags,
    recipe:    p.recipe,
    hookLine:  "",       // producer templates don't carry lyrics
    suggested,
  };
}
