/**
 * VocalRecorder — step 5 of the recipe.
 *
 * Karaoke timing is BPM-driven:
 *   - Each lyric line occupies BARS_PER_LINE bars of the beat
 *   - Total recording duration = verse.length × BARS_PER_LINE × (60/bpm) × 4
 *   - At 140 BPM, 4 lines × 2 bars = ~13.7 s  (each line ~3.4 s of breathing room)
 *
 * Syllable splitting uses a vowel-cluster regex (standard phonetics approach):
 *   "creating" → ["cre", "a", "ting"]  — each syllable lights up separately
 *   Short words (≤ 3 letters) stay whole.
 *
 * References:
 *   - 8-bar hip-hop phrase structure (DJ phrasing research)
 *   - Vowel-group syllabification: nlp-syllables / hyphenation-algorithm
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store/useStore";
import {
  estimatePitchContour,
  recordVocal,
  playSong,
  stopSong,
  calculatePitchCorrection,
  setVocalPitchCorrection,
} from "../audio/engine";
import { VOCAL_XP } from "../data/achievements";
import { ChunkyButton, ChunkyPill } from "../ui/Chunky";

/* -------------------------------------------------------------------------- */
/* Syllable splitter                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Split a single word into phonetic syllables using a vowel-cluster regex.
 * Each group anchors on a vowel run; one leading consonant cluster and one
 * trailing consonant before the next vowel cluster are absorbed.
 * Short words (≤ 3 chars) and all-consonant words are returned whole.
 */
function splitSyllables(word: string): string[] {
  const clean = word.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (clean.length <= 3) return [word];

  const groups = clean.match(
    /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi
  );
  if (!groups || groups.length <= 1) return [word];

  // Map each syllable's letter count back to positions in the original word
  // (which may contain apostrophes, hyphens, etc.).
  const parts: string[] = [];
  let pos = 0;
  for (let g = 0; g < groups.length - 1; g++) {
    let letters = 0;
    let end = pos;
    while (end < word.length && letters < groups[g].length) {
      if (/[a-zA-Z]/.test(word[end])) letters++;
      end++;
    }
    parts.push(word.slice(pos, end));
    pos = end;
  }
  if (pos < word.length) parts.push(word.slice(pos));

  const filtered = parts.filter((s) => s.length > 0);
  return filtered.length > 1 ? filtered : [word];
}

/* -------------------------------------------------------------------------- */
/* Syllable timeline                                                              */
/* -------------------------------------------------------------------------- */

export interface SylItem {
  text: string;
  lineIdx: number;
  wordIdx: number;
  startTime: number;  // absolute seconds from recording start
  globalIdx: number;  // position in the flat timeline array
}

/**
 * Build a flat list of syllables with BPM-aligned start times.
 * Each verse line occupies exactly lineSecs seconds.
 * Syllables within a line are distributed evenly across that window.
 */
