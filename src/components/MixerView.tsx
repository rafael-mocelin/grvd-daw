/**
 * MixerView — channel strips for all locked-in layers.
 *
 * Each strip has:
 *   - Layer name + glyph
 *   - FX toggle buttons (depends on kind)
 *   - Vertical volume fader (pointer drag)
 *   - dB readout
 *   - Pan slider
 *   - Mute button
 *
 * A Master channel strip lives at the right with a fixed green fader.
 */

import { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { getSound } from "../data/sounds";
import { KIND_LABEL } from "../data/types";
import { setLayerVolume } from "../audio/engine";

/* -------------------------------------------------------------------------- */
/* Data                                                                         */
/* -------------------------------------------------------------------------- */

const LAYER_COLORS: Record<string, string> = {
  drums:  "#4f46e5",
  kick:   "#4f46e5",
  snare:  "#7c3aed",
  hat:    "#6d28d9",
  "808":  "#db2777",
  sample: "#0891b2",
  melody: "#059669",
  vocal:  "#d97706",
};

type FXName = "REV" | "DLY" | "DIST" | "LP" | "AT";

const FX_PER_KIND: Record<string, FXName[]> = {
  drums:  ["REV", "DIST"],
  kick:   ["REV", "DIST"],
  snare:  ["REV", "DLY"],
  hat:    ["DLY"],
  "808":  ["REV", "LP"],
  sample: ["REV", "DLY"],
  melody: ["REV", "DLY"],
  vocal:  ["AT", "REV", "DLY"],
};

const FX_LABELS: Record<FXName, string> = {
  REV: "reverb",
  DLY: "delay",
  DIST: "distortion",
  LP: "lowpass",
  AT: "autotune",
};

/* -------------------------------------------------------------------------- */
/* Sub: one vertical fader ── drag up = louder, down = quieter                  */
/* -------------------------------------------------------------------------- */

function Fader({
  value,
  onChange,
  color,
  muted,
}: {
  value: number; // 0–100
  onChange: (v: number) => void;
  color: string;
  muted: boolean;
}) {
  const FADER_H = 110;
  const dragRef = useRef<{ startY: number; startVal: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startY: e.clientY, startVal: value };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dy = dragRef.current.startY - e.clientY;
    const newVal = Math.max(0, Math.min(100, dragRef.current.startVal + dy * 0.8));
    onChange(newVal);
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  const knobPct = 100 - value; // 0% = top (loudest), 100% = bottom (silent)
  const fillH = `${value}%`;

  return (
    <div
      style={{
        position: "relative",
        width: 22,
        height: FADER_H,
        cursor: "ns-resize",
        flexShrink: 0,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Track */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 4,
          transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.07)",
          borderRadius: 2,
        }}
      />
      {/* Fill */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          width: 4,
          transform: "translateX(-50%)",
          height: fillH,
          background: muted
            ? "rgba(255,255,255,0.1)"
            : `linear-gradient(to top, ${color}, ${color}66)`,
          borderRadius: 2,
          boxShadow: muted ? "none" : `0 0 6px ${color}44`,
          transition: "height 0.04s",
        }}
      />
      {/* 0dB tick mark */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "20%",
          transform: "translateX(-50%)",
          width: 12,
          height: 1,
          background: "rgba(255,255,255,0.12)",
        }}
      />
      {/* Knob */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: `${knobPct}%`,
          transform: "translate(-50%, -50%)",
          width: 18,
          height: 7,
          borderRadius: 3,
          background: muted
            ? "rgba(255,255,255,0.2)"
            : "rgba(255,255,255,0.92)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.75)",
          transition: "top 0.04s",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                         */
/* -------------------------------------------------------------------------- */

export function MixerView() {
  const { layers } = useStore();

  const [volumes, setVolumes] = useState<Record<string, number>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, 80]))
  );
  const [pans, setPans] = useState<Record<string, number>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, 0]))
  );
  const [activeFX, setActiveFX] = useState<Record<string, Set<FXName>>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, new Set<FXName>()]))
  );
  function setVol(id: string, v: number) {
    setVolumes((vv) => ({ ...vv, [id]: v }));
    setLayerVolume(id, (v / 100) * 1.5);
  }
  function toggleFX(id: string, fx: FXName) {
    setActiveFX((a) => {
      const cur = new Set(a[id] ?? []);
      cur.has(fx) ? cur.delete(fx) : cur.add(fx);
      return { ...a, [id]: cur };
    });
  }
  if (!layers.length) {
    return (
      <div
        style={{
          padding: 32,
          color: "rgba(255,255,255,0.18)",
          fontFamily: "monospace",
          fontSize: 10,
          textAlign: "center",
          lineHeight: 1.8,
        }}
      >
        lock in a sound<br />
        <span style={{ opacity: 0.5 }}>its channel strip appears here</span>
      </div>
    );
  }

  const STRIP_W = 76;

  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        padding: "14px 16px 16px",
        overflowX: "auto",
        height: "100%",
        alignItems: "stretch",
      }}
    >
      {layers.map((layer) => {
        const sound = getSound(layer.soundId);
        const color = LAYER_COLORS[layer.kind] ?? "#7c3aed";
        const vol = volumes[layer.id] ?? 80;
        const pan = pans[layer.id] ?? 0;
        const fxList = FX_PER_KIND[layer.kind] ?? [];
        const fx = activeFX[layer.id] ?? new Set();

        return (
          <div
            key={layer.id}
            style={{
              width: STRIP_W,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: "10px 4px 10px",
              background: "rgba(255,255,255,0.025)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Track name */}
            <div style={{ textAlign: "center", width: "100%" }}>
              <div
                style={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  fontWeight: 800,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {KIND_LABEL[layer.kind]}
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: "rgba(255,255,255,0.2)",
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: "100%",
                  padding: "0 4px",
                }}
              >
                {sound?.name}
              </div>
            </div>

            {/* Colored indicator bar */}
            <div
              style={{
                width: "80%",
                height: 2,
                borderRadius: 1,
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />

            {/* FX buttons */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                justifyContent: "center",
                width: "100%",
                minHeight: 20,
              }}
            >
              {fxList.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFX(layer.id, f)}
                  title={FX_LABELS[f]}
                  style={{
                    padding: "2px 5px",
                    borderRadius: 4,
                    fontSize: 7,
                    fontFamily: "monospace",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    cursor: "pointer",
                    background: fx.has(f) ? color : "rgba(255,255,255,0.07)",
                    border: `1px solid ${fx.has(f) ? color : "rgba(255,255,255,0.1)"}`,
                    color: fx.has(f) ? "#fff" : "rgba(255,255,255,0.35)",
                    transition: "all 0.12s",
                    boxShadow: fx.has(f) ? `0 0 8px ${color}55` : "none",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Fader */}
            <Fader
              value={vol}
              onChange={(v) => setVol(layer.id, v)}
              color={color}
              muted={false}
            />

            {/* dB readout */}
            <div
              style={{
                fontSize: 8,
                fontFamily: "monospace",
                color: "rgba(255,255,255,0.25)",
              }}
            >
              {vol === 0 ? "-∞" : `${Math.round((vol / 100) * 6 - 18)} dB`}
            </div>

            {/* Pan */}
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: 7,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                PAN
              </span>
              <input
                type="range"
                min={-100}
                max={100}
                value={pan}
                onChange={(e) =>
                  setPans((p) => ({ ...p, [layer.id]: +e.target.value }))
                }
                style={{
                  width: "88%",
                  accentColor: color,
                  height: 2,
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 7,
                  fontFamily: "monospace",
                  color: "rgba(255,255,255,0.2)",
                }}
              >
                {pan === 0 ? "C" : pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`}
              </span>
            </div>

          </div>
        );
      })}

    </div>
  );
}
