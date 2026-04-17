import { useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import { Crib } from "./components/Crib";
import { TemplatePicker } from "./components/TemplatePicker";
import { Done } from "./components/Done";
import { Logbook } from "./components/Logbook";
import { ListeningBooth } from "./components/ListeningBooth";
import { Coop } from "./components/Coop";
import { DeviceShell } from "./components/DeviceShell";
import { CanvasBoard } from "./components/CanvasBoard";
import { XPFlash } from "./components/XPFlash";
import { AchievementToast } from "./components/AchievementToast";
import { AuthScreen } from "./components/AuthScreen";
import { loadSamples } from "./audio/engine";
import { useAuth } from "./lib/auth";
import { useSync } from "./lib/useSync";

/**
 * CANVAS_STAGES — these stages render through the infinite canvas (CanvasBoard).
 * CanvasBoard internally renders StackingView / VocalRecorder / NameAndSave
 * inside a Recipe window, plus Arrange and Mixer windows once the recipe is done.
 */
const CANVAS_STAGES = new Set(["stack", "vocal", "name"]);

/** Inner app — only rendered when the user is authenticated. */
function AuthenticatedApp() {
  const { stage, showLogbook, applyDailyDecay, setUserId } = useStore();
  const { user } = useAuth();
  const [samplesReady, setSamplesReady] = useState(false);

  // Keep userId in the store so finalizeSong can upsert without importing auth
  useEffect(() => {
    setUserId(user?.id ?? null);
  }, [user, setUserId]);

  useEffect(() => {
    applyDailyDecay();
    loadSamples().then(() => setSamplesReady(true));
  }, [applyDailyDecay]);

  // Load + sync user data to/from Supabase
  useSync();

  return (
    <>
      <DeviceShell>
        {/* Tiny sample-loading banner */}
        {!samplesReady && (
          <div
            className="text-center py-1 text-[9px] font-mono text-yellow-400/60 bg-yellow-400/5"
          >
            loading samples…
          </div>
        )}

        {/* Canvas stages (stack / vocal / name) render via CanvasBoard */}
        {CANVAS_STAGES.has(stage) && <CanvasBoard />}

        {/* Full-screen single-view stages */}
        {stage === "crib"     && <Crib />}
        {stage === "template" && <TemplatePicker />}
        {stage === "done"     && <Done />}
        {stage === "booth"    && <ListeningBooth />}
        {stage === "coop"     && <Coop />}

        {showLogbook && <Logbook />}
      </DeviceShell>

      {/* Global overlays — rendered via portals to document.body */}
      <XPFlash />
      <AchievementToast />
    </>
  );
}

/** Root — shows AuthScreen until the user is logged in. */
export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: "100dvh",
        background: "#0a0a0f",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        fontSize: 12,
        color: "rgba(255,255,255,0.3)",
      }}>
        loading…
      </div>
    );
  }

  if (!user) return <AuthScreen />;
  return <AuthenticatedApp />;
}
