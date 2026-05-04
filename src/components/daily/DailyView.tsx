/**
 * DailyView — entrypoint for the Daily Drop game mode.
 *
 * Internally routes through three sub-screens (prompt → cook → submit).
 * State lives in useDailyStore (see src/lib/dailyStore.ts) so this
 * component is mostly a switch.
 *
 * Why internal sub-state instead of new global stages: keeps the
 * prototype self-contained — only one new "daily" stage is added to the
 * main store's Stage union; everything inside is local to this view.
 */

import { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useDailyStore } from "../../lib/dailyStore";
import { clearAllLayers } from "../../audio/dailyEngine";
import { DailyPrompt } from "./DailyPrompt";
import { DailyCook } from "./DailyCook";
import { DailySubmit } from "./DailySubmit";

export function DailyView() {
  const phase    = useDailyStore((s) => s.phase);
  const setPhase = useDailyStore((s) => s.setPhase);
  const stopTimer = useDailyStore((s) => s.stopTimer);
  const clearPicks = useDailyStore((s) => s.clearPicks);
  const hydrate    = useDailyStore((s) => s.hydrate);
  const setStage   = useStore((s) => s.setStage);

  // Hydrate persisted streak / lastSubmitDate from localStorage on mount.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Hard cleanup when the user leaves the daily flow entirely.
  useEffect(() => {
    return () => {
      stopTimer();
      clearAllLayers();
    };
  }, [stopTimer]);

  function handleQuit() {
    stopTimer();
    clearAllLayers();
    clearPicks();
    setPhase("prompt");
    setStage("home");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0f1c",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#fff",
      }}
    >
      {phase === "prompt" && <DailyPrompt onStart={() => setPhase("cook")} onQuit={handleQuit} />}
      {phase === "cook"   && <DailyCook   onWrap={() => setPhase("submit")} onQuit={handleQuit} />}
      {phase === "submit" && <DailySubmit onExit={handleQuit} />}
    </div>
  );
}
