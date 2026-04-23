import { useEffect, useRef } from "react";
import { useStore, ENERGY_COSTS, computeLiveEnergy } from "../store/useStore";
import { playSong, stopSong } from "../audio/engine";

/**
 * Celebration screen after saving a song. The DAW reacts — this is the
 * emotional payoff that makes saving feel like an achievement.
 * Also shows elapsed time vs. the 60-second promise.
 */
export function Done() {
  const {
    inventory, setStage, tamagotchi, reset, vocalBuffer,
    sessionStartedAt, sayLine,
    publishSong, publishingSongId, energy, energyUpdatedAt,
  } = useStore();
  const latest = inventory[0];
  const autoPlayed = useRef(false);

  // Capture elapsed seconds at the moment Done mounts (timer is now frozen)
  const elapsedRef = useRef<number>(
    sessionStartedAt ? Math.floor((Date.now() - sessionStartedAt) / 1000) : 0
  );
  const elapsed = elapsedRef.current;

  useEffect(() => {
    if (latest && !autoPlayed.current) {
      autoPlayed.current = true;
      playSong(latest, vocalBuffer).catch(() => {});
    }
    return () => stopSong();
  }, [latest, vocalBuffer]);

  const talkLine =
    elapsed <= 45  ? "speed run. elite." :
    elapsed <= 60  ? "that's a banger. for real." :
    elapsed <= 90  ? "good one. almost got the speed." :
                     "that's a vibe. took your time.";

  // Push the celebration line into the DAW mouth bubble; clears on unmount.
  // Declared BEFORE any early return so hook order stays stable.
  useEffect(() => {
    if (!latest) return;
    sayLine(talkLine);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talkLine, latest]);

  if (!latest) return null;

  const speedResult =
    elapsed <= 45  ? { label: "SPEED RUN 🔥",   color: "text-green-400",  msg: `${elapsed}s — under 45!` } :
    elapsed <= 60  ? { label: "UNDER 60 ✓",      color: "text-accent",     msg: `${elapsed}s — nailed it` } :
    elapsed <= 90  ? { label: "CLOSE",           color: "text-yellow-400", msg: `${elapsed}s — almost there` } :
                     { label: "TAKE YOUR TIME",  color: "text-white/60",   msg: `${elapsed}s — no rush` };

  return (
    <div className="p-6 max-w-2xl mx-auto text-center flex flex-col items-center gap-6">
      <div>
        <div className="chip bg-gold/10 border border-gold/30 text-gold">
          💿 added to inventory
        </div>
        <h2 className="font-display text-4xl font-bold mt-2">
          "{latest.name}"
        </h2>
        <div className="mt-1 text-[12px] font-mono text-white/60">
          {latest.bpm} bpm · {latest.bars} bars · key {latest.keyRoot}
        </div>
      </div>

      {/* 60-second result */}
      {elapsed > 0 && (
        <div className="card p-4 w-full">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <div className={`font-display font-bold text-xl ${speedResult.color}`}>
                {speedResult.label}
              </div>
              <div className="text-[12px] font-mono text-white/50 mt-0.5">
                {speedResult.msg}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-white/40 uppercase">target</div>
              <div className="text-[12px] font-mono text-white/60">60 seconds</div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 w-full h-1.5 bg-raised rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                elapsed <= 60 ? "bg-gradient-to-r from-green-500 to-accent" : "bg-orange-400/60"
              }`}
              style={{ width: `${Math.min(100, (elapsed / 60) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="card p-5 w-full">
        <div className="flex flex-wrap gap-1 justify-center mb-3">
          {latest.tags.map((t) => (
            <span key={t} className="chip bg-raised border border-line text-white/70">
              #{t}
            </span>
          ))}
        </div>
        <div className="text-[12px] font-mono text-white/60">
          layers: {latest.layers.map((l) => l.kind).join(" + ")}
        </div>
        {latest.collaborators.length > 1 && (
          <div className="mt-2 text-[12px] font-mono text-accent">
            collab: {latest.collaborators.join(" × ")}
          </div>
        )}
        {latest.pitchScore !== undefined && (
          <div className="mt-2 text-[12px] font-mono text-gold">
            hook landed · {latest.pitchScore}/100 on pitch
          </div>
        )}
      </div>

      {/* Publish CTA — the high-energy action. Lives above the secondary
       * options so it reads as the meaningful commitment, not just another
       * button. Disabled states are explicit: already out, mid-publish, or
       * not enough energy. Cap-reached is caught server-side and returns a
       * clear message via the companion ticker. */}
      {(() => {
        const liveEnergy    = computeLiveEnergy(energy, energyUpdatedAt);
        const isPublished   = !!latest.publishedPublicationId;
        const isPublishing  = publishingSongId === latest.id;
        const canAfford     = liveEnergy >= ENERGY_COSTS.publishSong;
        const disabled      = isPublished || isPublishing || !canAfford;
        const label         = isPublished  ? "🎧 already published"
                            : isPublishing ? "rendering + uploading…"
                            : !canAfford   ? `need ${ENERGY_COSTS.publishSong - liveEnergy} more ⚡`
                            :                `🎧 publish · ${ENERGY_COSTS.publishSong}⚡`;
        return (
          <button
            className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={disabled}
            onClick={() => publishSong(latest.id)}
            title={
              isPublished
                ? "this drop is live in the booth"
                : `publish to the listening booth (-${ENERGY_COSTS.publishSong} ⚡)`
            }
          >
            {label}
          </button>
        );
      })()}

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          className="btn-primary"
          onClick={() => { reset(); setStage("template"); }}
        >
          🔁 cook another
        </button>
        <button
          className="btn-ghost"
          onClick={() => { stopSong(); setStage("booth"); }}
        >
          🎧 visit the booth
        </button>
        <button
          className="btn-ghost"
          onClick={() => { stopSong(); setStage("home"); }}
        >
          ← home
        </button>
      </div>

      <div className="mt-4 text-[11px] font-mono text-white/40 max-w-sm">
        Companion: songs finished {tamagotchi.songsFinished}.
        {tamagotchi.songsFinished > 0 ? " creativity +15, energy −5." : ""}
      </div>
    </div>
  );
}
