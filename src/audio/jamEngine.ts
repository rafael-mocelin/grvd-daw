/**
 * jamEngine — per-character independent loop playback for the Jam stage.
 *
 * Inspired by Incredibox / Sprunki: each character on stage holds at most
 * one assigned sound. When a sound is assigned, the character starts
 * looping that sound IMMEDIATELY but at the source-time offset that
 * matches the master transport's current position (Splice-style phase
 * lock — same trick we use in the recipe preview engine). So characters
 * added 10 seconds apart still phase-lock with each other.
 *
 * Each "slot" has its own Tone.Player + Gain so we can mute / set
 * volume independently. The master transport ticks silently as the
 * shared metronome. Stopping the last slot doesn't stop the transport;
 * future slots will phase-lock against the same grid.
 *
 * Public API:
 *   - assignSlot(slotId, soundId, bpm) — start the loop for this slot,
 *     replacing any previous sound. Phase-locked.
 *   - clearSlot(slotId) — stop & dispose this slot's audio chain.
 *   - setSlotVolume(slotId, gain) — 0–2 linear gain (1 = nominal).
 *   - setSlotMuted(slotId, muted) — mute toggle, restores prior volume.
 *   - clearAllSlots() — full reset (used when leaving the stage).
 *   - getJamMasterTransportSeconds() — for visual sync (beat indicators).
 */

import * as Tone from "tone";
import { ensureAudio, setBpm } from "./engine";
import { getSound } from "../data/sounds";
import { playJamWhoosh, playJamThunk, playJamFwoop } from "./jamSfx";

interface Slot {
  player:    Tone.Player;
  gain:      Tone.Gain;
  /** Linear gain we want when un-muted (so mute can restore it). */
  unmutedGain: number;
  muted:       boolean;
  soundId:     string;
  /** The sound's native BPM — used by setMasterBpm to recompute the
   *  player's rate when the master changes. null for vocal slots that
   *  are NOT syncing to BPM; for catalog slots this is the file's
   *  authored tempo. */
  nativeBpm:   number | null;
  /** For vocal slots only: the master BPM at record time. Stored on
   *  the side so the sync toggle can flip nativeBpm between this value
   *  (sync ON, vocal rate-stretches with master BPM) and null (sync
   *  OFF, vocal stays at its recorded tempo regardless). undefined
   *  for non-vocal slots. */
  recordedBpm?: number;
  /** Vocal-only effects chain — pitch shifter for tuning and a chorus
   *  that lays in the "auto-tuned / produced" sheen. Real autotune
   *  needs real-time pitch detection + scale quantization (heavy);
   *  this approximation is what the game-y UX actually needs: a
   *  semitone knob and a wet/dry effect blend.  */
  vocalFx?: {
    pitchShift: Tone.PitchShift;
    chorus:     Tone.Chorus;
  };
}

const slots = new Map<string, Slot>();

/**
 * Make sure the master transport is running so phase-lock math works.
 * If it's not, we set BPM and start it from 0. If it IS running we leave
 * it alone — could be the recipe view's preview transport, could be a
 * previous jam session. Either way, the next loop quantizes to the
 * existing grid.
 */
function ensureJamTransport(bpm: number) {
  const transport = Tone.getTransport();
  if (transport.state !== "started") {
    setBpm(bpm);
    transport.position = "0:0:0";
    transport.start();
  }
}

/**
 * Compute the source-time offset for a freshly-loaded Player so it
 * drops into its loop at the position matching the current transport.
 * Same math as the recipe's previewSourceOffset, lifted here so the
 * jam engine doesn't depend on engine.ts's preview internals.
 */
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

/**
 * Assign a sound to a slot. If the slot already had a sound we tear
 * it down first and build a fresh chain with the new sound. The new
 * loop starts immediately, phase-locked.
 */
export async function assignSlot(slotId: string, soundId: string, bpm: number): Promise<void> {
  await ensureAudio();
  ensureJamTransport(bpm);

  // Tear down any existing slot.
  clearSlot(slotId);

  const sound = getSound(soundId);
  if (!sound?.fileUrl || !sound.nativeBpm) {
    console.warn(`[jamEngine] sound ${soundId} has no fileUrl, skipping`);
    return;
  }

  const rate = bpm / sound.nativeBpm;
  const player = new Tone.Player({
    url:           sound.fileUrl,
    loop:          true,
    playbackRate:  rate,
  });
  const gain = new Tone.Gain(1.0);
  player.connect(gain);
  gain.toDestination();

  // Wait for the buffer to finish loading (poll up to 6 s) before we
  // schedule the start — without a loaded buffer phase-lock can't
  // measure the source duration.
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
    console.warn(`[jamEngine] sound ${soundId} buffer didn't load`);
    return;
  }

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[jamEngine] player start failed:", err);
    try { player.dispose(); gain.dispose(); } catch { /* ignore */ }
    return;
  }

  slots.set(slotId, {
    player,
    gain,
    unmutedGain: 1.0,
    muted:       false,
    soundId,
    nativeBpm:   sound.nativeBpm,
  });

  // Drop-in SFX — fire-and-forget. Stays quiet under the mix via sfxBus.
  void playJamWhoosh();
}

