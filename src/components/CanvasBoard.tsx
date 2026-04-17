/**
 * CanvasBoard — infinite canvas with a horizontal timeline layout.
 *
 * Three windows arranged left-to-right like a production pipeline:
 *
 *   [ RECIPE ] ──wire──> [ ARRANGE ] ──wire──> [ MIXER ]
 *
 * The canvas starts zoomed out so you see the whole picture at once.
 * Zoom in (Ctrl+scroll or +/− buttons) to work in a specific window.
 * Drag empty canvas to pan.
 *
 * When audio is playing, the wires animate (dashes flow left → right).
 *
 * Rendered via createPortal so position:fixed is relative to the true
 * viewport, not any CSS-transformed ancestor.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal, flushSync } from "react-dom";
import { useStore } from "../store/useStore";
import { SHELL } from "../shell/skins";
import { CanvasWindow, type WinState } from "./CanvasWindow";
import { StackingView } from "./StackingView";
import { ArrangeView } from "./ArrangeView";
import { MixerView } from "./MixerView";
import { VocalRecorder } from "./VocalRecorder";
import { NameAndSave } from "./NameAndSave";

/* -------------------------------------------------------------------------- */
/* Constants                                                                    */
/* -------------------------------------------------------------------------- */

const CANVAS_W = 2800;
const CANVAS_H = 1000;

/** Timeline layout — Recipe → Arrange → Mixer, horizontally. */
const INITIAL_LAYOUTS = {
  recipe:  { x: 60,   y: 80, w: 400, h: 560 },
  arrange: { x: 560,  y: 80, w: 560, h: 560 },
  mixer:   { x: 1240, y: 80, w: 440, h: 560 },
} as const satisfies Record<WinName, WinState>;

type WinName = "recipe" | "arrange" | "mixer";

/** Compute initial zoom so all 3 windows fit comfortably in the viewport. */
function calcFitZoom(): number {
  const vw = window.innerWidth  - SHELL.LEFT - SHELL.RIGHT;
  const vh = window.innerHeight - SHELL.TOP  - SHELL.BOTTOM;
  // Content bounding box: x=60→1680, y=80→640
  const contentW = 1680 + 80;   // rightmost edge + padding
  const contentH = 640  + 120;  // bottom edge + padding
  const zx = vw / contentW;
  const zy = vh / contentH;
  // Aim for 85% of fit so there's breathing room around the edges
  return Math.min(Math.max(0.22, Math.min(zx, zy) * 0.85), 1.5);
}

/* -------------------------------------------------------------------------- */
/* SVG wire connector                                                            */
/* -------------------------------------------------------------------------- */

interface WireProps {
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  playing: boolean;
  delay?: string;
}

function Wire({ x1, y1, x2, y2, color, playing, delay = "0s" }: WireProps) {
  const gap = x2 - x1;
  const d = `M ${x1} ${y1} C ${x1 + gap * 0.5} ${y1}, ${x2 - gap * 0.5} ${y2}, ${x2} ${y2}`;
  const DASH = 14;
  const GAP  = 8;

  return (
    <g>
      {/* Static base wire */}
      <path d={d} fill="none" stroke={`${color}28`} strokeWidth={2} />
      {/* Glowing track when playing */}
      {playing && (
        <path d={d} fill="none" stroke={`${color}55`} strokeWidth={4}
          style={{ filter: `blur(3px)` }} />
      )}
      {/* Animated dash */}
      <path
        d={d}
        fill="none"
        stroke={playing ? color : `${color}40`}
        strokeWidth={playing ? 2.5 : 1.5}
        strokeDasharray={`${DASH} ${GAP}`}
        style={playing ? {
          animation: `canvasDashFlow 0.45s linear infinite`,
          animationDelay: delay,
        } : undefined}
      />
      {/* Endpoint dots */}
      <circle cx={x1} cy={y1} r={4.5} fill={playing ? color : `${color}55`}
        style={{ transition: "fill 0.4s" }} />
      <circle cx={x2} cy={y2} r={4.5} fill={playing ? color : `${color}55`}
        style={{ transition: "fill 0.4s" }} />
    </g>
  );
}

/* -------------------------------------------------------------------------- */
/* CanvasBoard                                                                   */
/* -------------------------------------------------------------------------- */

