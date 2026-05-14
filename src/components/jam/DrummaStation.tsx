/**
 * DrummaStation — DEN-style training mini-game for the drum-guy. Full
 * screen overlay opened by right-clicking / long-pressing the drum
 * character in the jam stage and tapping the new TRAIN button.
 *
 * Current scope (commit 1 of a multi-step build):
 *   - 3 genre buttons (TRAP / RAP / POP). Tapping one shows that
 *     genre's 3 templates as a sub-picker.
 *   - Tap a template → load its pattern into the 3×16 editable grid
 *     and start the loop.
 *   - 3 row × 16 step grid (kick / snare / hat). Tap any cell to
 *     toggle that step in the active pattern. Live edits update the
 *     loop in-place (no stop / start glitch).
 *   - Playhead column highlight (rAF-polled from the engine).
 *   - Big PLAY / STOP button.
 *
 * Pending (subsequent commits):
 *   - Tap-along game: scrolling notes + tap-zone + hit scoring + hype
 *     phrases per hit.
 *   - BAKE flow: name the pattern → save as a custom drum sound that
 *     joins drum-guy's sound cycler in the jam stage.
 *   - Effect-knob XP rewards (per-character FX pool with branded
 *     plugin-style names).
 */

import { useEffect, useRef, useState } from "react";
import {
  startDrumPattern,
  updateDrumPattern,
  stopDrumPattern,
  getCurrentStepIndex,
  type DrumPattern,
} from "../../audio/drummaEngine";
import {
  DRUM_TEMPLATES,
  emptyDrumPattern,
  templatesByGenre,
  type DrumTemplate,
  type Genre,
} from "../../data/drumTemplates";

interface DrummaStationProps {
  /** Called when the player exits the station — JamView restores the
   *  jam-stage audio. */
  onClose: () => void;
  /** Called when the player commits a BAKE. JamView is responsible
   *  for offline-rendering the pattern, registering the buffer with
   *  the audio engine, assigning the slot, persisting the preset to
   *  the custom-presets store, awarding XP based on the player's
   *  game score, and then exiting the station. */
  onBake: (input: {
    name:    string;
    pattern: DrumPattern;
    bpm:     number;
    /** 0..1 accuracy across the play session — drives XP earned. */
    score:   number;
  }) => Promise<void>;
}

/** Ordered genre list for the top row of buttons. */
const GENRES: { id: Genre; label: string; accent: string }[] = [
  { id: "trap", label: "TRAP", accent: "#c084fc" },
  { id: "rap",  label: "RAP",  accent: "#fb923c" },
  { id: "pop",  label: "POP",  accent: "#22d3ee" },
];

/** Row colour per drum voice — matches the genre vibe + reads at a
 *  glance which row you're scrubbing. */
const ROW_ACCENT = {
  kick:  "#ff7a8e",
  snare: "#facc15",
  hat:   "#22d3ee",
};
const ROW_LABEL = {
  kick:  "KICK",
  snare: "SNARE",
  hat:   "HAT",
};
type RowKey = keyof typeof ROW_ACCENT;
const ROW_ORDER: RowKey[] = ["kick", "snare", "hat"];

