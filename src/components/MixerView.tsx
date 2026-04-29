/**
 * MixerView — channel strips for all locked-in layers. Slice 1 redesign.
 *
 * Lives as its own dedicated post-Done page now (no more canvas window).
 * Every feature from the original preserved:
 *
 *   - Per-layer strip with kind label, sound name, colored indicator
 *   - FX buttons per kind (REV/DLY/DIST/LP/AT) — toggle with active glow
 *   - Vertical volume fader (pointer drag — drag up = louder)
 *   - dB readout (-∞ to +6dB scaled from 0..100)
 *   - Pan slider (-100..+100, L/C/R label)
 *   - AT (autotune) on vocal kind wires to engine.setVocalAutotuneEnabled
 *   - Empty state
 *
 * Visuals (new): chunky panel per strip + GRVD palette colors per kind +
 * glossy depth on faders. Mobile-first — strips remain horizontal scroll
 * (no clean way to stack channel strips vertically); each strip is wider
 * and tappier than before.
 */

import { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import { getSound } from "../data/sounds";
import { KIND_LABEL } from "../data/types";
import { setLayerVolume, setVocalAutotuneEnabled } from "../audio/engine";
import { ChunkyPill } from "../ui/Chunky";

/* -------------------------------------------------------------------------- */
/* Palette + FX maps                                                            */
/* -------------------------------------------------------------------------- */

const LAYER_COLORS: Record<string, string> = {
  drums:  "#a78bfa",
  kick:   "#a78bfa",
  snare:  "#ff4d9c",
  hat:    "#22d3ee",
  "808":  "#fb923c",
  sample: "#4ade80",
  melody: "#fbbf24",
  vocal:  "#ff4d9c",
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
/* Fader — vertical, drag-to-set                                                */
/* -------------------------------------------------------------------------- */

function Fader({
  value,
  onChange,
  color,
}: {
  value:    number; // 0–100
  onChange: (v: number) => void;
  color:    string;
}) {
  const FADER_H = 130;
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

  const knobPct = 100 - value;

  return (
    <div
      className="relative shrink-0 cursor-ns-resize"
      style={{ width: 28, height: FADER_H }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Track — chunky inset */}
      <div
        className="absolute"
        style={{
          left: "50%", top: 0, bottom: 0, width: 6,
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.50)",
          borderRadius: 3,
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.7), inset 0 -1px 0 rgba(255,255,255,0.06)",
        }}
      />
      {/* Fill — gradient + glow */}
      <div
        className="absolute"
        style={{
          left: "50%", bottom: 0, width: 6,
          transform: "translateX(-50%)",
          height: `${value}%`,
          background: `linear-gradient(to top, ${color}, ${color}88)`,
          borderRadius: 3,
          boxShadow: `0 0 8px ${color}66`,
          transition: "height 60ms",
        }}
      />
      {/* 0dB tick */}
      <div
        className="absolute"
        style={{
          left: "50%", top: "20%",
          transform: "translateX(-50%)",
          width: 14, height: 1.5,
          background: "rgba(255,255,255,0.18)",
        }}
      />
      {/* Knob — chunky candy */}
      <div
        className="absolute"
        style={{
          left: "50%", top: `${knobPct}%`,
          transform: "translate(-50%, -50%)",
          width: 26, height: 12,
          borderRadius: 6,
          background: "linear-gradient(180deg, #fff 0%, #c8c8d8 100%)",
          boxShadow: [
            "0 3px 0 0 rgba(0,0,0,0.45)",
            "0 5px 10px rgba(0,0,0,0.4)",
            "inset 0 1px 0 rgba(255,255,255,0.85)",
          ].join(", "),
          transition: "top 60ms",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main                                                                         */
/* -------------------------------------------------------------------------- */

export function MixerView() {
  const layers   = useStore((s) => s.layers);
  const setStage = useStore((s) => s.setStage);

  const [volumes, setVolumes] = useState<Record<string, number>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, 80])),
  );
  const [pans, setPans] = useState<Record<string, number>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, 0])),
  );
  const [activeFX, setActiveFX] = useState<Record<string, Set<FXName>>>(() =>
    Object.fromEntries(layers.map((l) => [l.id, new Set<FXName>()])),
  );

  function setVol(id: string, v: number) {
    setVolumes((vv) => ({ ...vv, [id]: v }));
    setLayerVolume(id, (v / 100) * 1.5);
  }
  function toggleFX(id: string, fx: FXName, layerKind: string) {
    setActiveFX((a) => {
      const cur = new Set(a[id] ?? []);
      const nowActive = !cur.has(fx);
      if (cur.has(fx)) cur.delete(fx);
      else             cur.add(fx);
      if (fx === "AT" && layerKind === "vocal") {
        setVocalAutotuneEnabled(nowActive);
      }
      return { ...a, [id]: cur };
    });
  }

  if (!layers.length) {
    return (
      <div className="pt-4 pb-8 flex flex-col items-center gap-6">
        <Header onBack={() => setStage(useStore.getState().editorReturnStage)} />
        <div className="mt-8 px-6 py-10 rounded-2xl bg-grvd-panel/60 border border-grvd-line text-center">
          <div className="text-4xl mb-2">🎛️</div>
          <div className="font-display text-lg text-white">no layers yet</div>
          <div className="font-sans text-grvd-purple/70 text-sm mt-1">
            cook a track first — channel strips appear once you have sounds.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-8 flex flex-col gap-3">
      <Header onBack={() => setStage(useStore.getState().editorReturnStage)} />

      <div className="px-1 font-sans text-[11px] text-grvd-purple/70 leading-snug">
        drag faders up / down. tap FX to toggle. swipe sideways for more strips.
      </div>

      {/* Channel strips — horizontal scroll */}
      <div className="-mx-3 overflow-x-auto pl-3 pr-3 pb-2">
        <div className="flex gap-3 items-stretch" style={{ minWidth: "max-content" }}>
          {layers.map((layer) => {
            const sound  = getSound(layer.soundId);
            const color  = LAYER_COLORS[layer.kind] ?? "#a78bfa";
            const vol    = volumes[layer.id]   ?? 80;
            const pan    = pans[layer.id]      ?? 0;
            const fxList = FX_PER_KIND[layer.kind] ?? [];
            const fx     = activeFX[layer.id]  ?? new Set();
            const dB     = vol === 0 ? "-∞" : `${Math.round((vol / 100) * 24 - 18)} dB`;

            return (
              <div
                key={layer.id}
                className="shrink-0 rounded-2xl border border-grvd-line shadow-chunky-press"
                style={{
                  width: 100,
                  background: "linear-gradient(180deg, rgba(21,16,42,0.95) 0%, rgba(10,8,20,0.95) 100%)",
                  padding: "12px 8px 14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {/* Kind label + sound name */}
                <div className="text-center w-full">
                  <div className="font-display text-white text-[11px] tracking-widest uppercase leading-none">
                    {KIND_LABEL[layer.kind]}
                  </div>
                  <div className="font-sans text-white/55 text-[10px] truncate mt-1 px-1">
                    {sound?.name ?? "—"}
                  </div>
                </div>

                {/* Colored indicator pill */}
                <div
                  className="rounded-full"
                  style={{
                    width: "75%", height: 4,
                    background: color,
                    boxShadow: `0 0 8px ${color}cc`,
                  }}
                />

                {/* FX buttons */}
                <div className="flex flex-wrap gap-1 justify-center w-full" style={{ minHeight: 22 }}>
                  {fxList.map((f) => {
                    const on = fx.has(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFX(layer.id, f, layer.kind)}
                        title={FX_LABELS[f]}
                        className="active:translate-y-[1px] transition-transform"
                        style={{
                          padding: "3px 7px",
                          borderRadius: 8,
                          fontSize: 9,
                          fontFamily: '"Lilita One", system-ui, sans-serif',
                          letterSpacing: "0.04em",
                          background: on
                            ? `linear-gradient(180deg, ${color}, ${color}aa)`
                            : "rgba(255,255,255,0.06)",
                          border: `1px solid ${on ? color : "rgba(255,255,255,0.10)"}`,
                          color: on ? "#fff" : "rgba(255,255,255,0.45)",
                          boxShadow: on
                            ? `0 2px 0 0 rgba(0,0,0,0.35), 0 0 10px ${color}88, inset 0 1px 0 rgba(255,255,255,0.30)`
                            : "0 2px 0 0 rgba(0,0,0,0.25)",
                        }}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>

                {/* Fader */}
                <Fader
                  value={vol}
                  color={color}
                  onChange={(v) => setVol(layer.id, v)}
                />

                {/* dB readout */}
                <div className="font-mono text-grvd-purple/70 text-[10px] tabular-nums">
                  {dB}
                </div>

                {/* Pan */}
                <div className="w-full flex flex-col items-center gap-1">
                  <span className="font-display text-white/45 text-[8px] tracking-widest uppercase">
                    pan
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
                      width: "92%",
                      accentColor: color,
                      height: 4,
                      cursor: "pointer",
                    }}
                  />
                  <span className="font-mono text-white/45 text-[9px] tabular-nums">
                    {pan === 0 ? "C" : pan < 0 ? `L${Math.abs(pan)}` : `R${pan}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                       */
/* -------------------------------------------------------------------------- */

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center justify-between px-1">
      <ChunkyPill onClick={onBack} icon="←" size="sm">
        back
      </ChunkyPill>
      <span className="font-display text-grvd-purple text-[11px] tracking-widest uppercase">
        🎛️ mixer
      </span>
      <span className="w-12" />
    </div>
  );
}
