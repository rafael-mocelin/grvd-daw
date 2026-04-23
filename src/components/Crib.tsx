import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { NeedsMeters } from "./NeedsMeters";

/**
 * The "crib" screen — what the player sees when they're not actively
 * producing. In the game this is the background of the character's
 * bedroom; here it's the welcome state. Pulls the DAW out of sleep.
 */
export function Crib() {
  const { tamagotchi, setStage, feedNeed, inventory, toggleLogbook, sayLine } =
    useStore();
  const mood = tamagotchi.mood;
  const isFirstSession = inventory.length === 0;

  const talkLines: Record<typeof mood, string> = {
    asleep: "...",
    sleepy: "mmh... pull me out when you're ready",
    chill: "wanna cook something up?",
    happy: "let's gooo — I got ideas",
    hyped: "PULL ME OUT PULL ME OUT — bangers today",
    sad: "been a minute... you good?",
    lonely: "take me somewhere. let's see some people.",
  };

  // Push the mood line into the DAW's "mouth" speech bubble at the bottom
  // of the shell. Persists while on the crib — cleared on unmount.
  useEffect(() => {
    sayLine(talkLines[mood]);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, sayLine]);

  return (
    <div className="flex flex-col items-center gap-5 p-4 pt-5">
      <NeedsMeters tam={tamagotchi} />

      {/* Care buttons */}
      <div className="flex gap-2 justify-center">
        <button className="btn-ghost text-[11px]" onClick={() => feedNeed("social", 10)}>💬</button>
        <button className="btn-ghost text-[11px]" onClick={() => feedNeed("creativity", 10)}>🎨</button>
        <button className="btn-ghost text-[11px]" onClick={() => feedNeed("energy", 15)}>⚡</button>
      </div>

      {/* 60-second challenge / main CTA */}
      {isFirstSession ? (
        <div className="card p-4 w-full border-accent/40 shadow-glow">
          <div className="text-accent font-display font-bold text-sm mb-1">
            ⏱ can you finish in 60s?
          </div>
          <div className="text-[10px] font-mono text-white/50 mb-3">
            pick a vibe → stack sounds → name it
          </div>
          <button className="btn-primary w-full text-sm" onClick={() => setStage("template")}>
            🎛️ start the clock
          </button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setStage("template")}>
          🎛️ cook something up
        </button>
      )}

      <div className="flex gap-2 w-full">
        <button className="btn-ghost text-xs flex-1" onClick={() => setStage("coop")}>
          🤝 coop
        </button>
        <button className="btn-ghost text-xs flex-1" onClick={toggleLogbook}>
          📓 logbook {inventory.length > 0 && `(${inventory.length})`}
        </button>
      </div>
    </div>
  );
}