function buildSyllableTimeline(verse: string[], lineSecs: number): SylItem[] {
  const result: SylItem[] = [];
  let globalIdx = 0;

  for (let lineIdx = 0; lineIdx < verse.length; lineIdx++) {
    const lineStart = lineIdx * lineSecs;
    const words = verse[lineIdx].split(" ");

    // Collect all syllables for this line first (need total count for spacing)
    const lineSyls: { text: string; wordIdx: number }[] = [];
    for (let wi = 0; wi < words.length; wi++) {
      for (const syl of splitSyllables(words[wi])) {
        lineSyls.push({ text: syl, wordIdx: wi });
      }
    }

    const sylSecs = lineSecs / Math.max(1, lineSyls.length);
    for (let i = 0; i < lineSyls.length; i++) {
      result.push({
        text: lineSyls[i].text,
        lineIdx,
        wordIdx: lineSyls[i].wordIdx,
        startTime: lineStart + i * sylSecs,
        globalIdx: globalIdx++,
      });
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                     */
/* -------------------------------------------------------------------------- */

// 2 bars per line × 2 lines = 4 bars = exactly one HOOK section.
// At 140 BPM that's ~6.9 s; at 90 BPM ~10.7 s — comfortable for beginners.
const BARS_PER_LINE = 2;

const DEFAULT_VERSE = [
  "step in the booth, it's time to create",
  "GRVD certified, yeah we at the light",
];

const FRIENDS = [
  { id: "f1", name: "YoungKnight44",  avatar: "🐉", status: "in the lab · 143rd", online: "active"  as const },
  { id: "f2", name: "DrillQueen808",  avatar: "👑", status: "2 blocks from u",    online: "nearby"  as const },
  { id: "f3", name: "FlipzMcFlow",    avatar: "🔥", status: "offline",            online: "offline" as const },
];

type FriendStatus = "active" | "nearby" | "offline";

/* -------------------------------------------------------------------------- */
/* Main component                                                                */
/* -------------------------------------------------------------------------- */

export function VocalRecorder() {
  const { activeTemplate, layers, setVocal, setStage, addXP } = useStore();

  const [tab,          setTab]          = useState<"record" | "squad">("record");
  const [phase,        setPhase]        = useState<"ready" | "recording" | "scoring" | "done">("ready");
  const [elapsed,      setElapsed]      = useState(0);
  const [score,        setScore]        = useState<number | null>(null);
  const [contour,      setContour]      = useState<number[]>([]);
  const [error,        setError]        = useState<string | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);
  /** Live mic level 0–1 from the AnalyserNode. >0.01 = mic has signal. */
  const [micLevel,     setMicLevel]     = useState(0);
  /** User-edited lyrics. null = use template/default lyrics. */
  const [customLyrics, setCustomLyrics] = useState<string[] | null>(null);
  /** Whether the lyrics edit panel is open. */
  const [isEditing,    setIsEditing]    = useState(false);
  /** Working copy of lyrics while the edit panel is open. */
  const [editLines,    setEditLines]    = useState<string[]>([]);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const micLevelRef = useRef(setMicLevel);

  const defaultVerse = activeTemplate?.verse ?? DEFAULT_VERSE;
  const verse = customLyrics ?? defaultVerse;
  const bpm   = activeTemplate?.bpm ?? 140;

  // BPM-derived timing
  const barSecs    = (60 / bpm) * 4;                      // seconds per bar (4/4 time)
  const lineSecs   = barSecs * BARS_PER_LINE;              // seconds per verse line
  const recordSecs = verse.length * lineSecs;              // total recording duration

  // Syllable timeline — recalculated only when verse or BPM changes
  const sylTimeline = useMemo(
    () => buildSyllableTimeline(verse, lineSecs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [verse.join("|"), lineSecs]
  );

  // Active syllable index from elapsed time
  const activeSylIdx = useMemo(() => {
    if (elapsed <= 0 || phase !== "recording") return -1;
    let idx = -1;
    for (let i = 0; i < sylTimeline.length; i++) {
      if (sylTimeline[i].startTime <= elapsed) idx = i;
      else break;
    }
    return idx;
  }, [elapsed, sylTimeline, phase]);

  const activeLineIdx = activeSylIdx >= 0
    ? (sylTimeline[activeSylIdx]?.lineIdx ?? 0)
    : 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopSong();
    };
  }, []);

  if (!activeTemplate) return null;
  const tpl = activeTemplate;

  async function handleRecord() {
    setError(null);
    setElapsed(0);
    setScore(null);
    setContour([]);
    try {
      setPhase("recording");

      await playSong(
        {
          id: "vocal-preview", name: "vocal-preview",
          bpm: tpl.bpm, bars: tpl.bars,
          keyRoot: tpl.keyRoot, templateId: tpl.id,
          layers: layers.filter((l) => l.kind !== "vocal"),
          tags: tpl.tags, collaborators: [], createdAt: Date.now(),
        },
        null
      );

      // High-resolution ticker so syllable transitions feel snappy
      const startMs = Date.now();
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startMs) / 1000;
        setElapsed(secs);
        if (secs >= recordSecs && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }, 40);  // ~25 fps — smooth enough for syllable-level highlighting

      setMicLevel(0);
      const { blob, buffer } = await recordVocal(recordSecs, (rms) => {
        micLevelRef.current(rms);
      });

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      stopSong();

      setPhase("scoring");
      const url     = URL.createObjectURL(blob);
      const pitches = estimatePitchContour(buffer);
      setContour(pitches);
      const s = scoreContour(pitches, tpl.keyRoot);
      setScore(s);
      // Pre-calculate pitch correction so makeVocalPlayer can autotune on first play
      const correction = calculatePitchCorrection(pitches, tpl.keyRoot);
      setVocalPitchCorrection(correction);
      setMicLevel(0);
      setVocal(buffer, url, s);
      addXP(VOCAL_XP, "vocal recorded");
      setElapsed(recordSecs);
      setPhase("done");
    } catch (e) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      stopSong();
      setMicLevel(0);
      setError(e instanceof Error ? e.message : "Recording failed.");
      setPhase("ready");
      setElapsed(0);
    }
  }

  function redo() {
    stopSong();
    setPhase("ready");
    setElapsed(0);
    setScore(null);
    setContour([]);
  }

  function skip() {
    stopSong();
    setVocal(null, null, null);
    setStage("name");
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  return (
    /* Slice 1: now a step-through page under PageShell, not a canvas window. */
    <div className="flex flex-col min-w-0">

      {/* Header */}
      <div className="px-1 pt-3 pb-3 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase text-grvd-purple">
              step 5 · vocals
            </div>
            <div className="font-display text-2xl text-white leading-tight mt-0.5">
              drop the verse 🎤
            </div>
          </div>
          <ChunkyPill variant="ghost" size="sm" onClick={skip}>skip</ChunkyPill>
        </div>

        {/* Tab toggle */}
        <div className="flex gap-2 pb-3 border-b border-white/6">
          {([["record", "🎤", "record"], ["squad", "🤝", "squad up"]] as const).map(([id, icon, label]) => (
            <ChunkyPill
              key={id}
              variant={tab === id ? "purple" : "ghost"}
              size="md"
              icon={icon}
              onClick={() => setTab(id)}
            >
              {label}
            </ChunkyPill>
          ))}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[100] whitespace-nowrap font-mono text-[11px] font-bold text-white px-4 py-1.5 rounded-full bg-grvd-purple/90 border border-grvd-purple shadow-chunky"
          style={{ top: 60 }}
        >
          {toast}
        </div>
      )}

      <div style={{ minWidth: 0 }}>
        {tab === "record" ? (
          <RecordTab
            verse={verse}
            phase={phase}
            elapsed={elapsed}
            recordSecs={recordSecs}
            sylTimeline={sylTimeline}
            activeSylIdx={activeSylIdx}
            activeLineIdx={activeLineIdx}
            bpm={bpm}
            score={score}
            contour={contour}
            error={error}
            micLevel={micLevel}
            isEditing={isEditing}
            editLines={editLines}
            hasCustomLyrics={customLyrics !== null}
            onOpenEdit={() => {
              setEditLines([...verse]);
              setIsEditing(true);
            }}
            onEditLine={(i, val) => setEditLines((lines) => {
              const next = [...lines];
              next[i] = val;
              return next;
            })}
            onSaveEdit={() => {
              setCustomLyrics([...editLines]);
              setIsEditing(false);
            }}
            onResetLyrics={() => {
              setCustomLyrics(null);
              setIsEditing(false);
            }}
            onRecord={handleRecord}
            onRedo={redo}
            onSkip={skip}
            onNext={() => setStage("name")}
          />
        ) : (
          <SquadTab onToast={showToast} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Record tab                                                                    */
/* -------------------------------------------------------------------------- */

interface RecordTabProps {
  verse: string[];
  phase: "ready" | "recording" | "scoring" | "done";
  elapsed: number;
  recordSecs: number;
  sylTimeline: SylItem[];
  activeSylIdx: number;
  activeLineIdx: number;
  bpm: number;
  score: number | null;
  contour: number[];
  error: string | null;
  micLevel: number;
  isEditing: boolean;
  editLines: string[];
  hasCustomLyrics: boolean;
  onOpenEdit: () => void;
  onEditLine: (i: number, val: string) => void;
  onSaveEdit: () => void;
  onResetLyrics: () => void;
  onRecord: () => void;
  onRedo: () => void;
  onSkip: () => void;
  onNext: () => void;
}

function RecordTab({
  verse, phase, elapsed, recordSecs, sylTimeline, activeSylIdx, activeLineIdx,
  bpm, score, contour, error, micLevel,
  isEditing, editLines, hasCustomLyrics,
  onOpenEdit, onEditLine, onSaveEdit, onResetLyrics,
  onRecord, onRedo, onSkip, onNext,
}: RecordTabProps) {
  const progress = Math.min(elapsed / recordSecs, 1);
  const canEdit  = phase === "ready";

  return (
    <div style={{ padding: "12px 14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ── Lyrics edit panel ── */}
      {isEditing && canEdit ? (
        <div className="rounded-2xl border border-grvd-purple/30 bg-grvd-purple/8 p-3 flex flex-col gap-2 shadow-chunky-press">
          <div className="font-mono text-[9px] font-bold tracking-[0.16em] uppercase text-grvd-purple">
            ✏️ edit your lyrics
          </div>
          {editLines.map((line, i) => (
            <input
              key={i}
              value={line}
              onChange={(e) => onEditLine(i, e.target.value)}
              placeholder={`line ${i + 1}…`}
              className="w-full px-3 py-2 rounded-xl bg-white/6 border border-grvd-purple/30 font-mono text-[12px] text-white outline-none focus:border-grvd-purple/70"
            />
          ))}
          <div className="flex flex-wrap gap-2 mt-1">
            <ChunkyButton variant="hero" size="sm" icon="✓" onClick={onSaveEdit}>
              use these lyrics
            </ChunkyButton>
            {hasCustomLyrics && (
              <ChunkyPill variant="ghost" size="sm" onClick={onResetLyrics}>
                reset to default
              </ChunkyPill>
            )}
            <ChunkyPill
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => onResetLyrics()}
            >
              cancel
            </ChunkyPill>
          </div>
        </div>
      ) : (
        canEdit && (
          <div className="flex justify-end">
            <ChunkyPill
              variant={hasCustomLyrics ? "purple" : "ghost"}
              size="sm"
              icon="✏️"
              onClick={onOpenEdit}
            >
              {hasCustomLyrics ? "my lyrics" : "edit lyrics"}
            </ChunkyPill>
          </div>
        )
      )}

      <KaraokeDisplay
        verse={verse}
        sylTimeline={sylTimeline}
        activeSylIdx={phase === "recording" ? activeSylIdx : phase === "done" ? sylTimeline.length : -1}
        activeLineIdx={activeLineIdx}
        phase={phase}
      />

      {(phase === "recording" || phase === "done") && (
        <div style={{ position: "relative" }}>
          <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${progress * 100}%`,
              background: phase === "done"
                ? "linear-gradient(90deg, #7c3aed, #4ade80)"
                : "linear-gradient(90deg, #7c3aed, #a855f7)",
              transition: "width 0.04s linear",
              boxShadow: phase === "recording" ? "0 0 8px rgba(124,58,237,0.6)" : "none",
            }} />
          </div>
          {phase === "recording" && (
            <div style={{
              position: "absolute", right: 0, top: -18,
              fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.35)",
            }}>
              {Math.max(0, recordSecs - elapsed).toFixed(1)}s · {bpm} BPM
            </div>
          )}
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-col items-center gap-3">
          {error && (
            <div className="w-full text-center font-mono text-[10px] text-red-400 bg-red-400/10 border border-red-400/25 rounded-xl px-3 py-1.5">
              {error}
            </div>
          )}
          <ChunkyButton variant="hero" size="lg" icon="🎤" onClick={onRecord}>
            start recording
          </ChunkyButton>
          <p className="font-mono text-[10px] text-white/30 text-center">
            beat plays in the back · rap along · {recordSecs.toFixed(1)}s at {bpm} BPM
          </p>
        </div>
      )}

      {phase === "recording" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <RecordingDot />
            <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: "#f87171" }}>
              recording — rap along
            </span>
          </div>

          {/* Live VU meter — shows whether the mic is actually capturing audio */}
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Meter bar */}
              <div style={{
                flex: 1,
                height: 8,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 4,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min(micLevel * 6, 1) * 100}%`,  // ×6 so normal voice = mostly full
                  background: micLevel < 0.01
                    ? "rgba(255,255,255,0.15)"
                    : micLevel < 0.05
                    ? "#facc15"
                    : "#4ade80",
                  borderRadius: 4,
                  transition: "width 0.05s, background 0.1s",
                  boxShadow: micLevel > 0.01 ? "0 0 6px rgba(74,222,128,0.6)" : "none",
                }} />
              </div>
              {/* Label */}
              <span style={{
                fontFamily: "monospace", fontSize: 8,
                color: micLevel < 0.01 ? "#f87171" : "#4ade80",
                width: 52, textAlign: "right", flexShrink: 0,
              }}>
                {micLevel < 0.01 ? "no signal" : micLevel < 0.05 ? "low" : "✓ hearing you"}
              </span>
            </div>
            {micLevel < 0.01 && (
              <div style={{
                fontFamily: "monospace", fontSize: 9,
                color: "rgba(255,87,87,0.7)",
                textAlign: "center",
              }}>
                mic not detected — check browser mic permissions (🔒 icon in address bar)
              </div>
            )}
          </div>
        </div>
      )}

      {phase === "scoring" && (
        <div style={{ textAlign: "center", fontFamily: "monospace", fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
          analyzing your flow…
        </div>
      )}

      {phase === "done" && score !== null && (
        <div className="flex flex-col items-center gap-3">
          <PitchBar contour={contour} score={score} />
          <div className="text-center">
            <span
              className="font-display text-5xl tabular-nums"
              style={{
                color: scoreColor(score),
                textShadow: `0 0 24px ${scoreColor(score)}aa`,
              }}
            >
              {score}
            </span>
            <span className="font-mono text-base text-white/30">/100</span>
            <div className="font-mono text-[11px] text-white/55 mt-1">
              {verdict(score)}
            </div>
          </div>
          <div className="flex gap-2">
            <ChunkyPill variant="ghost" size="md" icon="🔁" onClick={onRedo}>redo</ChunkyPill>
            <ChunkyButton variant="hero" size="md" onClick={onNext}>save it →</ChunkyButton>
          </div>
        </div>
      )}

      <ChunkyPill variant="ghost" size="sm" onClick={onSkip} className="self-center opacity-60">
        skip vocals
      </ChunkyPill>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Karaoke display — syllable-level highlighting                                 */
/* -------------------------------------------------------------------------- */

interface KaraokeProps {
  verse: string[];
  sylTimeline: SylItem[];
  activeSylIdx: number;   // -1 = nothing, sylTimeline.length = all lit
  activeLineIdx: number;
  phase: string;
}

function KaraokeDisplay({ verse, sylTimeline, activeSylIdx, activeLineIdx, phase }: KaraokeProps) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (phase === "recording" && lineRefs.current[activeLineIdx]) {
      lineRefs.current[activeLineIdx]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeLineIdx, phase]);

  const isActive = phase === "recording" || phase === "done";

  // Build a quick lookup: for each (lineIdx, wordIdx), get the syllables with their globalIdx
  // We walk sylTimeline once and group by line → word
  const sylsByLineWord = useMemo(() => {
    const map = new Map<string, SylItem[]>();
    for (const s of sylTimeline) {
      const key = `${s.lineIdx}:${s.wordIdx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [sylTimeline]);

  return (
    <div style={{
      background: "rgba(0,0,0,0.3)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "14px 12px",
      maxHeight: 200, overflowY: "hidden",
      position: "relative",
    }}>
      {/* Fade masks */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 28,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
        pointerEvents: "none", zIndex: 2, borderRadius: "12px 12px 0 0",
      }} />
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 28,
        background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
        pointerEvents: "none", zIndex: 2, borderRadius: "0 0 12px 12px",
      }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {verse.map((line, li) => {
          const isActiveLine = li === activeLineIdx && isActive;
          const isPastLine   = li < activeLineIdx  && isActive;
          const words        = line.split(" ");

          return (
            <div
              key={li}
              ref={(el) => { lineRefs.current[li] = el; }}
              style={{
                textAlign: "center",
                transition: "all 0.25s",
                opacity:   isPastLine ? 0.18 : isActiveLine ? 1 : isActive ? 0.4 : 0.72,
                transform: isActiveLine ? "scale(1.03)" : "scale(1)",
                lineHeight: 1.7,
              }}
            >
              {words.map((word, wi) => {
                const wordSyls = sylsByLineWord.get(`${li}:${wi}`) ?? [];

                return (
                  <span key={wi} style={{ display: "inline-block", marginRight: "0.28em" }}>
                    {wordSyls.length > 0
                      ? wordSyls.map((s) => {
                          const isActiveSyl = s.globalIdx === activeSylIdx && activeSylIdx >= 0;
                          const isPastSyl   = s.globalIdx < activeSylIdx  && activeSylIdx >= 0;

                          return (
                            <span
                              key={s.globalIdx}
                              style={{
                                display: "inline",
                                fontFamily: "monospace",
                                fontSize: isActiveLine ? 14 : 12,
                                fontWeight: isActiveSyl ? 900 : 700,
                                color: isActiveSyl
                                  ? "#ffffff"
                                  : isPastSyl
                                    ? "rgba(255,255,255,0.25)"
                                    : isActiveLine
                                      ? "rgba(255,255,255,0.82)"
                                      : "rgba(255,255,255,0.6)",
                                textShadow: isActiveSyl
                                  ? "0 0 16px #a78bfa, 0 0 6px #7c3aed"
                                  : "none",
                                background: isActiveSyl
                                  ? "rgba(124,58,237,0.3)"
                                  : "transparent",
                                borderRadius: isActiveSyl ? 3 : 0,
                                padding: isActiveSyl ? "0 2px" : "0",
                                transition: "color 0.06s, text-shadow 0.06s, background 0.06s",
                              }}
                            >
                              {s.text}
                            </span>
                          );
                        })
                      : (
                        // Fallback — word not in timeline (shouldn't happen)
                        <span style={{
                          fontFamily: "monospace",
                          fontSize: isActiveLine ? 14 : 12,
                          fontWeight: 700,
                          color: "rgba(255,255,255,0.6)",
                        }}>
                          {word}
                        </span>
                      )
                    }
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Squad Up tab                                                                  */
/* -------------------------------------------------------------------------- */

function SquadTab({ onToast }: { onToast: (msg: string) => void }) {
  return (
    <div className="px-1 pb-4 flex flex-col gap-2.5">
      <div className="font-mono text-[9px] font-bold tracking-[0.18em] uppercase text-white/35">
        your crew
      </div>
      {FRIENDS.map((friend) => (
        <FriendCard key={friend.id} friend={friend} onToast={onToast} />
      ))}
      <div className="rounded-2xl border border-grvd-purple/20 bg-grvd-purple/8 px-3 py-2.5 font-mono text-[10px] text-white/45 leading-relaxed shadow-chunky-press">
        🗺️ to co-create, you gotta be at the same spot in the game.
        invite them to your studio or pull up to theirs.
      </div>
    </div>
  );
}

function FriendCard({ friend, onToast }: { friend: typeof FRIENDS[number]; onToast: (msg: string) => void }) {
  const dotColor: Record<FriendStatus, string> = {
    active:  "#4ade80",
    nearby:  "#fbbf24",
    offline: "rgba(255,255,255,0.18)",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-white/8 bg-white/3 px-3 py-2.5 shadow-chunky-press hover:border-grvd-purple/40 transition-colors">
      <div
        className="w-11 h-11 rounded-full bg-grvd-purple/20 border-2 border-grvd-purple/35 flex items-center justify-center text-2xl shrink-0"
        style={{ boxShadow: "0 0 10px rgba(167,139,250,0.25), inset 0 1px 0 rgba(255,255,255,0.15)" }}
      >
        {friend.avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-base text-white leading-none">
          {friend.name}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <div
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: dotColor[friend.online],
              boxShadow: friend.online !== "offline" ? `0 0 6px ${dotColor[friend.online]}` : "none",
            }}
          />
          <span className="font-mono text-[10px] text-white/45 truncate">
            {friend.status}
          </span>
        </div>
      </div>
      {friend.online !== "offline" ? (
        <div className="flex flex-col gap-1 shrink-0">
          <ChunkyPill variant="purple" size="sm" onClick={() => onToast(`📍 invite sent to ${friend.name}`)}>
            invite 📍
          </ChunkyPill>
          <ChunkyPill variant="ghost" size="sm" onClick={() => onToast(`🚶 pulling up to ${friend.name}…`)}>
            follow 🚶
          </ChunkyPill>
        </div>
      ) : (
        <div className="font-mono text-[9px] font-bold tracking-[0.1em] uppercase text-white/20">
          offline
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Pitch waveform                                                                */
/* -------------------------------------------------------------------------- */

function PitchBar({ contour, score }: { contour: number[]; score: number }) {
  if (!contour.length) return null;
  const voiced = contour.filter((n) => n > 0);
  const min    = voiced.length ? Math.min(...voiced) : 60;
  const max    = voiced.length ? Math.max(...voiced) : 72;
  const range  = Math.max(6, max - min);
  return (
    <div style={{ width: "100%" }}>
      <div style={{
        height: 48, background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 10, display: "flex", alignItems: "flex-end",
        gap: 1.5, padding: "4px 6px", overflow: "hidden",
      }}>
        {contour.map((n, i) =>
          n < 0 ? (
            <div key={i} style={{ width: 2, height: 4, background: "rgba(255,255,255,0.1)", borderRadius: 1, flexShrink: 0 }} />
          ) : (
            <div key={i} style={{
              width: 2, height: Math.max(4, ((n - min) / range) * 36), flexShrink: 0,
              background: isOnKey(n) ? "#4ade80" : "#f87171",
              borderRadius: 1,
              boxShadow: isOnKey(n) ? "0 0 3px rgba(74,222,128,0.5)" : "none",
            }} />
          )
        )}
      </div>
      <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
        <span>in-key 🟢</span><span>off-key 🔴</span><span>score: {score}/100</span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Recording dot                                                                  */
/* -------------------------------------------------------------------------- */

function RecordingDot() {
  return (
    <div style={{ position: "relative", width: 10, height: 10 }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: "#f87171",
        boxShadow: "0 0 8px #f87171",
        animation: "recPulse 0.8s ease-in-out infinite alternate",
      }} />
      <style>{`@keyframes recPulse { from{opacity:1;transform:scale(1)} to{opacity:0.5;transform:scale(0.8)} }`}</style>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                       */
/* -------------------------------------------------------------------------- */

function scoreContour(contour: number[], _key: string): number {
  const voiced = contour.filter((n) => n > 0);
  if (!voiced.length) return 0;
  const onKey = voiced.filter(isOnKey).length;
  return Math.round(40 + (onKey / voiced.length) * 60);
}

function isOnKey(midi: number): boolean {
  const pc = ((midi % 12) + 12) % 12;
  return [9, 0, 2, 4, 7].includes(pc);
}

function verdict(score: number): string {
  if (score >= 88) return "🔥 you cooked. that's a certified hit.";
  if (score >= 75) return "💿 solid flow. TikTok would eat this up.";
  if (score >= 58) return "🎧 got something there. keep refining.";
  return "💜 you tried. growth is in the reps.";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#4ade80";
  if (score >= 60) return "#facc15";
  return "#a78bfa";
}

/* -------------------------------------------------------------------------- */
/* Shared styles                                                                 */
/* -------------------------------------------------------------------------- */

/* legacy inline-style helpers removed — every interactive surface in this
 * file now uses ChunkyButton / ChunkyPill from ../ui/Chunky. */
