/**
 * Studio — slice 2.5 redesign.
 *
 * Two tabs (MINE / DISCOVER) with the new GRVD visual language.
 *   • MINE     — every sound you own, kind-grouped chunky tile grid
 *                with a hero "publish a sound" pill on the inventory
 *                header card.
 *   • DISCOVER — producer-published sounds, per-tile gradient cards
 *                with chunky claim pills + 🔥 trending halo.
 *
 * Same data flow as before; visuals fully repainted on the chunky
 * candy + GRVD palette token system.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "../store/useStore";
import {
  fetchDiscoverSounds,
  fetchMyInventory,
  groupByKind,
  KIND_ICON,
  type DiscoverSound,
  type InventorySound,
} from "../lib/sounds-db";
import type { LayerKind } from "../data/types";
import { KIND_LABEL } from "../data/types";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";
import { SoundPublisher } from "./SoundPublisher";

type TabId = "mine" | "discover";

export function Studio() {
  const setStage = useStore((s) => s.setStage);
  const [tab, setTab] = useState<TabId>("mine");

  return (
    <div className="pt-3 pb-8 flex flex-col gap-4">
      {/* Header — back pill + display title */}
      <div className="flex items-center justify-between px-1">
        <ChunkyPill onClick={() => setStage("home")} icon="←" size="sm">
          back
        </ChunkyPill>
        <span className="font-display text-grvd-purple text-[11px] tracking-widest uppercase">
          🎚️ STUDIO
        </span>
        <span className="w-12" />
      </div>

      {/* Tab bar */}
      <TabBar active={tab} onChange={setTab} />

      {/* Tab content */}
      {tab === "mine"     && <MineTab />}
      {tab === "discover" && <DiscoverTab />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* TabBar                                                                      */
/* -------------------------------------------------------------------------- */

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "mine",     label: "MINE",     icon: "🎚️" },
  { id: "discover", label: "DISCOVER", icon: "🌀" },
];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="flex gap-2 px-1">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={[
              "flex-1 px-4 py-2.5 rounded-2xl",
              "font-display tracking-widest text-sm",
              "shadow-chunky-press transition-all duration-150",
              "active:translate-y-[1px]",
              isActive
                ? "bg-btn-hero text-white shadow-glow-purple"
                : "bg-grvd-panel text-white/60 border border-grvd-line",
            ].join(" ")}
          >
            <span className="mr-1.5 text-base">{t.icon}</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MINE tab                                                                    */
/* -------------------------------------------------------------------------- */

const KIND_ORDER: LayerKind[] = [
  "drums", "kick", "snare", "hat", "808", "sample", "melody", "vocal",
];

