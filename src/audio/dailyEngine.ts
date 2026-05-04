/**
 * dailyEngine — multi-track looping playback for the Daily Drop cook stage.
 *
 * The player picks up to N sounds during the daily and they all play at
 * once, phase-locked to the prompt's BPM. Same Splice-style trick as the
 * jam stage: sounds added later phase-align to the existing master
 * transport so they slot into the groove instead of starting at 0.
 *
 * Public API:
 *   - addLayer(soundId, masterBpm)  — start looping this sound, layered
 *     onto whatever's already playing
 *   - removeLayer(soundId)          — stop & dispose this sound's chain
 *   - clearAllLayers()              — full reset (call on phase exit)
 *
 * No mute / volume yet — keeping the prototype tight. If the concept
 * graduates, a SetSlot* family copied from jamEngine drops in cleanly.
 */

import * as Tone from "tone";
import { ensureAudio, setBpm } from "./engine";
import { getSound } from "../data/sounds";

interface Layer {
  player: Tone.Player;
  gain:   Tone.Gain;
}

const layers = new Map<string, Layer>();

/** Make sure the master transport ticks so phase-lock math works. */
function ensureTransport(bpm: number) {
  const t = Tone.getTransport();
  if (t.state !== "started") {
    setBpm(bpm);
    t.position = "0:0:0";
    t.start();
  }
}

/** Compute source-time offset so this player drops in at the master clock. */
function phaseAlignedOffset(player: Tone.Player): number {
  if (!player.loaded || !player.buffer) return 0;
  const sourceDur = player.buffer.duration;
  const rate      = player.playbackRate || 1;
  const outputDur = sourceDur / rate;
  if (!isFinite(outputDur) || outputDur <= 0) return 0;
  const transportSec = Tone.getTransport().seconds;
  const outputOffset = ((transportSec % outputDur) + outputDur) % outputDur;
  return outputOffset * rate;
}

export async function addLayer(soundId: string, masterBpm: number): Promise<void> {
  await ensureAudio();
  ensureTransport(masterBpm);

  // Already in? Idempotent — refuse to double-add.
  if (layers.has(soundId)) return;

  const sound = getSound(soundId);
  if (!sound?.fileUrl || !sound.nativeBpm) {
    console.warn(`[dailyEngine] sound ${soundId} has no fileUrl, skipping`);
    return;
  }

  const rate = masterBpm / sound.nativeBpm;
  const player = new Tone.Player({
    url:           sound.fileUrl,
    loop:          true,
    playbackRate:  rate,
  });
  const gain = new Tone.Gain(1.0);
  player.connect(gain);
  gain.toDestination();

  // Wait for buffer to load (poll up to 6 s).
  const loaded = await new Promise<boolean>((resolve) => {
    if (player.loaded) { resolve(true); return; }
    const start = Date.now();
    const poll  = setInterval(() => {
      if (player.loaded) { clearInterval(poll); resolve(true); }
      else if (Date.now() - start > 6000) { clearInterval(poll); resolve(false); }
    }, 30);
  });

  if (!loaded) {
    try { player.dispose(); gain.dispose(); } catch { /* ignore */ }
    console.warn(`[dailyEngine] sound ${soundId} buffer didn't load`);
    return;
  }

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[dailyEngine] player start failed:", err);
    try { player.dispose(); gain.dispose(); } catch { /* ignore */ }
    return;
  }

  layers.set(soundId, { player, gain });
}

export function removeLayer(soundId: string): void {
  const l = layers.get(soundId);
  if (!l) return;
  try { l.player.stop(); }    catch { /* ignore */ }
  try { l.player.dispose(); } catch { /* ignore */ }
  try { l.gain.dispose(); }   catch { /* ignore */ }
  layers.delete(soundId);
}

export function clearAllLayers(): void {
  for (const id of Array.from(layers.keys())) removeLayer(id);
}

/** Number of currently-active layers. UI uses this to render the
 *  "filled / cap" indicator without holding parallel state. */
export function getLayerCount(): number {
  return layers.size;
}
