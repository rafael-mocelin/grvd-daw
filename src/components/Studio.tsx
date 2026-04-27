/**
 * Studio — Phase 5.B sound inventory + producer publishing + discover.
 *
 * Two tabs, mirroring the MINE/SEARCH pattern from Friends:
 *   • MINE     — every sound you own, grouped by kind, with a publish
 *                action button at the top.
 *   • DISCOVER — producer-published sounds you can one-tap claim.
 *
 * This is the scaffold (Phase 5.B step 0). The MINE grid + publish action
 * fill in step 3; DISCOVER fills in once the producer publish-flow lands
 * in step 4. Both tabs render placeholder empty states for now so the
 * navigation is real and the home tile lands somewhere meaningful.
 *
 * Same narrow reading column convention as Home / Booth / Profile /
 * Friends / Leaderboard. Top padding clears the persistent ScreenTopBar.
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
import { SoundPublisher } from "./SoundPublisher";

type TabId = "mine" | "discover";

export function Studio() {
  const setStage = useStore((s) => s.setStage);
  const [tab, setTab] = useState<TabId>("mine");

  return (
    <div
      style={{
        padding: "34px 14px 80px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        maxWidth: 520,
        width: "100%",
        margin: "0 auto",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#a78bfa",
            }}
          >
            🎚️ studio
          </div>
          <div
            style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 18,
              fontWeight: 800,
              color: "#fff",
              marginTop: 2,
            }}
          >
            your sounds
          </div>
        </div>
        <button
          onClick={() => setStage("home")}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "monospace",
            fontSize: 11,
            padding: "6px 10px",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          ← back
        </button>
      </div>

      {/* ── Tab bar ────────────────────────────────────────── */}
      <TabBar active={tab} onChange={setTab} />

      {/* ── Tab content ────────────────────────────────────── */}
      {tab === "mine"     && <MineTab />}
      {tab === "discover" && <DiscoverTab />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs                                                                        */
/* -------------------------------------------------------------------------- */

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "mine",     label: "mine",     icon: "🎚️" },
  { id: "discover", label: "discover", icon: "🌀" },
];

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              flex: 1,
              padding: "7px 6px",
              borderRadius: 7,
              border: "none",
              background: isActive
                ? "linear-gradient(135deg, rgba(167,139,250,0.22) 0%, rgba(34,211,238,0.18) 100%)"
                : "transparent",
              boxShadow: isActive ? "0 0 10px rgba(167,139,250,0.18)" : "none",
              color: isActive ? "#fff" : "rgba(255,255,255,0.55)",
              fontFamily: "monospace",
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              transition: "background 150ms ease, color 150ms ease",
            }}
          >
            <span style={{ fontSize: 12 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MINE tab — your inventory grouped by kind                                    */
/* -------------------------------------------------------------------------- */

/** Section ordering — left-to-right priority on screen. */
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

  if (items === null) {
    return <div style={emptyState}>loading your sounds…</div>;
  }
  if (items.length === 0) {
    return (
      <div style={emptyState}>
        no sounds yet — sign in and your starter pack will appear here.
      </div>
    );
  }

  // Studio inventory total + producer-published count for the header strip
  const total           = items.length;
  const producerCount   = items.filter((s) => s.producerId !== null).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Inventory header strip — count + future "publish a sound" CTA slot */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "8px 12px",
          background:     "linear-gradient(135deg, rgba(167,139,250,0.12) 0%, rgba(0,0,0,0.4) 100%)",
          border:         "1px solid rgba(167,139,250,0.25)",
          borderRadius:   10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily:     "monospace",
              fontSize:       9,
              letterSpacing:  "0.18em",
              textTransform:  "uppercase",
              color:          "rgba(255,255,255,0.5)",
            }}
          >
            inventory
          </div>
          <div
            style={{
              fontFamily:    "'Space Grotesk', system-ui, sans-serif",
              fontSize:      18,
              fontWeight:    800,
              color:         "#fff",
              marginTop:     1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {total} sounds
          </div>
        </div>
        <button
          onClick={() => setPublisherOpen(true)}
          style={{
            display:        "inline-flex",
            alignItems:     "center",
            gap:            6,
            padding:        "7px 12px",
            borderRadius:   18,
            background:     "rgba(124,58,237,0.85)",
            border:         "1px solid rgba(167,139,250,0.5)",
            color:          "#fff",
            fontFamily:     "monospace",
            fontSize:       11,
            fontWeight:     900,
            cursor:         "pointer",
            boxShadow:      "0 0 14px rgba(124,58,237,0.35)",
            whiteSpace:     "nowrap",
          }}
        >
          🎛️ <span>publish a sound</span>
        </button>
      </div>
      {producerCount > 0 && (
        <div style={{
          fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.5)",
          textAlign: "right",
        }}>
          <span style={{ color: "#a78bfa", fontWeight: 800 }}>{producerCount}</span>
          <span> producer drops in your inventory</span>
        </div>
      )}

      {/* One section per kind — only render kinds that have at least one sound */}
      {KIND_ORDER.map((kind) => {
        const list = grouped?.[kind] ?? [];
        if (list.length === 0) return null;
        return (
          <KindSection key={kind} kind={kind} sounds={list} />
        );
      })}

      {publisherOpen && (
        <SoundPublisher
          onClose={() => {
            setPublisherOpen(false);
            // Re-fetch so the new sound (auto-granted to the producer) shows
            // up in the inventory grid immediately.
            reload();
          }}
        />
      )}
    </div>
  );
}

