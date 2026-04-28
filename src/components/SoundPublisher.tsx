/**
 * SoundPublisher — Phase 5.B step 4 modal, UI v1 game-feel rebuild.
 *
 * Producer publish-sound flow:
 *   1. Record a short clip (≤ MAX_CLIP_SECONDS) using the same audio engine
 *      path as VocalRecorder. Mono mic → MediaRecorder → AudioBuffer.
 *   2. Tag it: kind, display name, optional variant, optional BPM/key.
 *   3. Tap "publish sound" — the store handles upload + RPC and commits
 *      authoritative server numbers (energy/xp/level) on success.
 *
 * Lives in Studio (MINE tab) as a header CTA. Renders inside the shared
 * <Modal> chrome so layering matches the rest of the modal sweep.
 */

import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { recordVocal } from "../audio/engine";
import type { LayerKind } from "../data/types";
import { KIND_LABEL } from "../data/types";
import { KIND_ICON } from "../lib/sounds-db";
import { Modal } from "../ui/Modal";
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";

const MAX_CLIP_SECONDS = 6;

const KIND_OPTIONS: LayerKind[] = [
  "kick", "snare", "hat", "808", "drums", "sample", "melody", "vocal",
];

/** Suggested glyphs per kind — designer can reskin later. */
const GLYPH_SUGGESTIONS: Record<LayerKind, string[]> = {
  drums:  ["🥁", "💥", "🔥", "🎛️"],
  kick:   ["🥾", "💥", "🔻", "🥁"],
  snare:  ["👏", "💥", "🔪", "⚡"],
  hat:    ["🎩", "🔆", "✨", "🌟"],
  "808":  ["🔊", "💣", "🛞", "🌊"],
  sample: ["💿", "🎷", "🎺", "📻"],
  melody: ["🎶", "🎹", "🎸", "🌈"],
  vocal:  ["🎤", "🗣️", "💬", "🎙️"],
};

interface Props {
  onClose: () => void;
}