export function DrummaStation({ onClose, onBake }: DrummaStationProps) {
  /** Active genre tab. Defaults to TRAP so the player sees content
   *  immediately on open. */
  const [genre, setGenre] = useState<Genre>("trap");
  /** Currently-loaded template id; null when the player started from
   *  scratch (future "Custom" flow). */
  const [templateId, setTemplateId] = useState<string | null>(null);
  /** Active 16-step pattern. Edits to the grid mutate this; engine
   *  updates via updateDrumPattern so the loop stays glitch-free. */
  const [pattern, setPattern] = useState<DrumPattern>(() => emptyDrumPattern());
  /** Tempo the loop plays at. Set when a template loads; future
   *  commit adds a manual tempo slider. */
  const [bpm, setBpm] = useState(140);
  /** Whether the sequencer is currently playing. */
  const [playing, setPlaying] = useState(false);
  /** Playhead step index (0..15) or -1 when stopped. Driven by rAF. */
  const [stepIdx, setStepIdx] = useState(-1);
  /** Open BAKE name-prompt overlay. Null = closed. */
  const [bakeDraft, setBakeDraft] = useState<string | null>(null);
  /** True while the offline-render + audio-engine wiring is happening
   *  (post-BAKE). Disables UI so the user can't double-fire. */
  const [baking, setBaking] = useState(false);

  /** Does the current pattern actually have any hits? BAKE is
   *  disabled for an empty grid since "save an empty drum loop" is
   *  not a useful outcome. */
  const hasAnyHits =
    pattern.kick.some(Boolean) ||
    pattern.snare.some(Boolean) ||
    pattern.hat.some(Boolean);

  // ── Tap-along game state ──
  // Player taps lane buttons (or A/S/D on desktop) in time with the
  // hits coming up in the playhead column. Every successful hit logs
  // a HypeBubble + bumps the score. BAKE is gated on completing at
  // least one full loop while the sequencer is playing — without the
  // game the player can't bake.
  const [hits,    setHits]    = useState(0);
  const [misses,  setMisses]  = useState(0);
  const [loopsCompleted, setLoopsCompleted] = useState(0);
  /** Transient floating hype bubbles fired on each hit. Each entry
   *  has its own id so React can animate them out. */
  const [bubbles, setBubbles] = useState<{ id: number; lane: RowKey; text: string }[]>([]);
  const bubbleIdRef = useRef(0);
  /** Track which (step, lane) cells we've already scored this loop so
   *  pressing the lane button while still in the timing window of a
   *  cell doesn't double-count. Reset each loop pass. */
  const scoredRef = useRef<Set<string>>(new Set());
  /** Last seen step — used to detect loop completion (step wraps 15
   *  → 0). */
  const lastStepRef = useRef(-1);

  // Polling loop for the playhead column highlight + loop-completion
  // detection. Each frame we check the current step index; if it
  // wrapped past 0 since last frame, count one completed loop and
  // clear the per-step scored set so the next pass starts fresh.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      setStepIdx(-1);
      lastStepRef.current = -1;
      return;
    }
    const tick = () => {
      const step = getCurrentStepIndex();
      setStepIdx(step);
      const prev = lastStepRef.current;
      if (prev > step && prev !== -1) {
        // Wrapped — count one full loop pass and reset hits-this-loop.
        setLoopsCompleted((n) => n + 1);
        scoredRef.current.clear();
      }
      lastStepRef.current = step;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Ensure the sequence stops when the station unmounts.
  useEffect(() => {
    return () => {
      stopDrumPattern();
    };
  }, []);

  function handleLoadTemplate(t: DrumTemplate) {
    setTemplateId(t.id);
    setPattern(t.pattern);
    setBpm(t.bpm);
    void startDrumPattern(t.pattern, t.bpm);
    setPlaying(true);
  }

  function handleTogglePlay() {
    if (playing) {
      stopDrumPattern();
      setPlaying(false);
    } else {
      void startDrumPattern(pattern, bpm);
      setPlaying(true);
    }
  }

  function handleToggleCell(row: RowKey, step: number) {
    setPattern((prev) => {
      const nextRow = prev[row].slice();
      nextRow[step] = !nextRow[step];
      const next: DrumPattern = { ...prev, [row]: nextRow };
      // Update the live loop in-place so the edit is audible
      // immediately (no stop/start glitch).
      if (playing) updateDrumPattern(next);
      return next;
    });
  }

  // ── Tap-along hit detection ──
  // A tap on a lane button is a "hit" iff the playhead is within
  // ±1 step of an active cell in that lane that hasn't been scored
  // this loop yet. ±1 step at 16 sixteenths/bar is generous on
  // purpose so the game feels FORGIVING for beginners.
  const HYPE_POOL = [
    "yeah!", "let's go!", "that's it!", "ooh!",
    "keep it up", "lock in", "we movin'", "ayy",
    "🔥", "go off!", "smooth", "tight",
  ];

  function pickHype(): string {
    return HYPE_POOL[Math.floor(Math.random() * HYPE_POOL.length)];
  }

  function pushBubble(lane: RowKey, text: string) {
    const id = ++bubbleIdRef.current;
    setBubbles((bs) => [...bs, { id, lane, text }]);
    // Auto-remove after the animation runs.
    window.setTimeout(() => {
      setBubbles((bs) => bs.filter((b) => b.id !== id));
    }, 900);
  }

  function tryHit(lane: RowKey) {
    if (!playing || stepIdx < 0) {
      // Tap with no playhead — soft miss, no penalty (don't punish
      // pressing buttons before PLAY).
      return;
    }
    const cells = pattern[lane];
    // Check current step + neighbours for an active cell that we
    // haven't already scored. Order: current, then -1 (just missed
    // window), then +1 (just-too-early).
    const candidates = [stepIdx, (stepIdx - 1 + 16) % 16, (stepIdx + 1) % 16];
    for (const step of candidates) {
      const key = `${lane}-${step}`;
      if (cells[step] && !scoredRef.current.has(key)) {
        scoredRef.current.add(key);
        setHits((n) => n + 1);
        pushBubble(lane, pickHype());
        return;
      }
    }
    // No matching cell — miss. Just bumps the counter; the lane
    // button will flash red via its own state below.
    setMisses((n) => n + 1);
  }

  // Keyboard shortcuts: A = kick, S = snare, D = hat. Keeps the
  // game playable on desktop without aiming for tiny pixel buttons.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === "a") tryHit("kick");
      else if (k === "s") tryHit("snare");
      else if (k === "d") tryHit("hat");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, stepIdx, pattern]);

  /** Commit BAKE — hands the pattern + name + bpm to the parent and
   *  spins UI feedback while the parent renders / saves. The parent
   *  is responsible for closing the station on success. */
  async function submitBake() {
    if (bakeDraft === null) return;
    if (baking) return;
    if (!hasAnyHits) return;
    setBaking(true);
    // Stop the live loop so the BAKE process doesn't double up with
    // playback chatter while the engine re-renders.
    stopDrumPattern();
    setPlaying(false);
    // Score = hits / (hits + misses). 1 = perfect, 0 = missed
    // everything. Min 0.1 so even sloppy attempts earn a sliver of
    // XP.
    const totalAttempts = hits + misses;
    const score = totalAttempts > 0 ? Math.max(0.1, hits / totalAttempts) : 0.1;
    try {
      await onBake({
        name:    bakeDraft.trim() || "MY DRUMS",
        pattern,
        bpm,
        score,
      });
      // onBake closes the station via JamView; nothing more to do.
    } catch (err) {
      console.error("[DrummaStation] bake failed:", err);
      setBaking(false);
      // Leave the dialog open so the player can retry.
    }
  }

  const templates = templatesByGenre(genre);
  const activeTemplate = DRUM_TEMPLATES.find((t) => t.id === templateId) ?? null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "linear-gradient(180deg, #0f1828 0%, #050811 100%)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "drummaPanelIn 0.22s ease-out",
      }}
    >
      {/* ── Top bar — back, title, tempo badge ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "linear-gradient(180deg, rgba(15, 24, 40, 0.95) 0%, rgba(15, 24, 40, 0.6) 100%)",
          borderBottom: "2px solid rgba(0, 0, 0, 0.6)",
        }}
      >
        <button
          onClick={() => { stopDrumPattern(); onClose(); }}
          style={{
            padding: "6px 12px",
            borderRadius: 999,
            border: "1.5px solid rgba(255,255,255,0.2)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          ← exit
        </button>
        <div
          style={{
            fontFamily: "'Lilita One', system-ui",
            fontSize: 20,
            color: "#fff",
            letterSpacing: 1,
            textShadow: "0 2px 0 rgba(0,0,0,0.5), 0 0 14px rgba(192, 132, 252, 0.4)",
          }}
        >
          🥁 DRUMMA
        </div>
        <div style={{ flex: 1 }} />
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            fontWeight: 700,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.10em",
          }}
        >
          {activeTemplate ? activeTemplate.name.toUpperCase() : "NO TEMPLATE"} · {bpm} BPM
        </div>
      </div>

      {/* ── Genre + template picker row ── */}
      <div style={{ flexShrink: 0, padding: "12px 16px 4px" }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 8,
          }}
        >
          {GENRES.map((g) => {
            const active = g.id === genre;
            return (
              <button
                key={g.id}
                onClick={() => setGenre(g.id)}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: `2px solid ${active ? g.accent : "rgba(0,0,0,0.55)"}`,
                  background: active
                    ? `linear-gradient(180deg, ${g.accent}cc, ${g.accent}66)`
                    : "linear-gradient(180deg, rgba(36, 51, 88, 0.6), rgba(15, 24, 40, 0.6))",
                  color: active ? "#0a0f1c" : "#fff",
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 14,
                  letterSpacing: 0.5,
                  cursor: "pointer",
                  textShadow: active ? "0 1px 0 rgba(255,255,255,0.4)" : "0 1px 0 rgba(0,0,0,0.55)",
                  boxShadow: active
                    ? `inset 0 2px 0 rgba(255,255,255,0.4), 0 3px 0 rgba(0,0,0,0.45), 0 0 14px ${g.accent}55`
                    : "inset 0 1px 0 rgba(255,255,255,0.08), 0 3px 0 rgba(0,0,0,0.35)",
                  transition: "background 0.18s, border-color 0.18s",
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
          }}
        >
          {templates.map((t) => {
            const active = t.id === templateId;
            const accent = GENRES.find((g) => g.id === t.genre)!.accent;
            return (
              <button
                key={t.id}
                onClick={() => handleLoadTemplate(t)}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: `2px solid ${active ? accent : "rgba(0,0,0,0.55)"}`,
                  background: active
                    ? `linear-gradient(180deg, ${accent}33, rgba(15, 24, 40, 0.6))`
                    : "linear-gradient(180deg, rgba(36, 51, 88, 0.45), rgba(15, 24, 40, 0.55))",
                  color: "#fff",
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 12,
                  letterSpacing: 0.3,
                  cursor: "pointer",
                  boxShadow: active
                    ? `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 10px ${accent}55`
                    : "inset 0 1px 0 rgba(255,255,255,0.06)",
                  lineHeight: 1.2,
                  textAlign: "left",
                }}
              >
                <div style={{ fontSize: 12 }}>{t.name}</div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 9,
                    color: "rgba(255,255,255,0.6)",
                    letterSpacing: "0.08em",
                    marginTop: 2,
                  }}
                >
                  {t.bpm} BPM
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Sequencer grid ── */}
      <div
        style={{
          flex: 1,
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        {ROW_ORDER.map((row) => (
          <SequencerRow
            key={row}
            row={row}
            cells={pattern[row]}
            playhead={stepIdx}
            onToggle={(step) => handleToggleCell(row, step)}
          />
        ))}
      </div>

      {/* ── Bottom transport ── */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 16px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderTop: "2px solid rgba(0, 0, 0, 0.6)",
          background: "linear-gradient(180deg, rgba(15, 24, 40, 0.6) 0%, rgba(15, 24, 40, 0.95) 100%)",
        }}
      >
        <button
          onClick={handleTogglePlay}
          style={{
            width: 56, height: 56,
            borderRadius: "50%",
            border: "2.5px solid #0a0f1c",
            background: playing
              ? "linear-gradient(180deg, #ff7a8e, #b8253a)"
              : "linear-gradient(180deg, #6bf395, #16a34a)",
            color: "#fff",
            fontSize: 22,
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
            boxShadow:
              "inset 0 2px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.45), 0 0 18px " +
              (playing ? "rgba(233,69,96,0.4)" : "rgba(74,222,128,0.4)"),
          }}
          aria-label={playing ? "stop" : "play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        {/* Lane tap buttons — the tap-along game. Press in time with
         *  the playhead column to score hits. Keyboard A / S / D fire
         *  the same buttons on desktop. */}
        <div style={{ display: "flex", gap: 8, flex: 1 }}>
          {ROW_ORDER.map((row) => (
            <LaneTapButton
              key={row}
              row={row}
              kbd={row === "kick" ? "A" : row === "snare" ? "S" : "D"}
              onTap={() => tryHit(row)}
              disabled={!playing}
            />
          ))}
        </div>
        {/* Score display — current loop hits + a running total. */}
        <div
          style={{
            minWidth: 100,
            textAlign: "right",
            fontFamily: "'JetBrains Mono', monospace",
            color: "rgba(255,255,255,0.7)",
            fontSize: 10,
            letterSpacing: "0.08em",
            lineHeight: 1.4,
          }}
        >
          <div style={{ fontFamily: "'Lilita One', system-ui", fontSize: 14, color: "#facc15" }}>
            {hits} HIT{hits === 1 ? "" : "S"}
          </div>
          <div style={{ color: "rgba(255,255,255,0.45)" }}>
            {misses} miss{misses === 1 ? "" : "es"}
          </div>
          <div style={{ color: "rgba(192,132,252,0.85)", marginTop: 2 }}>
            {loopsCompleted} loop{loopsCompleted === 1 ? "" : "s"}
          </div>
        </div>
        {/* BAKE button — opens the name prompt. Gated three ways:
         *  - pattern must have at least one hit (nothing to save),
         *  - the player must have played through the loop at least
         *    once (no one-tap-bake exploits),
         *  - no bake currently in flight (so we don't double-fire). */}
        <button
          onClick={() => setBakeDraft(activeTemplate?.name ?? "MY DRUMS")}
          disabled={!hasAnyHits || loopsCompleted < 1 || baking}
          title={
            !hasAnyHits
              ? "add at least one hit before baking"
              : loopsCompleted < 1
                ? "play through the loop at least once before baking"
                : "save this pattern to drum-guy's cycler"
          }
          style={{
            padding: "10px 18px",
            borderRadius: 14,
            border: "2px solid #0a0f1c",
            background: hasAnyHits && !baking
              ? "linear-gradient(180deg, #facc15, #b88a06)"
              : "linear-gradient(180deg, #4a4a4a, #2a2a2a)",
            color: hasAnyHits && !baking ? "#0a0f1c" : "rgba(255,255,255,0.6)",
            fontFamily: "'Lilita One', system-ui",
            fontSize: 13,
            letterSpacing: 0.5,
            cursor: hasAnyHits && !baking ? "pointer" : "not-allowed",
            opacity: hasAnyHits && !baking ? 1 : 0.55,
            textShadow: hasAnyHits && !baking ? "0 1px 0 rgba(255,255,255,0.4)" : undefined,
            boxShadow: hasAnyHits && !baking
              ? "inset 0 2px 0 rgba(255,255,255,0.40), 0 3px 0 rgba(0,0,0,0.45), 0 0 14px rgba(250, 204, 21, 0.55)"
              : "inset 0 2px 0 rgba(255,255,255,0.20), 0 3px 0 rgba(0,0,0,0.45)",
          }}
        >
          🍞 BAKE
        </button>
      </div>

      <style>{`
        @keyframes drummaPanelIn {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0);   }
        }
        @keyframes hypeBubbleFloat {
          0%   { transform: translate(-50%, 0)     scale(0.7); opacity: 0; }
          15%  { transform: translate(-50%, -10px) scale(1.1); opacity: 1; }
          100% { transform: translate(-50%, -50px) scale(1);   opacity: 0; }
        }
        @keyframes bakeDialogPop {
          0%   { transform: translate(-50%, -50%) scale(0.94); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
        }
      `}</style>

      {/* ── Hype bubbles ── float up over the lane buttons on each
       *  successful tap. Pure-CSS animation, auto-removed after the
       *  keyframe. */}
      <div
        style={{
          position: "absolute",
          left:  0,
          right: 0,
          bottom: 72,           // sits just above the lane buttons
          height: 1,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {bubbles.map((b) => (
          <div
            key={b.id}
            style={{
              position: "absolute",
              left: b.lane === "kick" ? "20%" : b.lane === "snare" ? "50%" : "80%",
              bottom: 0,
              transform: "translate(-50%, 0)",
              padding: "5px 11px",
              borderRadius: 14,
              background: "#fff",
              border: "2.5px solid #0a0f1c",
              boxShadow: "0 3px 0 rgba(0, 0, 0, 0.45)",
              fontFamily: "'Lilita One', system-ui",
              fontSize: 12,
              letterSpacing: 0.4,
              color: "#0f1828",
              whiteSpace: "nowrap",
              animation: "hypeBubbleFloat 0.9s ease-out forwards",
            }}
          >
            {b.text}
          </div>
        ))}
      </div>

      {/* ── BAKE name prompt ──
       *  Modal-style overlay. Submit → call onBake (parent handles
       *  rendering + audio engine + store + closing the station).
       *  Stays open while baking is in flight; the parent flips us
       *  off via onClose once everything is wired. */}
      {bakeDraft !== null && (
        <>
          <div
            onClick={() => !baking && setBakeDraft(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 600,
              background: "rgba(8, 12, 24, 0.7)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left:  "50%",
              top:   "50%",
              transform: "translate(-50%, -50%)",
              zIndex: 601,
              width: "min(94vw, 380px)",
              padding: 22,
              borderRadius: 20,
              background: "linear-gradient(180deg, #243358 0%, #0f1828 100%)",
              border: "2.5px solid #0a0f1c",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.18), 0 6px 0 rgba(0,0,0,0.5), 0 18px 38px rgba(0,0,0,0.6), 0 0 28px rgba(250, 204, 21, 0.35)",
              textAlign: "center",
              animation: "bakeDialogPop 0.22s cubic-bezier(.34,1.56,.64,1) both",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 4 }}>🍞</div>
            <div
              style={{
                fontFamily: "'Lilita One', system-ui",
                fontSize: 20,
                color: "#fff",
                letterSpacing: 0.5,
                marginBottom: 10,
                textShadow: "0 2px 0 rgba(0,0,0,0.6), 0 0 14px rgba(250, 204, 21, 0.45)",
              }}
            >
              NAME YOUR DRUMS
            </div>
            <input
              autoFocus
              value={bakeDraft}
              onChange={(e) => setBakeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter")  { e.preventDefault(); void submitBake(); }
                if (e.key === "Escape") { e.preventDefault(); if (!baking) setBakeDraft(null); }
              }}
              disabled={baking}
              placeholder="MY DRUMS"
              style={{
                width: "100%",
                padding: "9px 12px",
                marginBottom: 14,
                borderRadius: 10,
                border: "2px solid rgba(250, 204, 21, 0.55)",
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 14,
                letterSpacing: 0.3,
                outline: "none",
                textAlign: "center",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                onClick={() => void submitBake()}
                disabled={baking}
                style={{
                  padding: "10px 22px",
                  borderRadius: 14,
                  border: "2px solid #0a0f1c",
                  background: baking
                    ? "linear-gradient(180deg, #4a4a4a, #2a2a2a)"
                    : "linear-gradient(180deg, #facc15, #b88a06)",
                  color: baking ? "rgba(255,255,255,0.55)" : "#0a0f1c",
                  fontFamily: "'Lilita One', system-ui",
                  fontSize: 14,
                  letterSpacing: 0.5,
                  cursor: baking ? "wait" : "pointer",
                  textShadow: baking ? undefined : "0 1px 0 rgba(255,255,255,0.4)",
                  boxShadow: "inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45)",
                }}
              >
                {baking ? "BAKING…" : "🍞 BAKE"}
              </button>
              <button
                onClick={() => setBakeDraft(null)}
                disabled={baking}
                style={{
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: "1.5px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "rgba(255,255,255,0.7)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  cursor: baking ? "not-allowed" : "pointer",
                  opacity: baking ? 0.4 : 1,
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SequencerRow — one drum voice (kick / snare / hat) across 16 step cells.   */
/* -------------------------------------------------------------------------- */

interface SequencerRowProps {
  row:      RowKey;
  cells:    boolean[];
  /** 0..15 (current playhead) or -1 when stopped. */
  playhead: number;
  onToggle: (step: number) => void;
}

function SequencerRow({ row, cells, playhead, onToggle }: SequencerRowProps) {
  const accent = ROW_ACCENT[row];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 60,
          flexShrink: 0,
          fontFamily: "'Lilita One', system-ui",
          fontSize: 12,
          color: accent,
          letterSpacing: 0.3,
          textShadow: `0 1px 0 rgba(0,0,0,0.6), 0 0 8px ${accent}55`,
        }}
      >
        {ROW_LABEL[row]}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(16, 1fr)",
          gap: 3,
          flex: 1,
        }}
      >
        {cells.map((on, step) => {
          // Beat boundaries (every 4th cell) get a slight accent so
          // the grid reads as 4×4 quarters even with the dense 16
          // steps.
          const isBeatStart = step % 4 === 0;
          const isPlayhead  = step === playhead;
          return (
            <button
              key={step}
              onClick={() => onToggle(step)}
              style={{
                aspectRatio: "1 / 1",
                minHeight: 22,
                borderRadius: 6,
                border: isPlayhead
                  ? "2px solid #facc15"
                  : isBeatStart
                    ? `1px solid ${accent}88`
                    : "1px solid rgba(255,255,255,0.10)",
                background: on
                  ? `linear-gradient(135deg, ${accent}dd, ${accent}77)`
                  : isBeatStart
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(255,255,255,0.02)",
                boxShadow: on
                  ? `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 8px ${accent}55`
                  : isPlayhead
                    ? "0 0 12px rgba(250, 204, 21, 0.55)"
                    : "none",
                cursor: "pointer",
                padding: 0,
                transition: "background 0.10s, box-shadow 0.10s, border-color 0.10s",
              }}
              aria-pressed={on}
              aria-label={`${row} step ${step + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LaneTapButton — big tap target for the rhythm game, one per drum voice.   */
/* -------------------------------------------------------------------------- */

interface LaneTapButtonProps {
  row:      RowKey;
  kbd:      string;
  onTap:    () => void;
  disabled: boolean;
}

function LaneTapButton({ row, kbd, onTap, disabled }: LaneTapButtonProps) {
  const accent = ROW_ACCENT[row];
  const [flashing, setFlashing] = useState(false);

  function handleTap() {
    if (disabled) return;
    setFlashing(true);
    window.setTimeout(() => setFlashing(false), 140);
    onTap();
  }

  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); handleTap(); }}
      disabled={disabled}
      aria-label={`tap ${row}`}
      title={`${ROW_LABEL[row]} (${kbd})`}
      style={{
        flex: 1,
        height: 56,
        borderRadius: 14,
        border: `2px solid ${disabled ? "rgba(0,0,0,0.55)" : "#0a0f1c"}`,
        background: disabled
          ? "linear-gradient(180deg, rgba(36, 51, 88, 0.4), rgba(15, 24, 40, 0.4))"
          : flashing
            ? `linear-gradient(180deg, ${accent}, ${accent}88)`
            : `linear-gradient(180deg, ${accent}aa, ${accent}55)`,
        color: "#0a0f1c",
        fontFamily: "'Lilita One', system-ui",
        fontSize: 14,
        letterSpacing: 0.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled
          ? "none"
          : flashing
            ? `inset 0 2px 0 rgba(255,255,255,0.5), 0 1px 0 rgba(0,0,0,0.55), 0 0 22px ${accent}cc`
            : `inset 0 2px 0 rgba(255,255,255,0.35), 0 4px 0 rgba(0,0,0,0.45), 0 0 12px ${accent}55`,
        textShadow: "0 1px 0 rgba(255,255,255,0.35)",
        transition: "background 0.08s, box-shadow 0.08s",
        position: "relative",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
    >
      <div>{ROW_LABEL[row]}</div>
      <div
        style={{
          position: "absolute",
          right: 8,
          top:   6,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          fontWeight: 700,
          color: "rgba(10, 15, 28, 0.55)",
          letterSpacing: "0.05em",
        }}
      >
        {kbd}
      </div>
    </button>
  );
}
