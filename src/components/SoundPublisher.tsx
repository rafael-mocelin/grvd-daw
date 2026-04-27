/**
 * SoundPublisher — Phase 5.B step 4 modal.
 *
 * Producer publish-sound flow:
 *   1. Record a short clip (≤ MAX_CLIP_SECONDS) using the same audio engine
 *      path as VocalRecorder. Mono mic → MediaRecorder → AudioBuffer.
 *   2. Tag it: kind, display name, optional variant, optional BPM/key.
 *   3. Tap "publish sound" — the store handles upload + RPC and commits
 *      authoritative server numbers (energy/xp/level) on success.
 *
 * Lives in Studio (MINE tab) as a header CTA. Renders as a modal overlay
 * positioned inside the device shell — no portals — so layering matches
 * EndorseSheet / TemplatePicker conventions.
 */

import { useEffect, useRef, useState } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { recordVocal } from "../audio/engine";
import type { LayerKind } from "../data/types";
import { KIND_LABEL } from "../data/types";
import { KIND_ICON } from "../lib/sounds-db";

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
  // The display value reads through the same regen-aware helper as
  // EnergyMeter / Done / Logbook. Server authoritatively re-checks at RPC
  // time, so an off-by-one here only matters for UX.
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
  const [bpm,         setBpm]         = useState<string>(""); // string in input, parsed on submit

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Latest preview URL, mirrored in a ref so the unmount cleanup sees the
  // current value (the cleanup useEffect can't depend on previewUrl without
  // re-firing on every record cycle, which is the wrong shape).
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  // When kind changes, snap glyph to the first suggestion for that kind
  // unless the user has already picked something custom.
  useEffect(() => {
    setGlyph(GLYPH_SUGGESTIONS[kind][0]);
  }, [kind]);

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
      // Auto-close shortly so the player sees a confirmation flash.
      setTimeout(() => onClose(), 1100);
    } else {
      setError(result?.message ?? "publish failed");
      setPhase("preview");
    }
  }

  const canPublish = phase === "preview" && !!blob && displayName.trim().length > 0 && !publishingSound;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && phase !== "submitting") onClose(); }}
      style={{
        position:       "absolute",
        inset:          0,
        background:     "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)",
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "center",
        padding:        "30px 14px",
        zIndex:         70,
      }}
    >
      <div
        style={{
          width:          "100%",
          maxWidth:       420,
          background:     "linear-gradient(180deg, rgba(20,18,40,0.98), rgba(10,10,18,0.98))",
          border:         "1px solid rgba(167,139,250,0.35)",
          borderRadius:   16,
          padding:        "16px 16px 18px",
          display:        "flex",
          flexDirection:  "column",
          gap:            12,
          boxShadow:      "0 12px 40px rgba(0,0,0,0.5), 0 0 30px rgba(167,139,250,0.15)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div>
            <div style={{
              fontFamily: "monospace", fontSize: 9, fontWeight: 800,
              letterSpacing: "0.2em", textTransform: "uppercase", color: "#a78bfa",
            }}>
              🎛️ publish a sound
            </div>
            <div style={{
              fontFamily: "'Space Grotesk', system-ui, sans-serif",
              fontSize: 17, fontWeight: 800, color: "#fff", marginTop: 2,
            }}>
              drop something other producers can claim
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={phase === "submitting"}
            style={{
              background: "rgba(255,255,255,0.06)",
              border:     "1px solid rgba(255,255,255,0.12)",
              color:      "rgba(255,255,255,0.7)",
              fontFamily: "monospace", fontSize: 11,
              padding:    "5px 10px", borderRadius: 8,
              cursor:     phase === "submitting" ? "default" : "pointer",
              opacity:    phase === "submitting" ? 0.5 : 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Recorder zone */}
        <div style={{
          background:   "rgba(0,0,0,0.4)",
          border:       "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12, padding: "14px 12px",
          display:      "flex", flexDirection: "column", gap: 10, alignItems: "center",
        }}>
          {phase === "ready" && (
            <>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" }}>
                tap the button to record up to {MAX_CLIP_SECONDS}s
              </div>
              <button onClick={handleRecord} style={primaryBtn}>🎤 start recording</button>
            </>
          )}
          {phase === "recording" && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%", background: "#f87171",
                  boxShadow: "0 0 8px #f87171",
                  animation: "recPulse 0.8s ease-in-out infinite alternate",
                }} />
                <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#f87171" }}>
                  recording — {(MAX_CLIP_SECONDS - elapsed).toFixed(1)}s left
                </span>
              </div>
              <div style={{ width: "100%", height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  width: `${Math.min(elapsed / MAX_CLIP_SECONDS, 1) * 100}%`,
                  background: "linear-gradient(90deg, #7c3aed, #f87171)",
                  transition: "width 0.05s linear",
                }} />
              </div>
              <style>{`@keyframes recPulse { from{opacity:1;transform:scale(1)} to{opacity:0.5;transform:scale(0.85)} }`}</style>
            </>
          )}
          {(phase === "preview" || phase === "submitting" || phase === "done") && previewUrl && (
            <>
              <audio controls src={previewUrl} style={{ width: "100%" }} />
              {phase !== "done" && phase !== "submitting" && (
                <button onClick={handleRecord} style={ghostBtn}>🔁 redo</button>
              )}
            </>
          )}
        </div>

        {/* Form */}
        {(phase === "preview" || phase === "submitting" || phase === "done") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Kind selector */}
            <div>
              <FieldLabel>kind</FieldLabel>
              <div style={{
                display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4,
              }}>
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k}
                    onClick={() => setKind(k)}
                    disabled={phase !== "preview"}
                    style={{
                      fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                      padding: "5px 9px", borderRadius: 14,
                      background: kind === k ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
                      border:     `1px solid ${kind === k ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.1)"}`,
                      color:      kind === k ? "#fff" : "rgba(255,255,255,0.55)",
                      cursor:     phase === "preview" ? "pointer" : "default",
                      display:    "inline-flex", alignItems: "center", gap: 4,
                    }}
                  >
                    <span>{KIND_ICON[k]}</span>
                    <span>{KIND_LABEL[k]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + variant */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <FieldLabel>display name</FieldLabel>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
                  placeholder="e.g. nightcore boom"
                  disabled={phase !== "preview"}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>variant <span style={{ opacity: 0.4 }}>(opt)</span></FieldLabel>
                <input
                  value={variant}
                  onChange={(e) => setVariant(e.target.value.slice(0, 30))}
                  placeholder="trap"
                  disabled={phase !== "preview"}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Glyph + BPM */}
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 2 }}>
                <FieldLabel>glyph</FieldLabel>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {GLYPH_SUGGESTIONS[kind].map((g) => (
                    <button
                      key={g}
                      onClick={() => setGlyph(g)}
                      disabled={phase !== "preview"}
                      style={{
                        fontSize: 18, lineHeight: 1,
                        width: 32, height: 32, borderRadius: 8,
                        background: glyph === g ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)",
                        border:     `1px solid ${glyph === g ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.08)"}`,
                        cursor:     phase === "preview" ? "pointer" : "default",
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>bpm <span style={{ opacity: 0.4 }}>(opt)</span></FieldLabel>
                <input
                  value={bpm}
                  onChange={(e) => setBpm(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                  placeholder="140"
                  inputMode="numeric"
                  disabled={phase !== "preview"}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error / success line */}
        {error && (
          <div style={{
            fontFamily: "monospace", fontSize: 10, color: "#f87171",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "6px 10px", textAlign: "center",
          }}>
            {error}
          </div>
        )}
        {phase === "done" && (
          <div style={{
            fontFamily: "monospace", fontSize: 11, fontWeight: 800, color: "#4ade80",
            background: "rgba(74,222,128,0.1)",
            border: "1px solid rgba(74,222,128,0.25)",
            borderRadius: 8, padding: "8px 10px", textAlign: "center",
          }}>
            ✓ dropped — it's in your inventory now
          </div>
        )}

        {/* Footer / actions */}
        {(phase === "preview" || phase === "submitting") && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.45)" }}>
              cost · {ENERGY_COST}⚡ · {liveEnergy < ENERGY_COST ? "low energy" : "ready"}
            </span>
            <button
              onClick={handlePublish}
              disabled={!canPublish || liveEnergy < ENERGY_COST}
              style={{
                ...primaryBtn,
                opacity: !canPublish || liveEnergy < ENERGY_COST ? 0.5 : 1,
                cursor:  !canPublish || liveEnergy < ENERGY_COST ? "default" : "pointer",
              }}
            >
              {phase === "submitting" ? "publishing…" : `🎛️ publish · ${ENERGY_COST}⚡`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tiny shared bits                                                            */
/* -------------------------------------------------------------------------- */

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "monospace", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.14em", textTransform: "uppercase",
      color: "rgba(255,255,255,0.5)",
    }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width:        "100%",
  boxSizing:    "border-box",
  background:   "rgba(255,255,255,0.05)",
  border:       "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  padding:      "7px 10px",
  marginTop:    4,
  fontFamily:   "monospace",
  fontSize:     12,
  color:        "#fff",
  outline:      "none",
};

const primaryBtn: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  padding:        "8px 18px",
  borderRadius:   18,
  background:     "rgba(124,58,237,0.85)",
  border:         "1px solid rgba(167,139,250,0.4)",
  color:          "#fff",
  fontFamily:     "monospace",
  fontSize:       12,
  fontWeight:     900,
  cursor:         "pointer",
  transition:     "all 0.12s",
  boxShadow:      "0 0 16px rgba(124,58,237,0.35)",
};

const ghostBtn: React.CSSProperties = {
  display:        "inline-flex",
  alignItems:     "center",
  justifyContent: "center",
  padding:        "5px 12px",
  borderRadius:   16,
  background:     "rgba(255,255,255,0.05)",
  border:         "1px solid rgba(255,255,255,0.1)",
  color:          "rgba(255,255,255,0.6)",
  fontFamily:     "monospace",
  fontSize:       10,
  fontWeight:     700,
  cursor:         "pointer",
};