export function CanvasBoard() {
  const { stage, isPlaying, canvasZoom: storeZoom, setCanvasZoom } = useStore();

  const scrollRef  = useRef<HTMLDivElement>(null);
  const panStart   = useRef<{ sX: number; sY: number; mX: number; mY: number } | null>(null);

  const [layouts, setLayouts] = useState<Record<WinName, WinState>>(
    () => ({ ...INITIAL_LAYOUTS })
  );
  const [zOrder, setZOrder] = useState<WinName[]>(["recipe", "arrange", "mixer"]);

  // Initialize store zoom on first mount
  useEffect(() => {
    if (storeZoom === 0) setCanvasZoom(calcFitZoom());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zoom = storeZoom || calcFitZoom();

  /* ── z-ordering ── */
  const bringToFront = useCallback((name: WinName) => {
    setZOrder((z) => [...z.filter((n) => n !== name), name]);
  }, []);

  const zFor = (name: WinName) => zOrder.indexOf(name) + 2;

  const setWin = useCallback((name: WinName, s: WinState) => {
    setLayouts((l) => ({ ...l, [name]: s }));
  }, []);

  /* ── Scroll-wheel → zoom at cursor (Miro / Figma style) ── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const currentZoom = storeZoom || calcFitZoom();
      const dir  = e.deltaY > 0 ? -1 : 1;
      const step = e.deltaMode === 0
        ? Math.min(Math.abs(e.deltaY) * 0.003, 0.12)
        : 0.10;
      const newZoom = Math.min(2.0, Math.max(0.18, currentZoom + dir * step));
      if (newZoom === currentZoom) return;

      // Mouse position relative to the scroll container's top-left
      const rect   = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Canvas-space coordinate under the cursor (invariant point)
      const canvasX = (el.scrollLeft + mouseX) / currentZoom;
      const canvasY = (el.scrollTop  + mouseY) / currentZoom;

      // Apply zoom synchronously so the DOM resizes before we adjust scroll
      flushSync(() => setCanvasZoom(newZoom));

      // Scroll so the same canvas point stays under the cursor
      el.scrollLeft = canvasX * newZoom - mouseX;
      el.scrollTop  = canvasY * newZoom - mouseY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeZoom]);

  /* ── Fit all windows into viewport ── */
  const fitToWindows = useCallback(() => {
    const PAD  = 60; // canvas-px padding around the bounding box
    const vals = Object.values(layouts);
    const minX = Math.min(...vals.map(l => l.x))       - PAD;
    const minY = Math.min(...vals.map(l => l.y))       - PAD;
    const maxX = Math.max(...vals.map(l => l.x + l.w)) + PAD;
    const maxY = Math.max(...vals.map(l => l.y + l.h)) + PAD;

    const cw = maxX - minX;
    const ch = maxY - minY;
    const vw = window.innerWidth  - SHELL.LEFT - SHELL.RIGHT;
    const vh = window.innerHeight - SHELL.TOP  - SHELL.BOTTOM;

    const newZoom = Math.min(Math.max(0.18, Math.min(vw / cw, vh / ch)), 2.0);

    // flushSync forces the zoom state update to render synchronously so we
    // can immediately set scroll position against the updated DOM.
    flushSync(() => setCanvasZoom(newZoom));

    if (scrollRef.current) {
      // Center the bounding box in the viewport
      scrollRef.current.scrollLeft = Math.max(0, minX * newZoom - (vw - cw * newZoom) / 2);
      scrollRef.current.scrollTop  = Math.max(0, minY * newZoom - (vh - ch * newZoom) / 2);
    }
  }, [layouts, setCanvasZoom]);

  /* ── Background pan ── */
  function onBgPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement) !== e.currentTarget) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    panStart.current = {
      sX: scrollRef.current?.scrollLeft ?? 0,
      sY: scrollRef.current?.scrollTop  ?? 0,
      mX: e.clientX,
      mY: e.clientY,
    };
  }
  function onBgPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panStart.current || !scrollRef.current) return;
    scrollRef.current.scrollLeft = panStart.current.sX - (e.clientX - panStart.current.mX);
    scrollRef.current.scrollTop  = panStart.current.sY - (e.clientY - panStart.current.mY);
  }
  function onBgPointerUp() { panStart.current = null; }

  /* ── Stage-aware recipe window ── */
  let recipeContent: React.ReactNode = null;
  if      (stage === "stack") recipeContent = <StackingView />;
  else if (stage === "vocal") recipeContent = <VocalRecorder />;
  else if (stage === "name")  recipeContent = <NameAndSave />;

  const recipeTitle =
    stage === "name"  ? "name your track" :
    stage === "vocal" ? "record hook"     : "recipe";

  /* ── Wire connection points (dynamic — follow window positions) ── */
  const r = layouts.recipe;
  const a = layouts.arrange;
  const m = layouts.mixer;

  const wire1 = { x1: r.x + r.w, y1: r.y + r.h / 2, x2: a.x,       y2: a.y + a.h / 2 };
  const wire2 = { x1: a.x + a.w, y1: a.y + a.h / 2, x2: m.x,       y2: m.y + m.h / 2 };

  /* ── Window titles with step numbers ── */
  const WIN_COLOR = { recipe: "#7c3aed", arrange: "#4f46e5", mixer: "#db2777" };

  return createPortal(
    <>
      {/* ── Keyframe injection ── */}
      <style>{`
        @keyframes canvasDashFlow {
          from { stroke-dashoffset: 22; }
          to   { stroke-dashoffset: 0;  }
        }
      `}</style>

      {/* ── Scroll container (= the "screen" inside the shell) ── */}
      <div
        ref={scrollRef}
        style={{
          position:     "fixed",
          top:          SHELL.TOP,
          bottom:       SHELL.BOTTOM,
          left:         SHELL.LEFT,
          right:        SHELL.RIGHT,
          overflow:     "auto",
          scrollbarWidth: "none",
          zIndex:       5,
          borderRadius: SHELL.SCREEN_RADIUS,
        }}
      >
        {/*
          Spacer: the scroll range must match the VISUAL size of the canvas.
          With transform:scale(zoom) on the canvas div, the DOM size stays
          CANVAS_W × CANVAS_H but the visual size is CANVAS_W*zoom × CANVAS_H*zoom.
          The spacer carries the visual size so scrollbars/momentum work correctly.
        */}
        <div style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom, position: "relative", flexShrink: 0 }}>
          {/* The canvas surface — scaled, positioned absolutely inside the spacer */}
          <div
            onPointerDown={onBgPointerDown}
            onPointerMove={onBgPointerMove}
            onPointerUp={onBgPointerUp}
            style={{
              position:        "absolute",
              top:             0,
              left:            0,
              width:           CANVAS_W,
              height:          CANVAS_H,
              transform:       `scale(${zoom})`,
              transformOrigin: "top left",
              cursor:          "grab",
            }}
          >
            {/* ── Subtle canvas grid ── */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)," +
                "linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
            }} />

            {/* ── Timeline step labels ── */}
            {(["recipe", "arrange", "mixer"] as WinName[]).map((name, i) => {
              const l = layouts[name];
              const labels = ["01 · build", "02 · arrange", "03 · mix"];
              const color  = WIN_COLOR[name];
              return (
                <div key={name} style={{
                  position:   "absolute",
                  left:       l.x,
                  top:        l.y - 36,
                  display:    "flex",
                  alignItems: "center",
                  gap:        8,
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: `${color}22`,
                    border:     `1px solid ${color}66`,
                    display:    "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "monospace", fontSize: 9, fontWeight: 700, color,
                  }}>{i + 1}</div>
                  <span style={{
                    fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.15em", textTransform: "uppercase", color: `${color}bb`,
                  }}>{labels[i]}</span>
                </div>
              );
            })}

            {/* ── SVG wires — drawn beneath the windows ── */}
            <svg style={{
              position: "absolute", top: 0, left: 0,
              width: CANVAS_W, height: CANVAS_H,
              pointerEvents: "none", zIndex: 1, overflow: "visible",
            }}>
              <Wire {...wire1} color="#7c3aed" playing={isPlaying} delay="0s"    />
              <Wire {...wire2} color="#4f46e5" playing={isPlaying} delay="0.18s" />
            </svg>

            {/* ── Recipe / stack / vocal / name ── */}
            <CanvasWindow
              title={recipeTitle} icon="🎛️"
              state={layouts.recipe}
              onChange={(s) => setWin("recipe", s)}
              scrollRef={scrollRef} zoom={zoom}
              color={WIN_COLOR.recipe}
              zIndex={zFor("recipe")} onFocus={() => bringToFront("recipe")}
              minW={340} minH={400}
            >
              {recipeContent}
            </CanvasWindow>

            {/* ── Arrange ── */}
            <CanvasWindow
              title="arrange" icon="🎼"
              state={layouts.arrange}
              onChange={(s) => setWin("arrange", s)}
              scrollRef={scrollRef} zoom={zoom}
              color={WIN_COLOR.arrange}
              zIndex={zFor("arrange")} onFocus={() => bringToFront("arrange")}
              minW={420} minH={160}
            >
              <ArrangeView />
            </CanvasWindow>

            {/* ── Mixer ── */}
            <CanvasWindow
              title="mixer" icon="🎚️"
              state={layouts.mixer}
              onChange={(s) => setWin("mixer", s)}
              scrollRef={scrollRef} zoom={zoom}
              color={WIN_COLOR.mixer}
              zIndex={zFor("mixer")} onFocus={() => bringToFront("mixer")}
              minW={320} minH={260}
            >
              <MixerView />
            </CanvasWindow>
          </div>
        </div>
      </div>

      {/* ── Zoom HUD (bottom-right corner inside screen area) ── */}
      <div style={{
        position:   "fixed",
        bottom:     SHELL.BOTTOM + 10,
        right:      SHELL.RIGHT  + 10,
        zIndex:     20,
        display:    "flex",
        alignItems: "center",
        gap:        4,
        background: "rgba(0,0,0,0.55)",
        border:     "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding:    "3px 8px",
        userSelect: "none",
      }}>
        <button onClick={() => setCanvasZoom(Math.max(0.18, +(zoom - 0.1).toFixed(2)))}
          style={zoomBtnStyle}>−</button>
        <span style={{ fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.35)", minWidth: 32, textAlign: "center" }}>
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={() => setCanvasZoom(Math.min(2.0, +(zoom + 0.1).toFixed(2)))}
          style={zoomBtnStyle}>+</button>
        <button
          onClick={fitToWindows}
          title="fit all windows in view"
          style={{ ...zoomBtnStyle, fontSize: 8, padding: "0 4px", marginLeft: 2 }}
        >fit</button>
      </div>
    </>,
    document.body
  );
}

const zoomBtnStyle: React.CSSProperties = {
  width: 20, height: 20, borderRadius: 4,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.45)",
  fontSize: 12, fontFamily: "monospace", fontWeight: 700,
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0,
};