export function clearSlot(slotId: string): void {
  const slot = slots.get(slotId);
  if (!slot) return;
  try { slot.player.stop(); } catch { /* ignore */ }
  try { slot.player.dispose(); } catch { /* ignore */ }
  try { slot.gain.dispose(); } catch { /* ignore */ }
  if (slot.vocalFx) {
    try { slot.vocalFx.pitchShift.dispose(); } catch { /* ignore */ }
    try { slot.vocalFx.chorus.dispose();    } catch { /* ignore */ }
  }
  slots.delete(slotId);
}

export function clearAllSlots(): void {
  for (const id of Array.from(slots.keys())) clearSlot(id);
}

/**
 * Set linear gain (0 = silent, 1 = nominal, up to 2 for "loud" / VFX mode).
 * Persists as the slot's "unmuted" gain so toggling mute later restores it.
 */
export function setSlotVolume(slotId: string, gain: number): void {
  const slot = slots.get(slotId);
  if (!slot) return;
  const safe = Math.max(0, Math.min(2, gain));
  slot.unmutedGain = safe;
  if (!slot.muted) slot.gain.gain.value = safe;
}

export function setSlotMuted(slotId: string, muted: boolean): void {
  const slot = slots.get(slotId);
  if (!slot) return;
  // Only fire SFX when the mute state is actually changing — not on
  // identity sets (defensive against double-toggle bugs in the UI).
  const stateChanged = slot.muted !== muted;
  slot.muted = muted;
  slot.gain.gain.value = muted ? 0 : slot.unmutedGain;
  if (stateChanged) {
    if (muted) void playJamThunk();
    else        void playJamFwoop();
  }
}

export function getSlotState(slotId: string):
  | { soundId: string; muted: boolean; volume: number }
  | null {
  const slot = slots.get(slotId);
  if (!slot) return null;
  return { soundId: slot.soundId, muted: slot.muted, volume: slot.unmutedGain };
}

export function getJamMasterTransportSeconds(): number {
  return Tone.getTransport().seconds;
}

/**
 * Toggle whether a vocal slot follows the master BPM.
 *
 * - sync = true   → nativeBpm becomes the recordedBpm, so subsequent
 *   setMasterBpm calls (and this call too) rate-stretch the player to
 *   match. Pitch shifts with rate, same as catalog loops.
 * - sync = false  → nativeBpm goes back to null, player rate goes back
 *   to 1. Vocal plays at its recorded tempo regardless of master BPM.
 *
 * No-op for non-vocal slots (no recordedBpm to anchor against).
 */
export function setVocalSync(slotId: string, sync: boolean, masterBpm: number): void {
  const slot = slots.get(slotId);
  if (!slot || slot.recordedBpm == null) return;
  if (sync) {
    slot.nativeBpm = slot.recordedBpm;
    const rate = masterBpm / slot.recordedBpm;
    if (isFinite(rate) && rate > 0) slot.player.playbackRate = rate;
  } else {
    slot.nativeBpm = null;
    slot.player.playbackRate = 1;
  }
}

/**
 * Live BPM change — updates the master Tone.Transport AND adjusts every
 * active loop's playbackRate so they stay in time with the new tempo.
 *
 * Rate-changes shift pitch (no time-stretching). That's the standard
 * behaviour in DAWs without a stretching algorithm and matches what
 * the recipe-flow engine does. Slots with null nativeBpm (vocal
 * recordings without sync ON) are left at rate 1.
 */
