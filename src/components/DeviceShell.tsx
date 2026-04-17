/**
 * DeviceShell — the physical tamagotchi device shell.
 *
 * Visual language: Funko Pop-inspired toy device. Vibrant, warm, alive.
 * Urban streetwear meets music tech. Bold typography, punchy colors.
 *
 * The companion's FACE is split across the physical shell:
 *   • TOP BAR    — eyes (animate with mood)
 *   • BOTTOM BAR — mouth (animate with mood)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  TOP:  👀  logo  speaker grille  mood  skin btn │
 *   ├──────┬──────────────────────────────────┬───────┤
 *   │ LEFT │      S C R E E N                 │ RIGHT │
 *   │ dots │      (canvas or app UI)           │ zoom  │
 *   ├──────┴──────────────────────────────────┴───────┤
 *   │  BOTTOM: 👄  ← nav  stats strip  play state    │
 *   └─────────────────────────────────────────────────┘
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useStore } from "../store/useStore";
import { stopSong } from "../audio/engine";
import { SHELL, SKINS, nextSkin, type Skin, type SkinId } from "../shell/skins";
import { StatsPanel } from "./StatsPanel";
import type { Mood } from "../data/types";

/* -------------------------------------------------------------------------- */
/* Mood helpers                                                                  */
/* -------------------------------------------------------------------------- */

function moodGlow(mood: string): string {
  return (
    mood === "hyped"  ? "#ff4d6d" :
    mood === "happy"  ? "#ffcf40" :
    mood === "chill"  ? "#7cffcb" :
    mood === "sad"    ? "#3b82f6" :
    mood === "lonely" ? "#a78bfa" :
    mood === "sleepy" ? "#78716c" :
    "#7c3aed"
  );
}

/* -------------------------------------------------------------------------- */
/* Companion face parts — split across top/bottom shell                         */
/* -------------------------------------------------------------------------- */

/** Eyes that live in the TOP shell bar */
function CompanionEyes({ mood, color }: { mood: Mood; color: string }) {
  const isHyped  = mood === "hyped";
  const isSleepy = mood === "sleepy" || mood === "asleep";
  const isSad    = mood === "sad" || mood === "lonely";
  const EYE_SIZE = 18;

  return (
    <svg width={56} height={EYE_SIZE + 6} viewBox="0 0 56 24" style={{ overflow: "visible" }}>
      {/* LEFT EYE */}
      {isSleepy ? (
        <line x1="4" y1="10" x2="20" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      ) : isHyped ? (
        // Star-burst eyes when hyped
        <>
          <circle cx="12" cy="10" r="7" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
          <line x1="12" y1="3"  x2="12" y2="17" stroke={color} strokeWidth="1.5" />
          <line x1="5"  y1="10" x2="19" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="7"  y1="5"  x2="17" y2="15" stroke={color} strokeWidth="1.5" />
          <line x1="17" y1="5"  x2="7"  y2="15" stroke={color} strokeWidth="1.5" />
        </>
      ) : isSad ? (
        // Sad droopy eyes
        <>
          <circle cx="12" cy="11" r="5" fill={`${color}33`} stroke={color} strokeWidth="1.5" />
          <line x1="7" y1="7" x2="17" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        // Normal / happy
        <>
          <circle cx="12" cy="10" r="6" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
          <circle cx="12" cy="10" r="2.5" fill={color} />
          {/* shine dot */}
          <circle cx="14" cy="8" r="1" fill="rgba(255,255,255,0.7)" />
        </>
      )}
      {/* RIGHT EYE */}
      {isSleepy ? (
        <line x1="36" y1="10" x2="52" y2="10" stroke={color} strokeWidth="3" strokeLinecap="round" />
      ) : isHyped ? (
        <>
          <circle cx="44" cy="10" r="7" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
          <line x1="44" y1="3"  x2="44" y2="17" stroke={color} strokeWidth="1.5" />
          <line x1="37" y1="10" x2="51" y2="10" stroke={color} strokeWidth="1.5" />
          <line x1="39" y1="5"  x2="49" y2="15" stroke={color} strokeWidth="1.5" />
          <line x1="49" y1="5"  x2="39" y2="15" stroke={color} strokeWidth="1.5" />
        </>
      ) : isSad ? (
        <>
          <circle cx="44" cy="11" r="5" fill={`${color}33`} stroke={color} strokeWidth="1.5" />
          <line x1="49" y1="7" x2="39" y2="9" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="44" cy="10" r="6" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
          <circle cx="44" cy="10" r="2.5" fill={color} />
          <circle cx="46" cy="8" r="1" fill="rgba(255,255,255,0.7)" />
        </>
      )}
      {/* sleep z */}
      {isSleepy && (
        <text x="52" y="6" fill={color} fontSize="8" fontWeight="bold" opacity="0.7">z</text>
      )}
    </svg>
  );
}

