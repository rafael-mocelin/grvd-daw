import { useEffect, useState } from "react";
import { useStore } from "./store/useStore";
import { Home } from "./components/Home";
import { Crib } from "./components/Crib";
import { TemplatePicker } from "./components/TemplatePicker";
import { Done } from "./components/Done";
import { Logbook } from "./components/Logbook";
import { ListeningBooth } from "./components/ListeningBooth";
import { Leaderboard } from "./components/Leaderboard";
import { Profile } from "./components/Profile";
import { Friends } from "./components/Friends";
import { Coop } from "./components/Coop";
import { DeviceShell } from "./components/DeviceShell";
import { CanvasBoard } from "./components/CanvasBoard";
import { XPFlash } from "./components/XPFlash";
import { AchievementToast } from "./components/AchievementToast";
import { AuthScreen } from "./components/AuthScreen";
import { AdminPanel } from "./components/AdminPanel";
import { CoopCursors } from "./components/CoopCursors";
import { loadSamples } from "./audio/engine";
import { useAuth } from "./lib/auth";
import { useSync } from "./lib/useSync";
import { useCoopSession } from "./lib/coop-db";

/**
 * CANVAS_STAGES — these stages render through the infinite canvas (CanvasBoard).
 * CanvasBoard internally renders StackingView / VocalRecorder / NameAndSave
 * inside a Recipe window, plus Arrange and Mixer windows once the recipe is done.
 */
const CANVAS_STAGES = new Set(["stack", "vocal", "name"]);

/** Inner app — rendered for both signed-in users AND guests. */
function AppCore() {
  const {
    stage, showLogbook,
    applyDailyDecay, setUserId, setSkin,
    activeCoopSessionId, applyCoopSharedState,
  } = useStore();
  const { user } = useAuth();
  const [samplesReady, setSamplesReady] = useState(false);

  /* Phase 4.2 — coop sync.
   *
   * Subscribes to the currently-active coop session (if any) at the
   * top of the app so shared DAW state reaches the store regardless
   * of which screen is mounted. `onRowChange` fires every time the
   * server row updates (from our own writes + partner's writes);
   * applyCoopSharedState narrows the remote state blob down to the
   * fields we mirror locally (template/layers/stage/etc.) and sets
   * them, flipping isApplyingCoopState so the wrapped store actions
   * don't bounce the same patch back to the server. */
  useCoopSession(activeCoopSessionId, (row) => {
    if (row?.state) applyCoopSharedState(row.state as Record<string, unknown>);
  });

  // Keep userId in the store so finalizeSong can upsert without importing auth.
  // For guests this will be null, and db writes are no-ops everywhere.
  useEffect(() => {
    setUserId(user?.id ?? null);
  }, [user, setUserId]);

  // Hydrate the saved skin choice from localStorage on mount. Pure cosmetic
  // pref, so browser-local persistence is enough — see note on setSkin.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("grvd-skin");
      if (saved && ["void", "sakura", "chrome", "forest", "gold"].includes(saved)) {
        setSkin(saved as never);
      }
    } catch {
      /* private mode / quota errors — fail silently */
    }
  }, [setSkin]);

  useEffect(() => {
    applyDailyDecay();
    loadSamples().then(() => setSamplesReady(true));
  }, [applyDailyDecay]);

  // Load + sync user data to/from Supabase. useSync no-ops when user is null
  // (guest mode), so calling it here unconditionally is safe.
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
        {stage === "home"     && <Home />}
        {stage === "crib"     && <Crib />}
        {stage === "template" && <TemplatePicker />}
        {stage === "done"     && <Done />}
        {stage === "booth"       && <ListeningBooth />}
        {stage === "leaderboard" && <Leaderboard />}
        {stage === "profile"     && <Profile />}
        {stage === "friends"     && <Friends />}
        {stage === "coop"        && <Coop />}

        {showLogbook && <Logbook />}
      </DeviceShell>

      {/* Global overlays — rendered via portals to document.body */}
      <XPFlash />
      <AchievementToast />
      {/* Admin-only debug panel (no-op for non-admin users) */}
      <AdminPanel />
      {/* Phase 4.3 — other seats' cursors while in an active coop session.
       * Renders nothing when there's no session or no peers (zero cost). */}
      <CoopCursors />
    </>
  );
}

/** Root — shows AuthScreen until the user is logged in OR a guest session starts. */
export default function App() {
  const { user, loading, isGuest } = useAuth();

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

  // Gate: must be a real user OR an active guest session.
  if (!user && !isGuest) return <AuthScreen />;
  return <AppCore />;
}
