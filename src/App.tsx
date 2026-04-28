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
import { Studio } from "./components/Studio";
import { Coop } from "./components/Coop";
import { Pet } from "./components/Pet";
import { PageShell } from "./ui/PageShell";
import { StackingView } from "./components/StackingView";
import { VocalRecorder } from "./components/VocalRecorder";
import { NameAndSave } from "./components/NameAndSave";
import { ArrangeView } from "./components/ArrangeView";
import { MixerView } from "./components/MixerView";
import { XPFlash } from "./components/XPFlash";
import { AchievementToast } from "./components/AchievementToast";
import { AuthScreen } from "./components/AuthScreen";
import { AdminPanel } from "./components/AdminPanel";
import { CoopCursors } from "./components/CoopCursors";
import { NotificationToasts } from "./components/NotificationToasts";
import { loadSamples } from "./audio/engine";
import { useAuth } from "./lib/auth";
import { useSync } from "./lib/useSync";
import { useCoopSession } from "./lib/coop-db";

/* Slice 1 (manifesto rule #1) — the infinite-canvas framing was deleted.
 * Stack / Vocal / Name / Arrange / Mixer are now their own dedicated
 * step-through pages routed below, just like every other stage.
 */

/** Inner app — rendered for both signed-in users AND guests. */
function AppCore() {
  const {
    stage, showLogbook,
    applyDailyDecay, setUserId,
    activeCoopSessionId, applyCoopSharedState, setActiveCoopRow,
    loadInventory, ensureCoopUnionSounds,
  } = useStore();
  const { user } = useAuth();
  const [samplesReady, setSamplesReady] = useState(false);

  /* Phase 4.2 — coop sync.
   *
   * One subscription, one place. Subscribes to the active coop session at
   * the top of the app so:
   *   1. Shared DAW state reaches the store regardless of which screen is
   *      mounted (applyCoopSharedState mirrors stage/template/layers/etc.).
   *   2. Downstream components (Coop, etc.) read the cached row from the
   *      store via setActiveCoopRow instead of opening their own
   *      duplicate subscription.
   * isApplyingCoopState flips during the apply so wrapped store actions
   * don't bounce the same patch back to the server. */
  useCoopSession(activeCoopSessionId, (row) => {
    setActiveCoopRow(row);
    if (row?.state) applyCoopSharedState(row.state as Record<string, unknown>);
    // Phase 5.B step 7 — when the union snapshot is present, register any
    // partner-only producer drops with the audio engine so the local
    // picker can preview / play them during the session.
    if (row?.availableSoundIds?.length) {
      ensureCoopUnionSounds(row.availableSoundIds);
    }
  });

  // Keep userId in the store so finalizeSong can upsert without importing auth.
  // For guests this will be null, and db writes are no-ops everywhere.
  useEffect(() => {
    setUserId(user?.id ?? null);
  }, [user, setUserId]);

  // Phase 5.B step 6 — load + register the user's sound inventory once we
  // know who they are. Drives the DAW picker filter and registers any
  // producer drops with the audio engine.
  useEffect(() => {
    loadInventory();
  }, [user, loadInventory]);

  useEffect(() => {
    applyDailyDecay();
    loadSamples().then(() => setSamplesReady(true));
  }, [applyDailyDecay]);

  // Load + sync user data to/from Supabase. useSync no-ops when user is null
  // (guest mode), so calling it here unconditionally is safe.
  useSync();

  return (
    <>
      <PageShell>
        {/* Tiny sample-loading banner */}
        {!samplesReady && (
          <div
            className="text-center py-1 text-[9px] font-mono text-yellow-400/60 bg-yellow-400/5"
          >
            loading samples…
          </div>
        )}

        {/* Every stage routes to its own dedicated page — no infinite canvas */}
        {stage === "home"        && <Home />}
        {stage === "crib"        && <Crib />}
        {stage === "template"    && <TemplatePicker />}
        {stage === "stack"       && <StackingView />}
        {stage === "vocal"       && <VocalRecorder />}
        {stage === "name"        && <NameAndSave />}
        {stage === "done"        && <Done />}
        {stage === "arrange"     && <ArrangeView />}
        {stage === "mixer"       && <MixerView />}
        {stage === "booth"       && <ListeningBooth />}
        {stage === "leaderboard" && <Leaderboard />}
        {stage === "profile"     && <Profile />}
        {stage === "friends"     && <Friends />}
        {stage === "studio"      && <Studio />}
        {stage === "coop"        && <Coop />}
        {stage === "pet"         && <Pet />}

        {showLogbook && <Logbook />}
      </PageShell>

      {/* Global overlays — rendered via portals to document.body */}
      <XPFlash />
      <AchievementToast />
      {/* Admin-only debug panel (no-op for non-admin users) */}
      <AdminPanel />
      {/* Phase 4.3 — other seats' cursors while in an active coop session.
       * Renders nothing when there's no session or no peers (zero cost). */}
      <CoopCursors />
      {/* Phase 6 — stacked toast feed for incoming notifications. Subscribes
       * to Supabase Realtime on the notifications table for the current
       * user; renders nothing when there's no signed-in user or no toasts. */}
      <NotificationToasts />
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