/** Mouth that lives in the BOTTOM shell bar */
function CompanionMouth({ mood, color }: { mood: Mood; color: string }) {
  const isHyped  = mood === "hyped";
  const isSleepy = mood === "sleepy" || mood === "asleep";
  const isSad    = mood === "sad" || mood === "lonely";

  return (
    <svg width={40} height={20} viewBox="0 0 40 20" style={{ overflow: "visible" }}>
      {isHyped ? (
        // Big open happy mouth
        <>
          <path d="M 4 6 Q 20 20 36 6 L 36 10 Q 20 26 4 10 Z"
            fill={`${color}33`} stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
          {/* teeth */}
          <line x1="14" y1="8" x2="14" y2="12" stroke={color} strokeWidth="1.2" opacity="0.6" />
          <line x1="20" y1="8" x2="20" y2="13" stroke={color} strokeWidth="1.2" opacity="0.6" />
          <line x1="26" y1="8" x2="26" y2="12" stroke={color} strokeWidth="1.2" opacity="0.6" />
        </>
      ) : isSleepy ? (
        // Small neutral oval
        <ellipse cx="20" cy="12" rx="6" ry="3" fill={`${color}22`} stroke={color} strokeWidth="1.5" />
      ) : isSad ? (
        // Frown
        <path d="M 8 14 Q 20 4 32 14" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : (
        // Smile
        <path d="M 8 8 Q 20 18 32 8" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Beat indicator (replaces A/B/C decorative buttons)                           */
/* -------------------------------------------------------------------------- */

function BeatIndicator({ playing, accent }: { playing: boolean; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 20 }}>
      {[0.45, 0.7, 1.0, 0.7, 0.45].map((h, i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: playing ? `${h * 100}%` : "20%",
            borderRadius: 2,
            background: playing ? accent : "rgba(255,255,255,0.15)",
            boxShadow: playing ? `0 0 6px ${accent}88` : "none",
            transition: playing
              ? `height ${0.15 + i * 0.05}s ease-in-out ${i * 0.04}s`
              : "height 0.3s",
            animation: playing ? `barPulse${i} ${0.4 + i * 0.07}s ease-in-out infinite alternate` : "none",
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Canvas background                                                             */
/* -------------------------------------------------------------------------- */

function CanvasBg({ mood }: { mood: string }) {
  const color = moodGlow(mood);
  return (
    <>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse 100% 70% at 50% 35%, #16112a 0%, #0c0c14 55%, #070709 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div className="absolute pointer-events-none transition-all duration-[4s]" style={{
        top: "18%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "65vw", height: "45vh",
        borderRadius: "50%",
        background: `radial-gradient(ellipse, ${color}1a 0%, transparent 70%)`,
        filter: "blur(50px)",
      }} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Physical button                                                               */
/* -------------------------------------------------------------------------- */

function PhysBtn({
  label, title, onClick, active = false, size = 38, skin,
}: {
  label: string; title: string; onClick: () => void;
  active?: boolean; size?: number; skin: Skin;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: size, height: size, borderRadius: size / 2,
        fontSize: size >= 36 ? 15 : 12,
        background: active
          ? `radial-gradient(ellipse at 38% 32%, ${skin.accent}ee 0%, ${skin.accent}99 100%)`
          : `radial-gradient(ellipse at 38% 32%, ${skin.btnHighlight} 0%, ${skin.btnFace} 60%, ${skin.shellDark} 100%)`,
        boxShadow: active
          ? `0 0 18px ${skin.accent}77, 0 3px 8px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.18)`
          : `0 4px 10px rgba(0,0,0,0.7), 0 1px 2px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.1)`,
        border: `1px solid ${active ? skin.accent + "99" : "rgba(0,0,0,0.5)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.55)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.12s",
        flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat chip — big, bold, colorful                                              */
/* -------------------------------------------------------------------------- */

function StatChip({ icon, value, color }: { icon: string; value: string | number; color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <span style={{
        fontFamily: "monospace", fontSize: 13, fontWeight: 900,
        color: color ?? "rgba(255,255,255,0.75)",
        letterSpacing: "-0.01em",
        textShadow: color ? `0 0 10px ${color}66` : "none",
      }}>
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DeviceShell                                                                   */
/* -------------------------------------------------------------------------- */

const CANVAS_STAGES = new Set(["stack", "vocal", "name"]);

export function DeviceShell({ children }: { children: ReactNode }) {
  const {
    tamagotchi, inventory, stage, setStage,
    sessionStartedAt, toggleLogbook, toggleStats, showStats,
    skinId, setSkin, isPlaying, canvasZoom, setCanvasZoom,
    totalXP,
  } = useStore();

  // UI zoom (for non-canvas stages — template picker, crib, booth, etc.)
  const [uiZoom, setUiZoom] = useState(1.0);
  const MIN_ZOOM = 0.35;
  const MAX_ZOOM = 2.0;

  const inCanvas = CANVAS_STAGES.has(stage);

  // Ctrl+scroll — delegate to canvas zoom in canvas stages, else UI zoom
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      if (inCanvas) {
        setCanvasZoom(Math.max(0.18, Math.min(2.0, (canvasZoom || 0.6) + delta * 35)));
      } else {
        setUiZoom((z) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, [inCanvas, canvasZoom, setCanvasZoom]);

  // 60s timer
  const CREATION = new Set(["template", "stack", "vocal", "name"]);
  const inCreation = CREATION.has(stage);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (inCreation && sessionStartedAt) {
      timerRef.current = setInterval(
        () => setElapsed(Math.floor((Date.now() - sessionStartedAt) / 1000)),
        500
      );
    } else {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [inCreation, sessionStartedAt]);

  const mood   = tamagotchi.mood as Mood;
  const glow   = moodGlow(mood);
  const skin   = SKINS[skinId];
  // Use real accumulated XP from gamification system
  const XP_PER_LEVEL = 300;
  const level  = Math.floor(totalXP / XP_PER_LEVEL) + 1;
  const xpPct  = ((totalXP % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const timerColor = elapsed < 45 ? "#4ade80" : elapsed < 60 ? "#facc15" : "#f97316";

  // Current zoom to display on right panel
  const displayZoom = inCanvas ? (canvasZoom || 0) : uiZoom;

  const shellSurface: React.CSSProperties = {
    background: skin.shellGrad,
    boxShadow: `inset 0 1px 0 ${skin.shellLight}55, inset 1px 0 0 ${skin.shellLight}22`,
  };
  const screenInset: React.CSSProperties = {
    position: "absolute",
    top: SHELL.TOP, bottom: SHELL.BOTTOM,
    left: SHELL.LEFT, right: SHELL.RIGHT,
    borderRadius: SHELL.SCREEN_RADIUS,
    overflow: "hidden",
    boxShadow: `inset 0 0 0 2px ${skin.screenRing}, inset 0 4px 16px rgba(0,0,0,0.7), inset 0 -2px 8px rgba(0,0,0,0.4)`,
  };

  return (
    <div className="fixed inset-0 overflow-hidden" style={{ userSelect: "none", background: skin.shellBase }}>
      {/* beat-pulse keyframes */}
      <style>{`
        @keyframes barPulse0{from{height:20%}to{height:55%}}
        @keyframes barPulse1{from{height:35%}to{height:80%}}
        @keyframes barPulse2{from{height:50%}to{height:100%}}
        @keyframes barPulse3{from{height:35%}to{height:75%}}
        @keyframes barPulse4{from{height:20%}to{height:50%}}
      `}</style>

      {/* Shell surface + texture */}
      <div className="absolute inset-0" style={shellSurface} />
      <ShellTexture skin={skin} />

      {/* Screen area */}
      <div style={screenInset}>
        <CanvasBg mood={mood} />
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
          <div style={{
            transform: `scale(${uiZoom})`,
            transformOrigin: "top center",
            minHeight: `${100 / uiZoom}%`,
          }}>
            {children}
          </div>
        </div>
      </div>

      {/* Screen edge ring */}
      <div className="absolute pointer-events-none" style={{
        top: SHELL.TOP - 2, bottom: SHELL.BOTTOM - 2,
        left: SHELL.LEFT - 2, right: SHELL.RIGHT - 2,
        borderRadius: SHELL.SCREEN_RADIUS + 2,
        border: `2px solid ${skin.screenRing}`,
        boxShadow: `0 0 0 1px rgba(0,0,0,0.6)`,
        zIndex: 4,
      }} />

      {/* ══ TOP SHELL ══════════════════════════════════════════════════════════ */}
      <div className="absolute top-0 left-0 right-0" style={{
        height: SHELL.TOP, ...shellSurface,
        borderBottom: `2px solid rgba(0,0,0,0.55)`,
        zIndex: 10,
        display: "flex", alignItems: "center",
        padding: "0 14px", gap: 10,
      }}>
        {/* Left: chain ring + speaker */}
        <ChainRing color={skin.shellLight} />
        <SpeakerGrille />

        {/* LEFT COMPANION EYES */}
        <CompanionEyes mood={mood} color={glow} />

        {/* Center: GRVD logo */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <MoodLED color={glow} />
          <span style={{
            fontFamily: "monospace",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: "0.45em",
            textTransform: "uppercase",
            color: skin.shellLight,
            textShadow: `0 0 20px ${skin.accent}99, 0 0 6px ${skin.accent}55`,
          }}>GRVD</span>
          <MoodLED color={skin.accent} />
        </div>

        {/* RIGHT COMPANION EYES (mirror) */}
        <CompanionEyes mood={mood} color={glow} />

        {/* Right: speaker + skin button */}
        <SpeakerGrille />
        <button
          onClick={() => setSkin(nextSkin(skinId))}
          title="cycle skin"
          style={{
            fontFamily: "monospace", fontSize: 8, fontWeight: 900,
            letterSpacing: "0.18em", textTransform: "uppercase",
            color: skin.accent,
            background: `${skin.accent}22`,
            border: `1.5px solid ${skin.accent}55`,
            borderRadius: 5, padding: "3px 8px",
            cursor: "pointer", transition: "all 0.18s",
            boxShadow: `0 0 8px ${skin.accent}33`,
            flexShrink: 0,
          }}
        >
          {skin.name}
        </button>
      </div>

      {/* ══ LEFT SHELL ═════════════════════════════════════════════════════════ */}
      <div className="absolute" style={{
        top: SHELL.TOP, bottom: SHELL.BOTTOM,
        left: 0, width: SHELL.LEFT,
        ...shellSurface,
        borderRight: `1px solid rgba(0,0,0,0.45)`,
        zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
      }}>
        {/* Accent stripe */}
        <div style={{
          position: "absolute", right: 0, top: 14, bottom: 14,
          width: 3, borderRadius: 2,
          background: `linear-gradient(to bottom, transparent, ${skin.stripe}, transparent)`,
          boxShadow: `0 0 10px ${skin.stripe}88`,
        }} />
        {/* Decorative dots */}
        {[0.9, 0.55, 0.28].map((op, i) => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: skin.accent, opacity: op,
            boxShadow: op > 0.7 ? `0 0 6px ${skin.accent}` : "none",
          }} />
        ))}
        {/* Mood glow */}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: glow, boxShadow: `0 0 10px ${glow}, 0 0 4px ${glow}`,
          transition: "background 1s, box-shadow 1s",
        }} />
      </div>

      {/* ══ RIGHT SHELL ════════════════════════════════════════════════════════ */}
      <div className="absolute" style={{
        top: SHELL.TOP, bottom: SHELL.BOTTOM,
        right: 0, width: SHELL.RIGHT,
        ...shellSurface,
        borderLeft: `1px solid rgba(0,0,0,0.45)`,
        zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 7,
      }}>
        {/* Accent stripe */}
        <div style={{
          position: "absolute", left: 0, top: 14, bottom: 14,
          width: 3, borderRadius: 2,
          background: `linear-gradient(to bottom, transparent, ${skin.stripe}, transparent)`,
          boxShadow: `0 0 10px ${skin.stripe}88`,
        }} />
        {/* Zoom + */}
        <button
          onClick={() => inCanvas
            ? setCanvasZoom(Math.min(2.0, +((canvasZoom || 0.6) + 0.1).toFixed(2)))
            : setUiZoom(z => Math.min(MAX_ZOOM, +(z + 0.1).toFixed(1)))
          }
          style={zoomBtnStyle(skin)}
        >+</button>
        {/* Zoom % display */}
        <span style={{
          fontFamily: "monospace", fontSize: 8,
          color: "rgba(255,255,255,0.3)",
          writingMode: "vertical-lr",
          transform: "rotate(180deg)",
          letterSpacing: "0.05em",
        }}>
          {displayZoom > 0 ? `${Math.round(displayZoom * 100)}%` : "—"}
        </span>
        {/* Zoom − */}
        <button
          onClick={() => inCanvas
            ? setCanvasZoom(Math.max(0.18, +((canvasZoom || 0.6) - 0.1).toFixed(2)))
            : setUiZoom(z => Math.max(MIN_ZOOM, +(z - 0.1).toFixed(1)))
          }
          style={zoomBtnStyle(skin)}
        >−</button>
      </div>

      {/* ══ BOTTOM SHELL ═══════════════════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0" style={{
        height: SHELL.BOTTOM, ...shellSurface,
        borderTop: `2px solid rgba(0,0,0,0.55)`,
        zIndex: 10,
        display: "flex", flexDirection: "column",
        padding: "5px 16px 10px", gap: 5,
      }}>
        {/* ── Gamification strip (clickable → stats) ── */}
        <button
          onClick={toggleStats}
          style={{
            display: "flex", alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            background: `rgba(0,0,0,0.3)`,
            border: `1.5px solid ${skin.accent}33`,
            borderRadius: 10,
            padding: "5px 14px",
            cursor: "pointer",
            transition: "all 0.15s",
            width: "100%",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `${skin.accent}1e`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.3)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <StatChip icon="🔥" value={`${tamagotchi.streakDays}d`} color="#f97316" />
            <StatChip icon="💿" value={inventory.length} color="#818cf8" />
            <StatChip icon="⭐" value={`Lv ${level}`} color={skin.accent} />
            {inCreation && (
              <StatChip icon="⏱" value={`${elapsed}s`} color={timerColor} />
            )}
          </div>
          {/* XP bar + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 900, color: "#facc15", letterSpacing: "0.04em", textShadow: "0 0 8px #facc15" }}>
              {totalXP} XP
            </span>
            <div style={{ width: 44, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${xpPct}%`, height: "100%", background: skin.accent, borderRadius: 3, boxShadow: `0 0 6px ${skin.accent}` }} />
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
              ↑
            </span>
          </div>
        </button>

        {/* ── Button row ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* Left: nav buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PhysBtn label="←" title="home" onClick={() => { stopSong(); setStage("crib"); }} active={stage === "crib"} skin={skin} />
            <PhysBtn label="📓" title="logbook" onClick={toggleLogbook} skin={skin} />
            <PhysBtn label="🎧" title="booth" onClick={() => setStage("booth")} active={stage === "booth"} skin={skin} />
          </div>

          {/* Center: companion mouth */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <CompanionMouth mood={mood} color={glow} />
          </div>

          {/* Right: beat indicator (replaces non-functional A/B/C) */}
          <div style={{
            display: "flex", alignItems: "center",
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8, padding: "4px 10px",
            gap: 6,
          }}>
            <BeatIndicator playing={isPlaying} accent={skin.accent} />
            <span style={{
              fontFamily: "monospace", fontSize: 7, fontWeight: 700,
              color: isPlaying ? skin.accent : "rgba(255,255,255,0.15)",
              letterSpacing: "0.08em", textTransform: "uppercase",
              transition: "color 0.3s",
            }}>
              {isPlaying ? "live" : "idle"}
            </span>
          </div>
        </div>
      </div>

      {/* Corner masks */}
      <CornerMasks />

      {/* Stats / skill tree panel */}
      {showStats && <StatsPanel />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                                */
/* -------------------------------------------------------------------------- */

function zoomBtnStyle(skin: Skin): React.CSSProperties {
  return {
    width: 24, height: 24, borderRadius: 6,
    background: `radial-gradient(ellipse at 38% 32%, ${skin.btnHighlight} 0%, ${skin.btnFace} 100%)`,
    border: "1px solid rgba(0,0,0,0.45)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.5)", fontSize: 13, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "monospace", fontWeight: 700, transition: "all 0.1s",
  };
}

function SpeakerGrille() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2.5, opacity: 0.35 }}>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ display: "flex", gap: 2.5 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: "50%", background: "rgba(255,255,255,0.8)" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function ChainRing({ color }: { color: string }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: "50%",
      border: `2.5px solid ${color}99`,
      boxShadow: `0 0 5px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25)`,
      flexShrink: 0,
    }} />
  );
}

function MoodLED({ color }: { color: string }) {
  return (
    <div style={{
      width: 6, height: 6, borderRadius: "50%",
      background: color,
      boxShadow: `0 0 10px ${color}, 0 0 4px ${color}`,
      transition: "all 1.2s",
    }} />
  );
}

function ShellTexture({ skin }: { skin: Skin }) {
  return (
    <>
      <div className="absolute pointer-events-none" style={{
        top: SHELL.TOP, bottom: SHELL.BOTTOM, left: 0, width: SHELL.LEFT,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 6px)`,
        zIndex: 9,
      }} />
      <div className="absolute pointer-events-none" style={{
        top: SHELL.TOP, bottom: SHELL.BOTTOM, right: 0, width: SHELL.RIGHT,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0px, transparent 5px, rgba(0,0,0,0.07) 5px, rgba(0,0,0,0.07) 6px)`,
        zIndex: 9,
      }} />
    </>
  );
}

function CornerMasks() {
  const r = 18;
  const s = (pos: React.CSSProperties): React.CSSProperties => ({
    position: "fixed", width: r, height: r,
    background: "#000", zIndex: 200, pointerEvents: "none", ...pos,
  });
  return (
    <>
      <div style={s({ top: 0, left: 0,  borderBottomRightRadius: r })} />
      <div style={s({ top: 0, right: 0, borderBottomLeftRadius:  r })} />
      <div style={s({ bottom: 0, left: 0,  borderTopRightRadius: r })} />
      <div style={s({ bottom: 0, right: 0, borderTopLeftRadius:  r })} />
    </>
  );
}
