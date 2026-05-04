/**
 * RunView — entrypoint for Studio Run.
 *
 * Routes through stages by reading currentStage from useRunStore. The
 * map header at the top shows progress; the body switches between the
 * draw screen and the boss summary.
 *
 * Lifecycle: beginRun() runs on mount so re-entries always start fresh.
 * The runEngine's audio is killed on unmount and on quit.
 */

import { useEffect } from "react";
import { useStore } from "../../store/useStore";
import { useRunStore } from "../../lib/runStore";
import { clearAllLayers } from "../../audio/runEngine";
import { RunMap } from "./RunMap";
import { StageDraw } from "./StageDraw";
import { RunSummary } from "./RunSummary";

export function RunView() {
  const setStage      = useStore((s) => s.setStage);
  const currentStage  = useRunStore((s) => s.currentStage);
  const beginRun      = useRunStore((s) => s.beginRun);
  const hydrate       = useRunStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    beginRun();
    return () => { clearAllLayers(); };
  }, [hydrate, beginRun]);

  function handleQuit() {
    clearAllLayers();
    setStage("home");
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0f1c",
        zIndex: 50,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <RunMap onQuit={handleQuit} />
      {currentStage === "boss"
        ? <RunSummary onExit={handleQuit} />
        : <StageDraw />}
    </div>
  );
}
