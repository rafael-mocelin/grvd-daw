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

import { useStore } from "../store/useStore";
import { ChunkyPill, ChunkyButton } from "../ui/Chunky";
import { CharacterFace } from "../ui/CharacterFace";
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

      {/* Big character — shared CharacterFace at 240px */}
      <CharacterFace size={240} />

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
