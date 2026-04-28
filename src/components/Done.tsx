import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { playSong, stopSong } from "../audio/engine";
import { publishTemplateRpc } from "../lib/sounds-db";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";
import type { LayerKind } from "../data/types";

/**
 * Done — UI v1 celebration screen (slice 2.3).
 *
 * The emotional payoff. Big golden disc centerpiece + ribbon banner +
 * confetti + radial light + the song title in chunky display sans, then
 * a hero "publish" pill, secondary "publish as template" pill (when
 * eligible), arrange/mix entry points, and a small icon row at the
 * bottom to navigate away. Manifesto rule #6: one primary CTA — the
 * publish pill is the hero.
 */

type SpeedTier = "speedrun" | "under60" | "close" | "chill";

const SPEED_TIERS: Record<SpeedTier, { label: string; ribbon: string; tint: string; msg: (s: number) => string }> = {
  speedrun: {
    label:  "SPEED RUN 🔥",
    ribbon: "from-grvd-lime to-grvd-cyan",
    tint:   "shadow-glow-lime",
    msg:    (s) => `${s}s · under 45`,
  },
  under60: {
    label:  "UNDER 60 ✓",
    ribbon: "from-grvd-cyan to-grvd-purple",
    tint:   "shadow-glow-cyan",
    msg:    (s) => `${s}s · nailed it`,
  },
  close: {
    label:  "CLOSE",
    ribbon: "from-grvd-gold to-grvd-orange",
    tint:   "shadow-glow-gold",
    msg:    (s) => `${s}s · almost there`,
  },
  chill: {
    label:  "TOOK YOUR TIME",
    ribbon: "from-grvd-purple to-grvd-magenta",
    tint:   "shadow-glow-purple",
    msg:    (s) => `${s}s · no rush`,
  },
};

function tierFor(elapsed: number): SpeedTier {
  if (elapsed <= 45) return "speedrun";
  if (elapsed <= 60) return "under60";
  if (elapsed <= 90) return "close";
  return "chill";
}

const TALK_PER_TIER: Record<SpeedTier, string> = {
  speedrun: "speed run. elite.",
  under60:  "that's a banger. for real.",
  close:    "good one. almost got the speed.",
  chill:    "that's a vibe. took your time.",
};

