import { useEffect, useMemo, useState } from "react";
import { TEMPLATES } from "../data/templates";
import { useStore } from "../store/useStore";
import { fetchProducerTemplates, type ProducerTemplate } from "../lib/sounds-db";
import { ChunkyPill, ChunkyBadge } from "../ui/Chunky";
import type { Template, LayerKind } from "../data/types";

/**
 * TemplatePicker — slice 2.4 redesign.
 *
 * Step 1 of the 60-second loop. Each template is a hook-first recipe.
 * Visual upgrade: per-vibe gradient cards (card-trap / card-drill /
 * card-boom-bap / card-pop-rap from the tailwind tokens), chunky candy
 * depth, BPM badge in a gold pill, glossy top highlight. Three groups:
 * static seeds → playable producer drops → locked producer drops with
 * "claim N more to unlock" hint that drives the player back to Studio.
 */
export function TemplatePicker() {
  const { pickTemplate, ownedSoundIds, setStage } = useStore();
  const [producerRows, setProducerRows] = useState<ProducerTemplate[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchProducerTemplates(60);
      if (!cancelled) setProducerRows(rows);
    })();
    return () => { cancelled = true; };
  }, []);

  const producerTemplates = useMemo(
    () => (producerRows ?? []).map((p) => producerRowToTemplate(p)),
    [producerRows],
  );

  const partitioned = useMemo(() => {
    const playable: { tpl: Template; row: ProducerTemplate }[] = [];
    const locked:   { tpl: Template; row: ProducerTemplate; missingCount: number }[] = [];
    for (let i = 0; i < producerTemplates.length; i++) {
      const tpl = producerTemplates[i];
      const row = producerRows![i];
      if (!ownedSoundIds) {
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
    <div className="pt-3 pb-8 flex flex-col gap-4">
      {/* Header — back pill + step badge + display title */}
      <div className="flex items-center justify-between px-1">
        <ChunkyPill onClick={() => setStage("home")} icon="←" size="sm">
          back
        </ChunkyPill>
        <ChunkyBadge variant="gold" size="sm">
          STEP 1
        </ChunkyBadge>
        <span className="w-12" />
      </div>

      <div className="text-center px-2">
        <h2 className="font-display text-3xl text-white tracking-wide">
          🔥 PICK A VIBE
        </h2>
      </div>

      {/* Static seed templates — each gets a per-tag gradient tint */}
      <div className="flex flex-col gap-3 px-1">
        {TEMPLATES.map((t) => (
          <VibeCard
            key={t.id}
            template={t}
            badge={t.id === "tpl-grvd-real" ? { label: "REAL SOUNDS", variant: "cyan" as const } : null}
            onPick={() => pickTemplate(t)}
          />
        ))}
      </div>

      {/* Playable producer drops */}
      {partitioned.playable.length > 0 && (
        <>
          <SectionDivider icon="🎛️" label="PRODUCER DROPS" />
          <div className="flex flex-col gap-3 px-1">
            {partitioned.playable.map(({ tpl, row }) => (
              <VibeCard
                key={tpl.id}
                template={tpl}
                badge={{ label: `🎛️ ${row.usageCount} uses`, variant: "magenta" as const }}
                onPick={() => pickTemplate(tpl)}
              />
            ))}
          </div>
        </>
      )}

      {/* Locked producer drops */}
      {partitioned.locked.length > 0 && (
        <>
          <SectionDivider icon="🔒" label="NEED SOUNDS" />
          <div className="flex flex-col gap-3 px-1">
            {partitioned.locked.map(({ tpl, missingCount }) => (
              <LockedVibeCard
                key={tpl.id}
                template={tpl}
                missingCount={missingCount}
                onClickToStudio={() => setStage("studio")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* VibeCard — the chunky gradient card                                         */
/* -------------------------------------------------------------------------- */

/** Map a template's tag set to one of the named gradient tokens. */
function gradientForTags(tags: string[]): string {
  if (tags.includes("trap"))     return "bg-card-trap";
  if (tags.includes("drill"))    return "bg-card-drill";
  if (tags.includes("boom-bap")) return "bg-card-boom-bap";
  if (tags.includes("pop-rap"))  return "bg-card-pop-rap";
  return "bg-card-trap";
}

function VibeCard({
  template,
  badge,
  onPick,
}: {
  template: Template;
  badge:    { label: string; variant: "cyan" | "magenta" | "gold" } | null;
  onPick:   () => void;
}) {
  const grad = gradientForTags(template.tags);
  return (
    <button
      onClick={onPick}
      className={[
        grad,
        "relative w-full text-left rounded-2xl px-4 py-3.5",
        "shadow-chunky active:shadow-chunky-press active:translate-y-[2px]",
        "transition-all duration-150 select-none",
      ].join(" ")}
    >
      {/* BPM pill top-right */}
      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-grvd-gold text-grvd-base font-display text-xs shadow-chunky-press">
        {template.bpm} BPM
      </span>

      {/* Title */}
      <h3 className="font-display text-xl text-white tracking-wide pr-20 leading-tight">
        {template.name.toUpperCase()}
      </h3>

      {/* Subtitle */}
      <p className="font-sans text-white/85 text-xs mt-1 pr-16 leading-snug">
        {template.subtitle}
      </p>

      {/* Tags + optional badge */}
      <div className="flex flex-wrap gap-1.5 mt-2.5">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="font-display text-[9px] tracking-widest text-white/90 px-2 py-0.5 rounded-full bg-black/25"
          >
            #{tag}
          </span>
        ))}
        {badge && (
          <ChunkyBadge variant={badge.variant} size="sm">
            {badge.label}
          </ChunkyBadge>
        )}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* LockedVibeCard — desaturated + "missing N" + nudge to studio                */
/* -------------------------------------------------------------------------- */

function LockedVibeCard({
  template,
  missingCount,
  onClickToStudio,
}: {
  template:        Template;
  missingCount:    number;
  onClickToStudio: () => void;
}) {
  return (
    <button
      onClick={onClickToStudio}
      title={`claim ${missingCount} more sound${missingCount === 1 ? "" : "s"} to unlock`}
      className={[
        "relative w-full text-left rounded-2xl px-4 py-3.5",
        "bg-grvd-panel border border-grvd-line",
        "shadow-chunky-press opacity-65",
        "active:translate-y-[1px] transition-all duration-150",
      ].join(" ")}
    >
      <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-grvd-magenta text-white font-display text-[10px] shadow-chunky-press">
        🔒 missing {missingCount}
      </span>

      <h3 className="font-display text-lg text-white/65 tracking-wide pr-24 leading-tight">
        {template.name.toUpperCase()}
      </h3>
      <p className="font-sans text-white/45 text-xs mt-1 pr-16 leading-snug">
        claim {missingCount} more sound{missingCount === 1 ? "" : "s"} to unlock this template
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {template.tags.map((tag) => (
          <span
            key={tag}
            className="font-display text-[9px] tracking-widest text-white/40 px-2 py-0.5 rounded-full bg-black/25"
          >
            #{tag}
          </span>
        ))}
      </div>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* SectionDivider                                                               */
/* -------------------------------------------------------------------------- */

function SectionDivider({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 mt-2">
      <span className="text-base">{icon}</span>
      <span className="font-display text-white text-sm tracking-widest">
        {label}
      </span>
      <span className="flex-1 h-px bg-grvd-line ml-1" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* producerRowToTemplate (unchanged)                                            */
/* -------------------------------------------------------------------------- */

function producerRowToTemplate(p: ProducerTemplate): Template {
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
    hookLine:  "",
    suggested,
  };
}
