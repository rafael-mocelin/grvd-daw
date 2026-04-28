/**
 * Pet — UI v1 portal page.
 *
 * Tap the AvatarPuck in the HUD → land here. The puck's tiny face becomes
 * a full-screen character with bigger expressive eyes + the live mouth
 * waveform reused at full scale. The needs meters + feed actions live
 * here too, freeing the rest of the app from carrying them.
 *
 * This is the "C" in B+C: the pet stays alive in the corner (the puck)
 * AND has a destination where you can actually visit it.
 *
 * Forward-looking: when the designer ships an illustrated character, the
 * <BigFace> swap happens in this file. The HUD puck stays small/abstract;
 * this page shows the real character.
 */

import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import { ChunkyPill, ChunkyButton } from "../ui/Chunky";
import { useAudioLevel } from "../hooks/useAudioLevel";
import { MouthWave } from "./MouthWave";
import { NeedsMeters } from "./NeedsMeters";
import type { Mood, Need } from "../data/types";

const MOOD_LABEL: Record<Mood, string> = {
  happy:  "happy",
  hyped:  "hyped",
  chill:  "chill",
  sad:    "sad",
  lonely: "lonely",
  sleepy: "sleepy",
  asleep: "asleep",
};

const MOOD_TINT: Record<Mood, string> = {
  happy:  "from-grvd-purple to-grvd-magenta",
  hyped:  "from-grvd-magenta to-grvd-orange",
  chill:  "from-grvd-purple to-grvd-cyan",
  sad:    "from-grvd-line to-grvd-purple",
  lonely: "from-grvd-line to-grvd-purple",
  sleepy: "from-grvd-base to-grvd-line",
  asleep: "from-grvd-base to-grvd-base",
};

const EYE_OPEN: Record<Mood, number> = {
  happy: 1.0, hyped: 1.0, chill: 0.85, sad: 0.7,
  lonely: 0.7, sleepy: 0.35, asleep: 0.0,
};

const FEED_ACTIONS: { need: Need; label: string; icon: string; amount: number }[] = [
  { need: "social",     label: "say hi",  icon: "💬", amount: 12 },
  { need: "creativity", label: "doodle",  icon: "🎨", amount: 12 },
  { need: "energy",     label: "snack",   icon: "🍩", amount: 12 },
];

export function Pet() {
  const tamagotchi    = useStore((s) => s.tamagotchi);
  const moodOverride  = useStore((s) => s.moodOverride);
  const setStage      = useStore((s) => s.setStage);
  const feedNeed      = useStore((s) => s.feedNeed);

  const mood: Mood = moodOverride ?? tamagotchi.mood;
  const audioLevel = useAudioLevel();

  // Big-face cursor tracking + audio-amped expression.
  // Same pattern as AvatarPuck but at 240px instead of 56px so the
  // character feels expressive. Pupils have more travel room here.
  const wrapperRef    = useRef<HTMLDivElement | null>(null);
  const leftPupilRef  = useRef<SVGCircleElement | null>(null);
  const rightPupilRef = useRef<SVGCircleElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    let cursorX = 0, cursorY = 0;
    const onMove = (e: PointerEvent) => { cursorX = e.clientX; cursorY = e.clientY; };
    window.addEventListener("pointermove", onMove, { passive: true });

    const tick = () => {
      if (cancelled) return;
      const w = wrapperRef.current;
      if (w) {
        const rect = w.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top  + rect.height / 2;
        let dx = cursorX - cx;
        let dy = cursorY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const r = Math.min(8, dist / 30);
        dx = (dx / dist) * r;
        dy = (dy / dist) * r;
        leftPupilRef.current?.setAttribute( "transform", `translate(${dx} ${dy})`);
        rightPupilRef.current?.setAttribute("transform", `translate(${dx} ${dy})`);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelled = true; cancelAnimationFrame(raf); window.removeEventListener("pointermove", onMove); };
  }, []);

  const eyeOpen = EYE_OPEN[mood];

  return (
    <div className="pt-2 pb-8 flex flex-col items-center gap-6">
      <div className="w-full flex items-center justify-between">
        <ChunkyPill onClick={() => setStage("home")} icon="←" size="sm">
          back
        </ChunkyPill>
        <span className="font-display text-grvd-purple text-[11px] tracking-widest uppercase">
          your pet
        </span>
        <span className="w-12" />  {/* spacer for symmetry */}
      </div>

      {/* Big character */}
      <div
        ref={wrapperRef}
        className={[
          "relative w-[240px] h-[240px] rounded-full",
          "bg-gradient-to-br", MOOD_TINT[mood],
          "shadow-chunky animate-puck-bob",
          "flex items-center justify-center",
        ].join(" ")}
      >
        <svg viewBox="0 0 24 24" className="w-full h-full">
          {/* Eyes — bigger sclera + larger pupil-travel range */}
          <ellipse cx="9"  cy="11" rx="2.4" ry={2.4 * eyeOpen} fill="#fff" />
          <ellipse cx="15" cy="11" rx="2.4" ry={2.4 * eyeOpen} fill="#fff" />
          {eyeOpen > 0 && (
            <>
              <circle ref={leftPupilRef}  cx="9"  cy="11" r="1.1" fill="#0a0814" />
              <circle ref={rightPupilRef} cx="15" cy="11" r="1.1" fill="#0a0814" />
            </>
          )}
          {mood === "asleep" && (
            <text x="18" y="6" fontSize="6" fill="#fff" opacity="0.8">z</text>
          )}
        </svg>
      </div>

      {/* Mood label */}
      <div className="text-center">
        <div className="font-display text-3xl text-white tracking-wide">
          {MOOD_LABEL[mood]}
        </div>
        <div className="font-sans text-grvd-purple/80 text-xs tracking-widest uppercase mt-1">
          streak · {tamagotchi.streakDays}d
        </div>
      </div>

      {/* Live mouth waveform — kept at full scale here as an "audio
       *  monitor" for whatever's playing. */}
      <div
        className={[
          "w-full max-w-[320px] h-16 rounded-2xl",
          "bg-grvd-base/60 border border-grvd-line",
          "shadow-chunky-press p-2",
        ].join(" ")}
      >
        <MouthWave
          mood={mood}
          color="#a78bfa"
          width={320}
          height={56}
          talk={null}
        />
      </div>
      {/* Suppress unused-warning for audioLevel — MouthWave reads from the
       *  master analyser directly, but we still expose the hook here in
       *  case future treatments want it. */}
      {void audioLevel}

      {/* Needs meters */}
      <div className="w-full px-2">
        <NeedsMeters tam={tamagotchi} />
      </div>

      {/* Feed actions */}
      <div className="w-full flex flex-wrap items-center justify-center gap-2 px-2">
        {FEED_ACTIONS.map((a) => (
          <ChunkyButton
            key={a.need}
            variant="purple"
            size="sm"
            icon={a.icon}
            onClick={() => feedNeed(a.need, a.amount)}
          >
            {a.label}
          </ChunkyButton>
        ))}
      </div>
    </div>
  );
}