export function setMasterBpm(bpm: number): void {
  setBpm(bpm);
  for (const slot of slots.values()) {
    if (slot.nativeBpm == null) continue;
    const rate = bpm / slot.nativeBpm;
    if (isFinite(rate) && rate > 0) {
      slot.player.playbackRate = rate;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Master play / pause — controls every slot at once                          */
/* -------------------------------------------------------------------------- */

/**
 * Master pause for the whole jam. Stops every slot's player at the
 * same audio-clock moment (so when we resume we can restart them
 * phase-locked again). The Tone.Transport keeps running so the
 * phase-lock math stays consistent — only the players stop.
 */
export function pauseJam(): void {
  for (const slot of slots.values()) {
    try { slot.player.stop(); } catch { /* ignore */ }
  }
}

/**
 * Master resume — starts every slot's player again, phase-aligned to
 * the master transport's current position. Same offset math as the
 * initial assignSlot.
 */
export function resumeJam(): void {
  for (const slot of slots.values()) {
    if (!slot.player.loaded) continue;
    const offset = phaseAlignedOffset(slot.player);
    try {
      slot.player.start(Tone.now(), offset);
    } catch (err) {
      console.warn("[jamEngine] resume failed for slot:", err);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Vocal slot — record from the mic, then loop the recording in this slot     */
/* -------------------------------------------------------------------------- */

/**
 * Replace a slot's audio with a freshly-recorded vocal buffer. The
 * recording is treated like any other looping clip — phase-locked to
 * the master transport, mute / volume / clear all work the same.
 *
 * The caller (UI layer) records the buffer via the existing
 * recordVocal() in engine.ts, then hands the resulting AudioBuffer
 * here for playback.
 */
export async function assignVocalSlot(
  slotId: string,
  buffer: AudioBuffer,
  bpm: number,
): Promise<void> {
  await ensureAudio();
  ensureJamTransport(bpm);

  // Tear down whatever was there.
  clearSlot(slotId);

  const player = new Tone.Player(buffer);
  player.loop = true;
  // Vocal recordings come from the user's mic — no rate-stretch.
  player.playbackRate = 1;

  // ── Autotune-flavoured FX chain ──
  // Pitch shifter handles the semitone "tune" knob; chorus adds the
  // produced sheen autotuned vocals are known for. The chorus wet
  // amount IS the "effect" amount the popover exposes — 0 = bypass,
  // 1 = full wash. Real autotune snaps detected pitch to a scale;
  // without realtime pitch detection that's not in scope, so this
  // chain gives the audible character without the heavy DSP.
  const pitchShift = new Tone.PitchShift({
    pitch:      0,
    windowSize: 0.08,
    feedback:   0,
  });
  const chorus = new Tone.Chorus({
    frequency: 4,
    delayTime: 2.5,
    depth:     0.7,
    feedback:  0.3,
    spread:    180,
    wet:       0.5,         // default effect amount — noticeable but not cartoonish
  }).start();

  // Mute / volume node downstream of the FX so the dB target lands on
  // the wet signal.
  const gain = new Tone.Gain(1.0);

  player.disconnect();
  player.connect(pitchShift);
  pitchShift.connect(chorus);
  chorus.connect(gain);
  gain.toDestination();

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[jamEngine] vocal player start failed:", err);
    try { player.dispose(); gain.dispose(); pitchShift.dispose(); chorus.dispose(); } catch { /* ignore */ }
    return;
  }

  slots.set(slotId, {
    player,
    gain,
    unmutedGain: 1.0,
    muted:       false,
    soundId:     "__vocal__",  // sentinel — the UI knows this is a recording, not a catalog sound
    // Default: sync OFF — vocal stays at rate 1 regardless of master
    // BPM. Toggle on via setVocalSync to make the vocal rate-stretch
    // with the band.
    nativeBpm:   null,
    recordedBpm: bpm,
    vocalFx:     { pitchShift, chorus },
  });

  // Vocal slot also gets the drop-in whoosh.
  void playJamWhoosh();
}

/**
 * Update the autotune parameters on a vocal slot in place. Safe to
 * call on non-vocal slots (no-op) and at any rate (no audible glitch).
 *
 *   - pitch:  -12..+12 semitones (Tone.PitchShift.pitch)
 *   - effect: 0..1 chorus wet amount + depth scale
 */
export function setVocalAutotune(
  slotId: string,
  params: { pitch?: number; effect?: number },
): void {
  const slot = slots.get(slotId);
  if (!slot?.vocalFx) return;
  if (typeof params.pitch === "number") {
    slot.vocalFx.pitchShift.pitch = params.pitch;
  }
  if (typeof params.effect === "number") {
    const e = Math.max(0, Math.min(1, params.effect));
    slot.vocalFx.chorus.wet.value = e;
    // Slight depth scaling so 0 = dry, 1 = full wash. Keeps the
    // chorus character recognisable across the slider range.
    slot.vocalFx.chorus.depth = 0.2 + e * 0.6;
  }
}
