/**
 * Crib — the not-actively-producing welcome screen, UI-v1 game-feel rebuild.
 *
 * In the wider game this is the character's bedroom background. Here it's
 * the chill state — the DAW is asleep, you can pet it via care buttons,
 * or pull it out to start cooking. The first-session view nudges the
 * 60-second challenge harder; returning users see a clean primary CTA.
 *
 * The mood line still pumps into the AvatarPuck's TalkBubble via sayLine.
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { NeedsMeters } from "./NeedsMeters";
import { ChunkyButton, ChunkyPill, ChunkyBadge } from "../ui/Chunky";
import { CharacterFace } from "../ui/CharacterFace";

export function Crib() {
  const { tamagotchi, setStage, feedNeed, inventory, toggleLogbook, sayLine } =
    useStore();
  const mood = tamagotchi.mood;
  const isFirstSession = inventory.length === 0;

  const talkLines: Record<typeof mood, string> = {
    asleep: "...",
    sleepy: "mmh... pull me out when you're ready",
    chill:  "wanna cook something up?",
    happy:  "let's gooo — I got ideas",
    hyped:  "PULL ME OUT PULL ME OUT — bangers today",
    sad:    "been a minute... you good?",
    lonely: "take me somewhere. let's see some people.",
  };

  // Push the mood line into the AvatarPuck's TalkBubble. Persists while
  // on the crib — cleared on unmount.
  useEffect(() => {
    sayLine(talkLines[mood]);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, sayLine]);

  return (
    <div className="pt-3 pb-8 flex flex-col gap-5">
      {/* Hero: live character — the player IS the pet, again. */}
      <div className="flex flex-col items-center gap-3 mt-2">
        <CharacterFace size={160} />
        <ChunkyBadge variant="ghost" size="sm">
          {mood === "asleep" ? "💤 asleep" :
           mood === "sleepy" ? "🥱 sleepy" :
           mood === "happy"  ? "😊 happy"  :
           mood === "hyped"  ? "🔥 hyped"  :
           mood === "sad"    ? "🥲 sad"    :
           mood === "lonely" ? "🫥 lonely" :
                               "😎 chill"}
        </ChunkyBadge>
      </div>

      {/* Companion needs */}
      <NeedsMeters tam={tamagotchi} />

      {/* Care row — quick-feed pills */}
      <div className="flex gap-2 justify-center">
        <ChunkyPill variant="cyan"    size="sm" icon="💬" onClick={() => feedNeed("social", 10)}>
          chat
        </ChunkyPill>
        <ChunkyPill variant="purple"  size="sm" icon="🎨" onClick={() => feedNeed("creativity", 10)}>
          spark
        </ChunkyPill>
        <ChunkyPill variant="gold"    size="sm" icon="⚡"  onClick={() => feedNeed("energy", 15)}>
          juice
        </ChunkyPill>
      </div>

      {/* Hero CTA — first-session gets the 60-second nudge, returning gets a clean
          "cook something" call. */}
      {isFirstSession ? (
        <div className="rounded-3xl border-2 border-grvd-magenta/40 bg-gradient-to-br from-grvd-magenta/15 to-grvd-purple/10 p-5 flex flex-col gap-3 shadow-chunky-press">
          <div className="font-display text-2xl text-white leading-tight">
            ⏱ can you finish in 60s?
          </div>
          <div className="font-mono text-[11px] text-white/55 leading-relaxed">
            pick a vibe → stack sounds → name it
          </div>
          <ChunkyButton
            variant="hero"
            size="lg"
            icon="🎛️"
            onClick={() => setStage("template")}
            className="w-full"
          >
            start the clock
          </ChunkyButton>
        </div>
      ) : (
        <ChunkyButton
          variant="hero"
          size="lg"
          icon="🎛️"
          onClick={() => setStage("template")}
          className="w-full"
        >
          cook something up
        </ChunkyButton>
      )}

      {/* Secondary nav */}
      <div className="flex gap-2">
        <ChunkyPill variant="ghost" size="md" icon="🤝" onClick={() => setStage("coop")} className="flex-1">
          coop
        </ChunkyPill>
        <ChunkyPill variant="ghost" size="md" icon="📓" onClick={toggleLogbook} className="flex-1">
          logbook{inventory.length > 0 && ` · ${inventory.length}`}
        </ChunkyPill>
      </div>
    </div>
  );
}
