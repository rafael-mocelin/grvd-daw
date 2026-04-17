/**
 * CanvasWindow — a floating, draggable, resizable window for the infinite canvas.
 *
 * Sits inside the canvas surface div (position: absolute).
 * Drag title bar to move. Drag SE corner / edges to resize.
 * Click the — button to collapse to title-bar only.
 *
 * `zoom` must match the canvas surface's CSS scale so that drag/resize deltas
 * convert correctly from screen pixels → canvas pixels (delta / zoom).
 */

import { useState, useRef, type ReactNode, type RefObject } from "react";

export interface WinState {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  title: string;
  icon?: string;
  children: ReactNode;
  state: WinState;
  onChange: (s: WinState) => void;
  /** Pass the canvas scroll container ref (kept for API compat, no longer used for drag math) */
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Current canvas zoom (CSS scale factor). Default 1. */
  zoom?: number;
  minW?: number;
  minH?: number;
  color?: string;
  /** z-index; bump when clicked to bring forward */
  zIndex?: number;
  onFocus?: () => void;
}

export function CanvasWindow({
  title,
  icon,
  children,
  state,
  onChange,
  zoom = 1,
  minW = 300,
  minH = 140,
  color = "#7c3aed",
  zIndex = 1,
  onFocus,
}: Props) {
  const [minimized, setMinimized] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ── drag title bar ── */
  function onTitlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    onFocus?.();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    // Record mouse start in screen-pixel space
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const origX = stateRef.current.x;
    const origY = stateRef.current.y;

    const onMove = (ev: PointerEvent) => {
      // Divide screen-pixel delta by zoom to get canvas-pixel delta
      onChange({
        ...stateRef.current,
        x: origX + (ev.clientX - startMouseX) / zoom,
        y: origY + (ev.clientY - startMouseY) / zoom,
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /* ── resize edges / corners ── */
  function onResizePointerDown(e: React.PointerEvent, dir: string) {
    e.preventDefault();
    e.stopPropagation();
    onFocus?.();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startPX = e.clientX;
    const startPY = e.clientY;
    const orig = { ...stateRef.current };

    const onMove = (ev: PointerEvent) => {
      // Divide by zoom: screen px → canvas px
      const dx = (ev.clientX - startPX) / zoom;
      const dy = (ev.clientY - startPY) / zoom;
      let { x, y, w, h } = orig;
      if (dir.includes("e")) w = Math.max(minW, orig.w + dx);
      if (dir.includes("s")) h = Math.max(minH, orig.h + dy);
      if (dir.includes("w")) { x = orig.x + dx; w = Math.max(minW, orig.w - dx); }
      if (dir.includes("n")) { y = orig.y + dy; h = Math.max(minH, orig.h - dy); }
      onChange({ x, y, w, h });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const TITLE_H = 38;

  return (
    <div
      onPointerDown={onFocus}
      style={{
        position: "absolute",
        left: state.x,
        top: state.y,
        width: state.w,
        height: minimized ? TITLE_H : state.h,
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        background: "rgba(11,10,19,0.97)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: `0 12px 60px rgba(0,0,0,0.88), 0 0 0 1px rgba(255,255,255,0.03), 0 0 40px ${color}11`,
        overflow: "hidden",
        userSelect: "none",
        zIndex,
      }}
    >
      {/* ── Title bar ── */}
      <div
        onPointerDown={onTitlePointerDown}
        style={{
          height: TITLE_H,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          cursor: "grab",
          background: "rgba(255,255,255,0.022)",
          borderBottom: minimized ? "none" : "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Color pip */}
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: color,
            boxShadow: `0 0 8px ${color}88`,
            flexShrink: 0,
          }}
        />
        {icon && (
          <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
        )}
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.38)",
            flex: 1,
          }}
        >
          {title}
        </span>
        <button
          onClick={() => setMinimized((m) => !m)}
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
            color: "rgba(255,255,255,0.35)",
            fontSize: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {minimized ? "□" : "—"}
        </button>
      </div>

      {/* ── Body ── */}
      {!minimized && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "auto",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.1) transparent",
            // min-width 0 is critical: lets flex children shrink below their
            // natural width so content reflows instead of overflowing/clipping
            minWidth: 0,
          }}
        >
          {children}
        </div>
      )}

      {/* ── Resize handles ── */}
      {!minimized && (
        <>
          {/* SE corner (most common resize) */}
          <div
            onPointerDown={(e) => onResizePointerDown(e, "se")}
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 18,
              height: 18,
              cursor: "se-resize",
              background:
                "linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.09) 50%)",
              borderBottomRightRadius: 14,
            }}
          />
          {/* S edge */}
          <div
            onPointerDown={(e) => onResizePointerDown(e, "s")}
            style={{
              position: "absolute",
              bottom: 0,
              left: 18,
              right: 18,
              height: 6,
              cursor: "s-resize",
            }}
          />
          {/* E edge */}
          <div
            onPointerDown={(e) => onResizePointerDown(e, "e")}
            style={{
              position: "absolute",
              right: 0,
              top: TITLE_H,
              bottom: 18,
              width: 6,
              cursor: "e-resize",
            }}
          />
          {/* W edge */}
          <div
            onPointerDown={(e) => onResizePointerDown(e, "w")}
            style={{
              position: "absolute",
              left: 0,
              top: TITLE_H,
              bottom: 18,
              width: 6,
              cursor: "w-resize",
            }}
          />
          {/* N edge */}
          <div
            onPointerDown={(e) => onResizePointerDown(e, "n")}
            style={{
              position: "absolute",
              top: TITLE_H,
              left: 18,
              right: 18,
              height: 6,
              cursor: "n-resize",
            }}
          />
        </>
      )}
    </div>
  );
}
