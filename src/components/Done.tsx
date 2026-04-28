import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { playSong, stopSong } from "../audio/engine";
import { publishTemplateRpc } from "../lib/sounds-db";
import type { LayerKind } from "../data/types";

/**
 * Celebration screen after saving a song. The DAW reacts — this is the
 * emotional payoff that makes saving feel like an achievement.
 * Also shows elapsed time vs. the 60-second promise.
 */
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

  // Capture elapsed seconds at the moment Done mounts (timer is now frozen)
  const elapsedRef = useRef<number>(
    sessionStartedAt ? Math.floor((Date.now() - sessionStartedAt) / 1000) : 0
  );
  const elapsed = elapsedRef.current;

  useEffect(() => {
    if (latest && !autoPlayed.current) {
      autoPlayed.current = true;
      playSong(latest, vocalBuffer).catch(() => {});
    }
    return () => stopSong();
  }, [latest, vocalBuffer]);

  const talkLine =
    elapsed <= 45  ? "speed run. elite." :
    elapsed <= 60  ? "that's a banger. for real." :
    elapsed <= 90  ? "good one. almost got the speed." :
                     "that's a vibe. took your time.";

  // Push the celebration line into the DAW mouth bubble; clears on unmount.
  // Declared BEFORE any early return so hook order stays stable.
  useEffect(() => {
    if (!latest) return;
    sayLine(talkLine);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkLine, latest]);

  if (!latest) return null;

  const speedResult =
    elapsed <= 45  ? { label: "SPEED RUN 🔥",   color: "text-green-400",  msg: `${elapsed}s — under 45!` } :
    elapsed <= 60  ? { label: "UNDER 60 ✓",      color: "text-accent",     msg: `${elapsed}s — nailed it` } :
    elapsed <= 90  ? { label: "CLOSE",           color: "text-yellow-400", msg: `${elapsed}s — almost there` } :
                     { label: "TAKE YOUR TIME",  color: "text-white/60",   msg: `${elapsed}s — no rush` };

  return (
    <div className="p-6 max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
      <div>
        <div className="chip bg-gold/10 border border-gold/30 text-gold">
          💿 added to inventory
        </div>
        <h2 className="font-display text-4xl font-bold mt-2">
          "{latest.name}"
        </h2>
        <div className="mt-1 text-[12px] font-mono text-white/60">
          {latest.bpm} bpm · {latest.bars} bars · key {latest.keyRoot}
        </div>
      </div>

      {/* 60-second result */}
      {elapsed > 0 && (
        <div className="card p-4 w-full">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className={`font-display font-bold text-xl ${speedResult.color}`}>
                {speedResult.label}
              </div>
              <div className="text-[12px] font-mono text-white/50 mt-0.5">
                {speedResult.msg}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-white/40 uppercase">target</div>
              <div className="text-[12px] font-mono text-white/60">60 seconds</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full h-1.5 bg-raised rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                elapsed <= 60 ? "bg-gradient-to-r from-green-500 to-accent" : "bg-orange-400/60"
              }`}
              style={{ width: `${Math.min(100, (elapsed / 60) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="card p-5 w-full">
        <div className="flex flex-wrap gap-1 justify-center mb-3">
          {latest.tags.map((t) => (
            <span key={t} className="chip bg-raised border border-line text-white/70">
              #{t}
            </span>
          ))}
        </div>
        <div className="text-[12px] font-mono text-white/60">
          layers: {latest.layers.map((l) => l.kind).join(" + ")}
        </div>
        {latest.collaborators.length > 1 && (
          <div className="mt-2 text-[12px] font-mono text-accent">
            collab: {latest.collaborators.join(" × ")}
          </div>
        )}
        {latest.pitchScore !== undefined && (
          <div className="mt-2 text-[12px] font-mono text-gold">
            hook landed · {latest.pitchScore}/100 on pitch
          </div>
        )}
      </div>

      {/* Publish CTA — the high-energy action. Lives above the secondary
       * options so it reads as the meaningful commitment, not just another
       * button. Disabled states are explicit: already out, mid-publish, or
       * not enough energy. Cap-reached is caught server-side and returns a
       * clear message via the companion ticker. */}
      {(() => {
        const liveEnergy    = computeLiveEnergy(energy, energyUpdatedAt);
        const isPublished   = !!latest.publishedPublicationId;
        const isPublishing  = publishingSongId === latest.id;
        const canAfford     = liveEnergy >= ENERGY_COSTS.publishSong;
        const disabled      = isPublished || isPublishing || !canAfford;
        const label         = isPublished  ? "🎧 already published"
                            : isPublishing ? "rendering + uploading…"
                            : !canAfford   ? `need ${ENERGY_COSTS.publishSong - liveEnergy} more ⚡`
                            :                `🎧 publish · ${ENERGY_COSTS.publishSong}⚡`;
        return (
          <button
            className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled}
            onClick={() => publishSong(latest.id)}
            title={
              isPublished
                ? "this drop is live in the booth"
                : `publish to the listening booth (-${ENERGY_COSTS.publishSong} ⚡)`
            }
          >
            {label}
          </button>
        );
      })()}

      {/* Phase 5.B step 10 — publish-as-template CTA. Visible only when the
       *  song's recipe has actual sound layers (vocal-only is excluded) and
       *  the player owns every sound used. The modal explains the cost. */}
      {(() => {
        const soundLayers = latest.layers.filter((l) => l.kind !== "vocal" && !!l.soundId);
        if (soundLayers.length === 0) return null;
        // Producer must own every sound (RPC will also reject otherwise).
        const ownsAll = !!ownedSoundIds && soundLayers.every((l) => ownedSoundIds.has(l.soundId));
        if (!ownsAll) return null;
        return (
          <button
            className="btn-ghost text-[11px]"
            onClick={() => setTemplateOpen(true)}
            title={`publish this recipe as a template (${ENERGY_COSTS.publishTemplate}⚡)`}
          >
            🎛️ publish as template · {ENERGY_COSTS.publishTemplate}⚡
          </button>
        );
      })()}

      {templateOpen && latest && (
        <TemplatePublisherModal
          songName={latest.name}
          bpm={latest.bpm}
          bars={latest.bars}
          keyRoot={latest.keyRoot}
          tags={latest.tags}
          recipe={latest.layers
            .filter((l) => l.kind !== "vocal" && !!l.soundId)
            .map((l) => l.kind)}
          soundIds={latest.layers
            .filter((l) => l.kind !== "vocal" && !!l.soundId)
            .map((l) => l.soundId)}
          onClose={() => setTemplateOpen(false)}
        />
      )}

      {/* Slice 1 — post-Done arrange + mixer entry points (replaces the old
       *  canvas-window panning gestures). Only visible when the song has
       *  layers to arrange/mix. */}
      {latest.layers.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            className="btn-ghost text-xs"
            onClick={() => { stopSong(); setStage("arrange"); }}
            title="arrange sections — drop layers in/out per part"
          >
            🎚️ arrange
          </button>
          <button
            className="btn-ghost text-xs"
            onClick={() => { stopSong(); setStage("mixer"); }}
            title="mix levels + FX per layer"
          >
            🎛️ mix
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          className="btn-primary"
          onClick={() => { reset(); setStage("template"); }}
        >
          🔁 cook another
        </button>
        <button
          className="btn-ghost"
          onClick={() => { stopSong(); setStage("booth"); }}
        >
          🎧 visit the booth
        </button>
        <button
          className="btn-ghost"
          onClick={() => { stopSong(); setStage("home"); }}
        >
          ← home
        </button>
      </div>

      <div className="mt-4 text-[11px] font-mono text-white/40 max-w-sm">
        Companion: songs finished {tamagotchi.songsFinished}.
        {tamagotchi.songsFinished > 0 ? " creativity +15, energy −5." : ""}
      </div>
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