export function Done() {
  const {
    inventory, setStage, tamagotchi, reset, vocalBuffer,
    sessionStartedAt, sayLine,
    publishSong, publishingSongId, energy, energyUpdatedAt,
    ownedSoundIds,
  } = useStore();
  const latest = inventory[0];
  const autoPlayed = useRef(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  // Capture elapsed seconds at the moment Done mounts (timer is frozen).
  const elapsedRef = useRef<number>(
    sessionStartedAt ? Math.floor((Date.now() - sessionStartedAt) / 1000) : 0
  );
  const elapsed = elapsedRef.current;
  const tier = tierFor(elapsed);
  const tierData = SPEED_TIERS[tier];

  useEffect(() => {
    if (latest && !autoPlayed.current) {
      autoPlayed.current = true;
      playSong(latest, vocalBuffer).catch(() => {});
    }
    return () => stopSong();
  }, [latest, vocalBuffer]);

  // Push the celebration line into the talk bubble; clears on unmount.
  useEffect(() => {
    if (!latest) return;
    sayLine(TALK_PER_TIER[tier]);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier, latest]);

  if (!latest) return null;

  const liveEnergy   = computeLiveEnergy(energy, energyUpdatedAt);
  const isPublished  = !!latest.publishedPublicationId;
  const isPublishing = publishingSongId === latest.id;
  const canAfford    = liveEnergy >= ENERGY_COSTS.publishSong;
  const publishLabel = isPublished
    ? "✓ ALREADY PUBLISHED"
    : isPublishing
      ? "PUBLISHING…"
      : !canAfford
        ? `NEED ${ENERGY_COSTS.publishSong - liveEnergy} MORE ⚡`
        : `PUBLISH · ${ENERGY_COSTS.publishSong}⚡`;
  const publishDisabled = isPublished || isPublishing || !canAfford;

  // Template publish eligibility — preserved from prior behavior.
  const soundLayers = latest.layers.filter((l) => l.kind !== "vocal" && !!l.soundId);
  const canPublishTemplate =
    soundLayers.length > 0 &&
    !!ownedSoundIds &&
    soundLayers.every((l) => ownedSoundIds.has(l.soundId));

  const progressPct = Math.min(100, (elapsed / 60) * 100);

  return (
    <div className="pt-3 pb-8 flex flex-col items-stretch gap-4 relative overflow-hidden">
      {/* ── Confetti backdrop layer ── */}
      <ConfettiField />

      {/* ── Hero disc + ribbon ── */}
      <div className="relative mx-auto mt-2 mb-1 flex flex-col items-center">
        {/* Radial light rays behind the disc */}
        <div
          aria-hidden
          className="absolute inset-0 -m-12"
          style={{
            background:
              "radial-gradient(circle at center, rgba(251,191,36,0.30) 0%, rgba(255,77,156,0.20) 30%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />

        {/* Speed-tier ribbon banner (above the disc) */}
        <div
          className={[
            "relative z-10 -mb-3 px-5 py-1.5 rounded-full",
            "bg-gradient-to-r", tierData.ribbon,
            "shadow-chunky-press",
            tierData.tint,
            "font-display text-white text-sm tracking-wider",
          ].join(" ")}
        >
          {tierData.label}
        </div>

        {/* Disc */}
        <DiscArt />

        {/* "added to inventory" tiny chip below */}
        <div className="relative z-10 mt-3">
          <ChunkyBadge variant="gold" size="sm" icon="💿">
            ADDED TO INVENTORY
          </ChunkyBadge>
        </div>
      </div>

      {/* ── Title + meta ── */}
      <div className="text-center px-4">
        <h2 className="font-display text-3xl text-white leading-tight">
          "{latest.name}"
        </h2>
        <div className="mt-2 font-sans text-[11px] text-grvd-purple/75 tracking-widest uppercase">
          {latest.bpm} bpm · {latest.bars} bars · key {latest.keyRoot}
        </div>
      </div>

      {/* ── 60s progress capsule ── */}
      <div className="mx-auto w-full max-w-[320px] px-3">
        <div className="rounded-full bg-grvd-panel/80 border border-grvd-line shadow-chunky-press px-4 py-2 flex items-center gap-3">
          <span className="font-display text-grvd-gold text-sm">⏱</span>
          <div className="flex-1 h-2 rounded-full bg-grvd-base overflow-hidden">
            <div
              className={[
                "h-full rounded-full",
                tier === "speedrun" ? "bg-gradient-to-r from-grvd-lime to-grvd-cyan"
                : tier === "under60" ? "bg-gradient-to-r from-grvd-cyan to-grvd-purple"
                : tier === "close"  ? "bg-gradient-to-r from-grvd-gold to-grvd-orange"
                :                     "bg-gradient-to-r from-grvd-purple to-grvd-magenta",
              ].join(" ")}
              style={{ width: `${progressPct}%`, transition: "width 1s ease-out" }}
            />
          </div>
          <span className="font-display text-white text-sm tabular-nums">
            {elapsed}s
          </span>
        </div>
        <div className="mt-1 text-center font-sans text-[10px] text-grvd-purple/60 tracking-wider uppercase">
          {tierData.msg(elapsed)} · target 60s
        </div>
      </div>

      {/* ── Tags + collaborators + pitch score ── */}
      <div className="px-4 flex flex-col items-center gap-2">
        <div className="flex flex-wrap gap-1.5 justify-center">
          {latest.tags.map((t) => (
            <ChunkyBadge key={t} variant="purple" size="sm">
              #{t}
            </ChunkyBadge>
          ))}
        </div>
        {latest.collaborators.length > 1 && (
          <ChunkyBadge variant="cyan" size="sm" icon="🤝">
            {latest.collaborators.join(" × ")}
          </ChunkyBadge>
        )}
        {latest.pitchScore !== undefined && (
          <ChunkyBadge variant="gold" size="sm" icon="🎤">
            HOOK · {latest.pitchScore}/100
          </ChunkyBadge>
        )}
      </div>

      {/* ── Hero publish CTA ── */}
      <div className="px-3 mt-1">
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="🎧"
          onClick={() => publishSong(latest.id)}
          disabled={publishDisabled}
          className="w-full text-lg tracking-wider"
        >
          {publishLabel}
        </ChunkyButton>
      </div>

      {/* ── Secondary publish-as-template ── */}
      {canPublishTemplate && (
        <div className="px-3">
          <ChunkyButton
            variant="purple"
            size="md"
            icon="🎛️"
            onClick={() => setTemplateOpen(true)}
            className="w-full"
          >
            PUBLISH AS TEMPLATE · {ENERGY_COSTS.publishTemplate}⚡
          </ChunkyButton>
        </div>
      )}

      {/* ── Arrange + Mix row (only when there are layers) ── */}
      {latest.layers.length > 0 && (
        <div className="flex items-center justify-center gap-2 px-3">
          <ChunkyPill variant="cyan" size="md" icon="🎚️" onClick={() => { stopSong(); setStage("arrange"); }}>
            ARRANGE
          </ChunkyPill>
          <ChunkyPill variant="magenta" size="md" icon="🎛️" onClick={() => { stopSong(); setStage("mixer"); }}>
            MIX
          </ChunkyPill>
        </div>
      )}

      {/* ── Tertiary nav row ── */}
      <div className="flex items-center justify-center gap-2 px-3 mt-1 mb-2">
        <ChunkyPill variant="ghost" size="sm" icon="🔁" onClick={() => { reset(); setStage("template"); }}>
          cook another
        </ChunkyPill>
        <ChunkyPill variant="ghost" size="sm" icon="🎧" onClick={() => { stopSong(); setStage("booth"); }}>
          booth
        </ChunkyPill>
        <ChunkyPill variant="ghost" size="sm" icon="🏠" onClick={() => { stopSong(); setStage("home"); }}>
          home
        </ChunkyPill>
      </div>

      {/* ── Companion stat (subtle bottom note) ── */}
      <div className="text-center font-sans text-[10px] text-grvd-purple/50 px-4">
        songs finished {tamagotchi.songsFinished}
        {tamagotchi.songsFinished > 0 && " · creativity +15 · energy −5"}
      </div>

      {templateOpen && (
        <TemplatePublisherModal
          songName={latest.name}
          bpm={latest.bpm}
          bars={latest.bars}
          keyRoot={latest.keyRoot}
          tags={latest.tags}
          recipe={soundLayers.map((l) => l.kind)}
          soundIds={soundLayers.map((l) => l.soundId)}
          onClose={() => setTemplateOpen(false)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Disc art — golden CD with rainbow spiral reflection                          */
/* -------------------------------------------------------------------------- */

function DiscArt() {
  return (
    <div className="relative z-10" aria-hidden>
      <div
        className="w-[180px] h-[180px] rounded-full relative animate-puck-bob"
        style={{
          background: [
            // Conic rainbow shimmer
            "conic-gradient(from 45deg, #fbbf24, #ff4d9c, #a78bfa, #22d3ee, #4ade80, #fbbf24)",
          ].join(", "),
          boxShadow: [
            "0 12px 0 0 rgba(0,0,0,0.4)",
            "0 24px 60px rgba(251, 191, 36, 0.45)",
            "0 0 80px rgba(255, 77, 156, 0.35)",
            "inset 0 4px 0 rgba(255,255,255,0.6)",
            "inset 0 -8px 16px rgba(0,0,0,0.4)",
          ].join(", "),
        }}
      >
        {/* Glossy highlight */}
        <div
          className="absolute top-2 left-4 right-4 h-12 rounded-full opacity-70"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.85) 0%, transparent 100%)",
            filter: "blur(2px)",
          }}
        />
        {/* Inner darker ring */}
        <div
          className="absolute inset-[18px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 70%, transparent 100%)",
            border: "2px solid rgba(0,0,0,0.4)",
          }}
        />
        {/* Center hole */}
        <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-grvd-base border-2 border-white/40" />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Confetti field — drifting particles in the page background                  */
/* -------------------------------------------------------------------------- */

function ConfettiField() {
  // Static pre-rendered particle list — cheap, no animation library.
  const particles = [
    { x: "8%",  y: "12%", c: "#fbbf24", d: 0   },
    { x: "84%", y: "16%", c: "#ff4d9c", d: 0.3 },
    { x: "20%", y: "30%", c: "#22d3ee", d: 0.6 },
    { x: "70%", y: "26%", c: "#a78bfa", d: 0.9 },
    { x: "12%", y: "48%", c: "#4ade80", d: 1.2 },
    { x: "90%", y: "44%", c: "#fbbf24", d: 1.5 },
    { x: "30%", y: "62%", c: "#ff4d9c", d: 1.8 },
    { x: "62%", y: "58%", c: "#22d3ee", d: 2.1 },
  ];
  return (
    <div aria-hidden className="absolute inset-0 pointer-events-none -z-10">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute block w-1.5 h-3 rounded-sm"
          style={{
            left: p.x,
            top:  p.y,
            background: p.c,
            boxShadow: `0 0 8px ${p.c}`,
            transform: "rotate(35deg)",
            animation: `puck-bob 3s ease-in-out infinite`,
            animationDelay: `${p.d}s`,
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Template publish modal — Phase 5.B step 10                                  */
/* -------------------------------------------------------------------------- */

interface TemplatePublisherModalProps {
  songName: string;
  bpm:      number;
  bars:     number;
  keyRoot:  string;
  tags:     string[];
  recipe:   LayerKind[];
  soundIds: string[];
  onClose:  () => void;
}

function TemplatePublisherModal({
  songName, bpm, bars, keyRoot, tags, recipe, soundIds, onClose,
}: TemplatePublisherModalProps) {
  const energy          = useStore((s) => s.energy);
  const energyUpdatedAt = useStore((s) => s.energyUpdatedAt);
  const liveEnergy      = computeLiveEnergy(energy, energyUpdatedAt);
  const COST            = ENERGY_COSTS.publishTemplate;

  const [name,     setName]     = useState(songName);
  const [subtitle, setSubtitle] = useState("");
  const [phase,    setPhase]    = useState<"editing" | "submitting" | "done">("editing");
  const [error,    setError]    = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("template name required");
      return;
    }
    setError(null);
    setPhase("submitting");
    const result = await publishTemplateRpc({
      name:     name.trim(),
      subtitle: subtitle.trim() || null,
      bpm,
      bars,
      keyRoot,
      recipe,
      soundIds,
      tags,
    });
    if (!result || !result.success) {
      setError(result?.message ?? "publish failed");
      setPhase("editing");
      return;
    }
    // Commit authoritative server numbers.
    useStore.setState((s) => ({
      energy:          result.newEnergy,
      energyUpdatedAt: Date.now(),
      totalXP:         result.newXp || s.totalXP,
      level:           result.newLevel || s.level,
    }));
    setPhase("done");
    setTimeout(() => onClose(), 1100);
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "submitting") onClose(); }}
      style={{
        position: "absolute", inset: 0, background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "30px 14px", zIndex: 60,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 420,
        background: "linear-gradient(180deg, rgba(20,18,40,0.98), rgba(10,10,18,0.98))",
        border: "1px solid rgba(167,139,250,0.35)",
        borderRadius: 16, padding: "16px 16px 18px",
        display: "flex", flexDirection: "column", gap: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 30px rgba(167,139,250,0.15)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{
              fontFamily: "monospace", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.2em", textTransform: "uppercase", color: "#a78bfa",
            }}>
              🎛️ publish a template
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 2,
            }}>
              recipe other producers can use
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost text-xs"
            disabled={phase === "submitting"} style={phase === "submitting" ? { opacity: 0.5 } : undefined}>
            ✕
          </button>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Field label="template name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              disabled={phase !== "editing"}
              style={inputStyle}
            />
          </Field>
          <Field label="subtitle (optional)">
            <input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value.slice(0, 80))}
              placeholder="e.g. trap-style hook · fast"
              disabled={phase !== "editing"}
              style={inputStyle}
            />
          </Field>
          <div style={summaryStyle}>
            <div>{bpm} bpm · {bars} bars · key {keyRoot}</div>
            <div>recipe: {recipe.join(" + ")}</div>
            <div>{soundIds.length} sound{soundIds.length === 1 ? "" : "s"} · {tags.length} tag{tags.length === 1 ? "" : "s"}</div>
          </div>
        </div>

        {error && (
          <div style={errBox}>{error}</div>
        )}
        {phase === "done" && (
          <div style={successBox}>✓ published · other producers can pick this now</div>
        )}

        {phase !== "done" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
              cost · {COST}⚡ · {liveEnergy < COST ? "low energy" : "ready"}
            </span>
            <button
              onClick={submit}
              disabled={phase === "submitting" || liveEnergy < COST}
              style={{
                ...primaryBtn,
                opacity:  phase === "submitting" || liveEnergy < COST ? 0.5 : 1,
                cursor:   phase === "submitting" || liveEnergy < COST ? "default" : "pointer",
              }}
            >
              {phase === "submitting" ? "publishing…" : `🎛️ publish · ${COST}⚡`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontFamily: "monospace", fontSize: 9, fontWeight: 700,
        letterSpacing: "0.14em", textTransform: "uppercase",
        color: "rgba(255,255,255,0.5)",
      }}>{label}</div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:        "100%", boxSizing: "border-box",
  background:   "rgba(255,255,255,0.05)",
  border:       "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding:      "7px 10px",
  fontFamily:   "monospace", fontSize: 12, color: "#fff", outline: "none",
};

const summaryStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.3)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8, padding: "8px 10px",
  fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.7)",
  display: "flex", flexDirection: "column", gap: 3,
};

const errBox: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 10, color: "#f87171",
  background: "rgba(239,68,68,0.1)",
  border: "1px solid rgba(239,68,68,0.2)",
  borderRadius: 8, padding: "6px 10px", textAlign: "center",
};

const successBox: React.CSSProperties = {
  fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#4ade80",
  background: "rgba(74,222,128,0.1)",
  border: "1px solid rgba(74,222,128,0.25)",
  borderRadius: 8, padding: "8px 10px", textAlign: "center",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "8px 18px", borderRadius: 18,
  background: "rgba(124,58,237,0.85)",
  border: "1px solid rgba(167,139,250,0.4)",
  color: "#fff",
  fontFamily: "monospace", fontSize: 12, fontWeight: 900,
  boxShadow: "0 0 16px rgba(124,58,237,0.35)",
  transition: "all 0.12s",
};
