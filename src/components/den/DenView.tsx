/**
 * DenView — entrypoint for the DEN flow.
 *
 * If currentStation is null, render the lobby (DenLobby — the room
 * with the 4 character stations). Otherwise render the active
 * station component.
 *
 * The library panel mounts as an overlay when toggled from the lobby.
 */

import { useEffect, useState } from "react";
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
    return () => { resetDenAudio(); };
  }, [hydrate]);

  function handleQuit() {
    resetDenAudio();
    exitStation();
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
}
