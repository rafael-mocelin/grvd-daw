/**
 * DenView — entrypoint for the DEN flow.
 *
 * If currentStation is null, render the lobby (DenLobby — the room
 * with the 4 character stations). Otherwise render the active
 * station component.
 *
 * The library panel mounts as an overlay when toggled from the lobby.
 *
 * Renders via a React Portal directly to document.body so the Den
 * UI escapes PageShell's `<main>` stacking context (which sits at z-10
 * and contains anything we render inside, no matter how high its
 * own z-index). Without the portal, the global Hud at z-30 paints over
 * the Den's top bar even if the Den's wrapper is z-100+.
 */

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../../store/useStore";
import { useDenStore } from "../../lib/denStore";
import { resetDenAudio } from "../../audio/denEngine";
import { DenLobby } from "./DenLobby";
import { DrummaStation } from "./stations/DrummaStation";
import { StubStation } from "./stations/StubStation";
import { LibraryPanel } from "./LibraryPanel";

export function DenView() {
  const setStage       = useStore((s) => s.setStage);
  const currentStation = useDenStore((s) => s.currentStation);
  const exitStation    = useDenStore((s) => s.exitStation);
  const hydrate        = useDenStore((s) => s.hydrate);
  const [libraryOpen, setLibraryOpen] = useState(false);

  useEffect(() => {
    hydrate();
    return () => {
      // Hard cleanup on unmount: stop audio AND reset the active station
      // back to the lobby. Without resetting currentStation, leaving the
      // Den (e.g. via the home button or any other navigation) and then
      // re-entering would drop the player back into whatever station
      // they were last in instead of the lobby.
      resetDenAudio();
      exitStation();
    };
  }, [hydrate, exitStation]);

  function handleQuit() {
    resetDenAudio();
    exitStation();
    setStage("home");
  }

  const content = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0f1c",
        // High enough to sit above any sticky header in the page shell.
        // Combined with the portal-to-body below, this guarantees the
        // Den UI fully takes over the screen.
        zIndex: 1000,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {currentStation === null && (
        <DenLobby
          onQuit={handleQuit}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
      )}

      {currentStation === "mochi" && (
        <DrummaStation onExit={() => exitStation()} />
      )}

      {currentStation === "neema" && (
        <StubStation
          characterId="neema"
          onExit={() => exitStation()}
        />
      )}
      {currentStation === "royal" && (
        <StubStation
          characterId="royal"
          onExit={() => exitStation()}
        />
      )}
      {currentStation === "mixx" && (
        <StubStation
          characterId="mixx"
          onExit={() => exitStation()}
        />
      )}

      {libraryOpen && (
        <LibraryPanel onClose={() => setLibraryOpen(false)} />
      )}
    </div>
  );

  // Portal to document.body so the Den escapes PageShell's <main>
  // stacking context — otherwise the global HUD (sticky top-0 z-30)
  // paints on top of the Den's own header even at very high z-index.
  return createPortal(content, document.body);
}