function MineTab() {
  const userId = useStore((s) => s.userId);
  const [items, setItems] = useState<InventorySound[] | null>(null);
  const [publisherOpen, setPublisherOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    const rows = await fetchMyInventory(userId);
    setItems(rows);
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) { if (!cancelled) setItems([]); return; }
      const rows = await fetchMyInventory(userId);
      if (!cancelled) setItems(rows);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const grouped = useMemo(
    () => (items ? groupByKind(items) : null),
    [items],
  );

  if (items === null) return <EmptyState>loading your sounds…</EmptyState>;

  if (items.length === 0) {
    return (
      <EmptyState>
        no sounds yet — sign in and your starter pack will appear here.
      </EmptyState>
    );
  }

  const total         = items.length;
  const producerCount = items.filter((s) => s.producerId !== null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Inventory header card — chunky gradient panel with hero CTA */}
      <div className="rounded-2xl bg-card-trap shadow-chunky px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-[10px] tracking-widest uppercase text-white/75">
            INVENTORY
          </div>
          <div className="font-display text-2xl text-white leading-tight tabular-nums">
            {total} sounds
          </div>
          {producerCount > 0 && (
            <div className="font-sans text-white/70 text-[11px] mt-0.5">
              🎛️ {producerCount} producer drop{producerCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
        <ChunkyButton
          variant="magenta"
          size="md"
          icon="🎛️"
          onClick={() => setPublisherOpen(true)}
          className="shrink-0 whitespace-nowrap"
        >
          PUBLISH · 15⚡
        </ChunkyButton>
      </div>

      {/* One section per kind */}
      {KIND_ORDER.map((kind) => {
        const list = grouped?.[kind] ?? [];
        if (list.length === 0) return null;
        return <KindSection key={kind} kind={kind} sounds={list} />;
      })}

      {publisherOpen && (
        <SoundPublisher
          onClose={() => {
            setPublisherOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function KindSection({ kind, sounds }: { kind: LayerKind; sounds: InventorySound[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 px-1">
        <span className="text-base">{KIND_ICON[kind]}</span>
        <span className="font-display text-white text-sm tracking-widest">
          {KIND_LABEL[kind].toUpperCase()}
        </span>
        <span className="font-sans text-white/40 text-xs tabular-nums">
          · {sounds.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 px-1">
        {sounds.map((s) => (
          <SoundTile key={s.id} sound={s} />
        ))}
      </div>
    </div>
  );
}

function SoundTile({ sound }: { sound: InventorySound }) {
  const isProducer = sound.producerId !== null;
  return (
    <button
      title={`${sound.displayName}${sound.variant ? ` · ${sound.variant}` : ""}${sound.bpm ? ` · ${sound.bpm} BPM` : ""}${sound.keyRoot ? ` · ${sound.keyRoot}` : ""}`}
      className={[
        "relative aspect-square rounded-2xl",
        "flex flex-col items-center justify-center gap-1.5",
        "shadow-chunky active:shadow-chunky-press active:translate-y-[1px] active:scale-[0.96]",
        "transition-all duration-100 select-none",
        isProducer
          ? "bg-gradient-to-br from-grvd-purple/40 to-grvd-magenta/30 border border-grvd-purple/50 shadow-glow-purple"
          : "bg-grvd-panel border border-grvd-line",
      ].join(" ")}
    >
      <span className="text-[28px] leading-none drop-shadow-md select-none">
        {sound.glyph}
      </span>
      <span className="font-display text-[10px] text-white/85 tracking-wider uppercase truncate max-w-[88%]">
        {sound.displayName}
      </span>
      {isProducer && (
        <span
          className="absolute top-1 right-1 text-[10px] px-1.5 py-px rounded-full bg-grvd-magenta text-white shadow-chunky-press"
          title="producer-published"
        >
          🎛️
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* DISCOVER tab                                                                */
/* -------------------------------------------------------------------------- */

const TRENDING_MIN_CLAIMS_PER_WEEK = 5;

function DiscoverTab() {
  const userId          = useStore((s) => s.userId);
  const claimSound      = useStore((s) => s.claimSound);
  const claimingSoundId = useStore((s) => s.claimingSoundId);
  const [items, setItems] = useState<DiscoverSound[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await fetchDiscoverSounds({ userId });
      if (!cancelled) setItems(rows);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleClaim = useCallback(async (soundId: string) => {
    const result = await claimSound(soundId);
    if (!result || !result.success) return;
    setItems((prev) => prev?.map((s) =>
      s.id === soundId
        ? {
            ...s,
            ownedByMe:      true,
            claimCount:     result.claimsTotal,
            claimsThisWeek: result.claimsThisWeek,
          }
        : s,
    ) ?? prev);
  }, [claimSound]);

  if (items === null) return <EmptyState>loading…</EmptyState>;

  if (items.length === 0) {
    return (
      <EmptyState>
        no producer drops yet — be the first to publish.
        <div className="mt-1.5 font-sans text-[10px] opacity-70">
          head to MINE → publish a sound
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1">
        <span className="text-base">🌀</span>
        <span className="font-display text-white text-sm tracking-widest">
          FRESH DROPS
        </span>
        <span className="font-sans text-white/40 text-xs tabular-nums">
          · {items.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 px-1">
        {items.map((s) => (
          <DiscoverTile
            key={s.id}
            sound={s}
            claiming={claimingSoundId === s.id}
            onClaim={() => handleClaim(s.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface DiscoverTileProps {
  sound:    DiscoverSound;
  claiming: boolean;
  onClaim:  () => void;
}

/** Map a sound's kind to one of the per-vibe gradient tokens for tile bgs. */
function gradientForKind(kind: LayerKind): string {
  switch (kind) {
    case "kick":   return "bg-card-trap";
    case "808":    return "bg-card-pop-rap";
    case "snare":  return "bg-card-drill";
    case "hat":    return "bg-card-boom-bap";
    case "sample": return "bg-card-pop-rap";
    case "melody": return "bg-card-trap";
    case "vocal":  return "bg-card-drill";
    case "drums":  return "bg-card-trap";
    default:       return "bg-card-trap";
  }
}

function DiscoverTile({ sound, claiming, onClaim }: DiscoverTileProps) {
  const isTrending = sound.claimsThisWeek >= TRENDING_MIN_CLAIMS_PER_WEEK;
  const canClaim   = !sound.ownedByMe && !claiming;
  const grad       = gradientForKind(sound.kind);

  return (
    <div
      title={`${sound.displayName}${sound.variant ? ` · ${sound.variant}` : ""}${sound.bpm ? ` · ${sound.bpm} BPM` : ""}`}
      className={[
        "relative rounded-2xl px-3 py-3.5",
        "flex flex-col items-center gap-2",
        sound.ownedByMe ? "opacity-70 bg-grvd-panel border border-grvd-lime/35" : grad,
        "shadow-chunky",
        isTrending && !sound.ownedByMe ? "shadow-glow-orange ring-2 ring-grvd-orange/55" : "",
      ].join(" ")}
    >
      {/* Kind icon top-left */}
      <span className="absolute top-2 left-2 text-sm opacity-80 select-none">
        {KIND_ICON[sound.kind]}
      </span>

      {/* Trending fire top-right */}
      {isTrending && !sound.ownedByMe && (
        <span
          className="absolute top-2 right-2 text-base"
          style={{ filter: "drop-shadow(0 0 6px rgba(251,146,60,0.7))" }}
        >
          🔥
        </span>
      )}

      {/* Big glyph */}
      <span className="text-[34px] leading-none drop-shadow-md select-none mt-2">
        {sound.glyph}
      </span>

      {/* Display name */}
      <span className="font-display text-white text-sm tracking-wider truncate max-w-full text-center">
        {sound.displayName.toUpperCase()}
      </span>

      {/* Producer attribution */}
      <div className="flex items-center gap-1 font-sans text-white/85 text-[10px]">
        <span>{sound.producerAvatar ?? "🎧"}</span>
        <span className="truncate max-w-[80px]">{sound.producerName ?? "anon"}</span>
      </div>

      {/* Claim count line */}
      <div className="font-sans text-white/75 text-[10px] tabular-nums flex items-center gap-1">
        <span>💿</span>
        <span>{sound.claimCount} claim{sound.claimCount === 1 ? "" : "s"}</span>
      </div>

      {/* Action */}
      {sound.ownedByMe ? (
        <ChunkyBadge variant="claim" size="sm" icon="✓">
          OWNED
        </ChunkyBadge>
      ) : (
        <button
          onClick={canClaim ? onClaim : undefined}
          disabled={!canClaim}
          className={[
            "px-4 py-1.5 rounded-full",
            "font-display tracking-wider text-xs",
            canClaim
              ? "bg-btn-claim text-grvd-base shadow-chunky shadow-glow-lime active:translate-y-[1px] active:shadow-chunky-press"
              : "bg-grvd-panel text-white/55 border border-grvd-line",
          ].join(" ")}
        >
          {claiming ? "CLAIMING…" : "CLAIM 💿"}
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                  */
/* -------------------------------------------------------------------------- */

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-6 px-6 py-10 max-w-[360px] rounded-2xl bg-grvd-panel/60 border border-dashed border-grvd-line text-center">
      <div className="font-sans text-grvd-purple/75 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  );
}