export function SoundPublisher({ onClose }: Props) {
  const publishSound      = useStore((s) => s.publishSound);
  const publishingSound   = useStore((s) => s.publishingSound);
  const energy            = useStore((s) => s.energy);
  const energyUpdatedAt   = useStore((s) => s.energyUpdatedAt);
  const ENERGY_COST = ENERGY_COSTS.publishSound;
  const liveEnergy  = computeLiveEnergy(energy, energyUpdatedAt);

  const [phase,     setPhase]     = useState<"ready" | "recording" | "preview" | "submitting" | "done">("ready");
  const [elapsed,   setElapsed]   = useState(0);
  const [error,     setError]     = useState<string | null>(null);
  const [blob,      setBlob]      = useState<Blob | null>(null);
  const [previewUrl,setPreviewUrl]= useState<string | null>(null);

  // Form
  const [kind,        setKind]        = useState<LayerKind>("kick");
  const [displayName, setDisplayName] = useState("");
  const [variant,     setVariant]     = useState("");
  const [glyph,       setGlyph]       = useState<string>(GLYPH_SUGGESTIONS.kick[0]);
  const [bpm,         setBpm]         = useState<string>("");

  const tickerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => { previewUrlRef.current = previewUrl; }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => { setGlyph(GLYPH_SUGGESTIONS[kind][0]); }, [kind]);

  async function handleRecord() {
    setError(null);
    setBlob(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    setElapsed(0);
    setPhase("recording");

    const startMs = Date.now();
    tickerRef.current = setInterval(() => {
      setElapsed((Date.now() - startMs) / 1000);
    }, 50);

    try {
      const { blob: recBlob } = await recordVocal(MAX_CLIP_SECONDS);
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      setBlob(recBlob);
      const url = URL.createObjectURL(recBlob);
      setPreviewUrl(url);
      setPhase("preview");
    } catch (e) {
      if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
      setError(e instanceof Error ? e.message : "recording failed");
      setPhase("ready");
      setElapsed(0);
    }
  }

  async function handlePublish() {
    if (!blob) return;
    if (!displayName.trim()) {
      setError("give it a name first");
      return;
    }
    setError(null);
    setPhase("submitting");
    const parsedBpm = bpm.trim() === "" ? null : Number(bpm);
    const result = await publishSound({
      blob,
      kind,
      displayName: displayName.trim(),
      glyph,
      variant:     variant.trim() || null,
      bpm:         Number.isFinite(parsedBpm) ? parsedBpm : null,
    });
    if (result?.success) {
      setPhase("done");
      setTimeout(() => onClose(), 1100);
    } else {
      setError(result?.message ?? "publish failed");
      setPhase("preview");
    }
  }

  const canPublish = phase === "preview" && !!blob && displayName.trim().length > 0 && !publishingSound;
  const isFormPhase = phase === "preview" || phase === "submitting" || phase === "done";

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={phase !== "submitting"}
      kicker="🎛️ publish a sound"
      title="drop something to claim"
      subtitle="other producers can pick it up from Discover"
    >
      <div className="flex flex-col gap-4 pb-3">
        {/* Recorder zone */}
        <div className="rounded-2xl border border-white/8 bg-black/30 p-4 flex flex-col items-center gap-3">
          {phase === "ready" && (
            <>
              <div className="font-mono text-[11px] text-white/55 text-center">
                tap to record up to {MAX_CLIP_SECONDS}s
              </div>
              <ChunkyButton variant="hero" size="md" icon="🎤" onClick={handleRecord}>
                start recording
              </ChunkyButton>
            </>
          )}
          {phase === "recording" && (
            <>
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full bg-red-400"
                  style={{
                    boxShadow: "0 0 12px #f87171",
                    animation: "recPulse 0.8s ease-in-out infinite alternate",
                  }}
                />
                <span className="font-mono text-[12px] font-bold text-red-400">
                  recording — {(MAX_CLIP_SECONDS - elapsed).toFixed(1)}s left
                </span>
              </div>
              <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-grvd-purple to-red-400 transition-[width] duration-75"
                  style={{ width: `${Math.min(elapsed / MAX_CLIP_SECONDS, 1) * 100}%` }}
                />
              </div>
              <style>{`@keyframes recPulse { from{opacity:1;transform:scale(1)} to{opacity:0.5;transform:scale(0.85)} }`}</style>
            </>
          )}
          {(phase === "preview" || phase === "submitting" || phase === "done") && previewUrl && (
            <>
              <audio controls src={previewUrl} className="w-full" />
              {phase === "preview" && (
                <ChunkyPill variant="ghost" size="sm" icon="🔁" onClick={handleRecord}>
                  redo
                </ChunkyPill>
              )}
            </>
          )}
        </div>

        {/* Form */}
        {isFormPhase && (
          <div className="flex flex-col gap-3">
            <div>
              <FieldLabel>kind</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    disabled={phase !== "preview"}
                    className={[
                      "inline-flex items-center gap-1 px-2.5 py-1 rounded-full",
                      "font-mono text-[10px] font-bold transition-all",
                      "shadow-chunky-press",
                      kind === k
                        ? "bg-grvd-purple/30 border border-grvd-purple/60 text-white"
                        : "bg-white/5 border border-white/10 text-white/55",
                    ].join(" ")}
                  >
                    <span>{KIND_ICON[k]}</span>
                    <span>{KIND_LABEL[k]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <FieldLabel>display name</FieldLabel>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                  placeholder="e.g. nightcore boom"
                  disabled={phase !== "preview"}
                  className={fieldClass}
                />
              </div>
              <div>
                <FieldLabel>variant <span className="opacity-40">(opt)</span></FieldLabel>
                <input
                  value={variant}
                  onChange={(e) => setVariant(e.target.value.slice(0, 30))}
                  placeholder="trap"
                  disabled={phase !== "preview"}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <FieldLabel>glyph</FieldLabel>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {GLYPH_SUGGESTIONS[kind].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGlyph(g)}
                      disabled={phase !== "preview"}
                      className={[
                        "w-9 h-9 rounded-xl text-xl leading-none",
                        "shadow-chunky-press transition-all",
                        glyph === g
                          ? "bg-grvd-purple/30 border border-grvd-purple/60"
                          : "bg-white/5 border border-white/10",
                      ].join(" ")}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>bpm <span className="opacity-40">(opt)</span></FieldLabel>
                <input
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                  placeholder="140"
                  inputMode="numeric"
                  disabled={phase !== "preview"}
                  className={fieldClass}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-3 py-2 font-mono text-[10px] text-red-400 text-center">
            {error}
          </div>
        )}
        {phase === "done" && (
          <div className="rounded-xl border border-grvd-lime/30 bg-grvd-lime/10 px-3 py-2 font-mono text-[11px] font-bold text-grvd-lime text-center">
            ✓ dropped — it's in your inventory now
          </div>
        )}

        {(phase === "preview" || phase === "submitting") && (
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="font-mono text-[10px] text-white/50">
              cost · {ENERGY_COST}⚡ · {liveEnergy < ENERGY_COST ? "low energy" : "ready"}
            </span>
            <ChunkyButton
              variant="hero"
              size="md"
              icon="🎛️"
              onClick={handlePublish}
              disabled={!canPublish || liveEnergy < ENERGY_COST}
            >
              {phase === "submitting" ? "publishing…" : `publish · ${ENERGY_COST}⚡`}
            </ChunkyButton>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiny shared bits                                                            */
/* -------------------------------------------------------------------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-white/55">
      {children}
    </div>
  );
}

const fieldClass = [
  "w-full mt-1.5 px-3 py-2 rounded-xl",
  "bg-white/5 border border-white/10",
  "font-mono text-[12px] text-white",
  "outline-none focus:border-grvd-purple/60 focus:bg-white/8",
  "transition-colors disabled:opacity-60",
].join(" ");
