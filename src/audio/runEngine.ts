/**
 * runEngine — multi-track looping playback for the Studio Run flow.
 *
 * Same phase-locked pattern as the daily/jam engines: as the player
 * picks cards across stages (drums → hat → melody) the new layer
 * drops in at the offset matching the master transport, so the song
 * "fills out" instead of restarting.
 *
 * Public API:
 *   - addLayer(soundId, masterBpm)
 *   - removeLayer(soundId)
 *   - clearAllLayers()
 *   - getLayerCount()
 */

import * as Tone from "tone";
import { ensureAudio, setBpm } from "./engine";
import { getSound } from "../data/sounds";

interface Layer {
  player: Tone.Player;
  gain:   Tone.Gain;
}

const layers = new Map<string, Layer>();

function ensureTransport(bpm: number) {
  const t = Tone.getTransport();
  if (t.state !== "started") {
    setBpm(bpm);
    t.position = "0:0:0";
    t.start();
  } else {
    // Mid-run BPM updates if the player redrafts the vibe (only happens
    // before drums are picked in v1, but keep the codepath safe).
    setBpm(bpm);
  }
}

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

  if (layers.has(soundId)) return;

  const sound = getSound(soundId);
  if (!sound?.fileUrl || !sound.nativeBpm) {
    console.warn(`[runEngine] sound ${soundId} has no fileUrl, skipping`);
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
    console.warn(`[runEngine] sound ${soundId} buffer didn't load`);
    return;
  }

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[runEngine] player start failed:", err);
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

export function getLayerCount(): number {
  return layers.size;
}