function KindSection({ kind, sounds }: { kind: LayerKind; sounds: InventorySound[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display:        "flex",
          alignItems:     "baseline",
          gap:            8,
          fontFamily:     "monospace",
          fontSize:       10,
          letterSpacing:  "0.18em",
          textTransform:  "uppercase",
          color:          "rgba(255,255,255,0.55)",
        }}
      >
        <span style={{ fontSize: 14 }}>{KIND_ICON[kind]}</span>
        <span>{KIND_LABEL[kind]}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ opacity: 0.5, fontVariantNumeric: "tabular-nums" }}>{sounds.length}</span>
      </div>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
          gap:                 8,
        }}
      >
        {sounds.map((s) => (
          <SoundTile key={s.id} sound={s} />
        ))}
      </div>
    </div>
  );
}

/**
 * SoundTile — the chunky game-feel card. Press scales it down for tactile
 * feedback; produces a small hover glow. Audio preview will land in a later
 * pass when we wire the existing audio engine to the catalog row's
 * audio_url. For now the tile is a pressable glyph + name.
 */
function SoundTile({ sound }: { sound: InventorySound }) {
  const [pressed, setPressed] = useState(false);
  const isProducer = sound.producerId !== null;

  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      title={`${sound.displayName}${sound.variant ? ` · ${sound.variant}` : ""}${sound.bpm ? ` · ${sound.bpm} BPM` : ""}${sound.keyRoot ? ` · ${sound.keyRoot}` : ""}`}
      style={{
        position:       "relative",
        aspectRatio:    "1 / 1",
        background:     `linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(0,0,0,0.45) 100%)`,
        border:         `1px solid ${isProducer ? "rgba(167,139,250,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius:   12,
        padding:        "8px 6px",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        gap:            6,
        cursor:         "pointer",
        transform:      pressed ? "scale(0.94)" : "scale(1)",
        boxShadow:      pressed
          ? "inset 0 2px 6px rgba(0,0,0,0.4)"
          : isProducer
            ? "0 4px 14px rgba(0,0,0,0.4), 0 0 12px rgba(167,139,250,0.15)"
            : "0 2px 8px rgba(0,0,0,0.3)",
        transition:     "transform 90ms ease, box-shadow 120ms ease",
      }}
    >
      <span
        style={{
          fontSize:    28,
          lineHeight:  1,
          filter:      "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          userSelect:  "none",
        }}
      >
        {sound.glyph}
      </span>
      <span
        style={{
          fontFamily:    "monospace",
          fontSize:      9.5,
          fontWeight:    700,
          color:         "rgba(255,255,255,0.85)",
          letterSpacing: "0.02em",
          whiteSpace:    "nowrap",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          maxWidth:      "100%",
          textAlign:     "center",
        }}
      >
        {sound.displayName}
      </span>
      {isProducer && (
        <span
          style={{
            position:      "absolute",
            top:           4,
            right:         4,
            fontSize:      9,
            background:    "rgba(167,139,250,0.5)",
            color:         "#fff",
            padding:       "1px 4px",
            borderRadius:  4,
            letterSpacing: "0.05em",
          }}
          title="producer-published"
        >
          🎛️
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* DISCOVER tab — producer-published sounds, newest first                       */
/* -------------------------------------------------------------------------- */

/** Claims-this-week threshold for the 🔥 trending badge. Mirror server-side
 *  game_config.claim_sound.trending_min_claims_per_week (the badge is purely
 *  decorative, so a small drift is fine). */
const TRENDING_MIN_CLAIMS_PER_WEEK = 5;

function DiscoverTab() {
  const userId         = useStore((s) => s.userId);
  const claimSound     = useStore((s) => s.claimSound);
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

  // Optimistic local patch — bumps claimCount and flips ownedByMe right
  // after a successful claim so the tile re-renders without a refetch.
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

  if (items === null) {
    return <div style={emptyState}>loading…</div>;
  }
  if (items.length === 0) {
    return (
      <div style={emptyState}>
        no producer drops yet — be the first to publish.
        <br />
        <span style={{ opacity: 0.55, fontSize: 9 }}>head to MINE → publish a sound</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.5)",
        letterSpacing: "0.1em", textTransform: "uppercase",
      }}>
        🌀 fresh drops · {items.length}
      </div>
      <div style={{
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap:                 10,
      }}>
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

function DiscoverTile({ sound, claiming, onClaim }: DiscoverTileProps) {
  const isTrending = sound.claimsThisWeek >= TRENDING_MIN_CLAIMS_PER_WEEK;
  const canClaim   = !sound.ownedByMe && !claiming;

  return (
    <div
      title={`${sound.displayName}${sound.variant ? ` · ${sound.variant}` : ""}${sound.bpm ? ` · ${sound.bpm} BPM` : ""}`}
      style={{
        position:       "relative",
        background:     "linear-gradient(135deg, rgba(167,139,250,0.10) 0%, rgba(0,0,0,0.45) 100%)",
        border:         `1px solid ${sound.ownedByMe ? "rgba(74,222,128,0.4)" : isTrending ? "rgba(249,115,22,0.55)" : "rgba(167,139,250,0.35)"}`,
        borderRadius:   12,
        padding:        "12px 10px 10px",
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            8,
        opacity:        sound.ownedByMe ? 0.7 : 1,
        boxShadow:      isTrending
          ? "0 4px 14px rgba(0,0,0,0.4), 0 0 14px rgba(249,115,22,0.25)"
          : "0 4px 14px rgba(0,0,0,0.35), 0 0 12px rgba(167,139,250,0.12)",
      }}
    >
      {/* Glyph */}
      <div style={{
        fontSize: 30, lineHeight: 1, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
      }}>
        {sound.glyph}
      </div>
      {/* Display name */}
      <div style={{
        fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#fff",
        textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        maxWidth: "100%",
      }}>
        {sound.displayName}
      </div>
      {/* Producer line */}
      <div style={{
        fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.55)",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        <span>{sound.producerAvatar ?? "🎧"}</span>
        <span>{sound.producerName ?? "anon"}</span>
      </div>
      {/* Claim count line */}
      <div style={{
        fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.45)",
        display: "flex", alignItems: "center", gap: 4,
        fontVariantNumeric: "tabular-nums",
      }}>
        <span>💿</span>
        <span>{sound.claimCount} claim{sound.claimCount === 1 ? "" : "s"}</span>
        {isTrending && <span style={{ color: "#fb923c" }}>· 🔥 trending</span>}
      </div>
      {/* Action */}
      <button
        onClick={canClaim ? onClaim : undefined}
        disabled={!canClaim}
        style={{
          fontFamily:    "monospace",
          fontSize:      10,
          fontWeight:    800,
          padding:       "5px 12px",
          borderRadius:  14,
          background:    sound.ownedByMe
            ? "rgba(74,222,128,0.18)"
            : claiming
              ? "rgba(124,58,237,0.18)"
              : "rgba(124,58,237,0.85)",
          border:        `1px solid ${sound.ownedByMe ? "rgba(74,222,128,0.4)" : "rgba(167,139,250,0.5)"}`,
          color:         sound.ownedByMe
            ? "#4ade80"
            : claiming
              ? "#a78bfa"
              : "#fff",
          cursor:        canClaim ? "pointer" : "default",
          letterSpacing: "0.05em",
          minWidth:      72,
          boxShadow:     canClaim ? "0 0 10px rgba(124,58,237,0.3)" : "none",
        }}
      >
        {sound.ownedByMe
          ? "✓ owned"
          : claiming
            ? "claiming…"
            : "claim 💿"}
      </button>
      {/* Kind tag in corner */}
      <span style={{
        position: "absolute", top: 5, left: 6,
        fontSize: 11, opacity: 0.7,
      }}>
        {KIND_ICON[sound.kind]}
      </span>
      {isTrending && (
        <span style={{
          position: "absolute", top: 5, right: 6,
          fontSize: 13,
          filter: "drop-shadow(0 0 6px rgba(249,115,22,0.6))",
        }}>
          🔥
        </span>
      )}
    </div>
  );
}

const emptyState: React.CSSProperties = {
  padding: "40px 20px",
  textAlign: "center",
  fontFamily: "monospace",
  fontSize: 11,
  color: "rgba(255,255,255,0.4)",
  border: "1px dashed rgba(255,255,255,0.1)",
  borderRadius: 12,
  lineHeight: 1.6,
};
