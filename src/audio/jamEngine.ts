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
  /** Vocal-only effects chain — Travis-Scott-flavoured trap stack.
   *  Real autotune does live pitch detection + scale quantization
   *  (Antares Auto-Tune Pro); without that DSP, the audible
   *  character of the genre comes from: (1) tight pitch shift,
   *  (2) octave-doubled harmony, (3) slap delay, (4) plate reverb,
   *  (5) bus compression to glue. The EFFECT slider blends 2/3/4
   *  in together — at 0 you hear a near-dry tuned vocal, at 1 the
   *  full "in the booth" wash. */
  vocalFx?: {
    pitchShift:    Tone.PitchShift;   // main tune (semitones)
    octaveShift:   Tone.PitchShift;   // +12 harmony, runs parallel to dry
    octaveGain:    Tone.Gain;         // ramps with EFFECT
    delay:         Tone.FeedbackDelay; // slap delay
    delayGain:     Tone.Gain;          // ramps with EFFECT
    reverb:        Tone.Reverb;       // plate-ish
    reverbGain:    Tone.Gain;          // ramps with EFFECT
    compressor:    Tone.Compressor;
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
    const fx = slot.vocalFx;
    try { fx.pitchShift.dispose();  } catch { /* ignore */ }
    try { fx.octaveShift.dispose(); } catch { /* ignore */ }
    try { fx.octaveGain.dispose();  } catch { /* ignore */ }
    try { fx.delay.dispose();       } catch { /* ignore */ }
    try { fx.delayGain.dispose();   } catch { /* ignore */ }
    try { fx.reverb.dispose();      } catch { /* ignore */ }
    try { fx.reverbGain.dispose();  } catch { /* ignore */ }
    try { fx.compressor.dispose();  } catch { /* ignore */ }
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

/* -------------------------------------------------------------------------- */
/* Custom drum presets — buffers baked out of DRUMMA station                  */
/* -------------------------------------------------------------------------- */

/** In-memory cache of pre-rendered drum patterns, keyed by preset id.
 *  The id format is "custom-drum-...", matching the CustomDrumPreset
 *  store. Buffers don't survive a page reload — JamView re-renders
 *  them on first use after a reload. */
const customDrumBuffers = new Map<string, { buffer: AudioBuffer; nativeBpm: number }>();

/** Stash a rendered AudioBuffer so a slot can later be assigned to
 *  this preset id. Called by JamView after drummaEngine.renderPattern
 *  ToBuffer completes during a BAKE. */
export function registerCustomDrumBuffer(
  presetId: string,
  buffer: AudioBuffer,
  nativeBpm: number,
): void {
  customDrumBuffers.set(presetId, { buffer, nativeBpm });
}

export function hasCustomDrumBuffer(presetId: string): boolean {
  return customDrumBuffers.has(presetId);
}

/**
 * Assign a slot to play back a custom drum preset. Same audio shape
 * as catalog band slots (Tone.Player + Gain, rate-stretched to the
 * master BPM, phase-locked) but the buffer comes from the in-memory
 * cache instead of a file URL.
 */
export async function assignCustomDrumSlot(
  slotId: string,
  presetId: string,
  bpm: number,
): Promise<void> {
  await ensureAudio();
  ensureJamTransport(bpm);

  const entry = customDrumBuffers.get(presetId);
  if (!entry) {
    console.warn(`[jamEngine] no buffer for custom drum preset ${presetId}`);
    return;
  }

  // Tear down whatever was on this slot before.
  clearSlot(slotId);

  const rate = bpm / entry.nativeBpm;
  const player = new Tone.Player(entry.buffer);
  player.loop         = true;
  player.playbackRate = rate;

  const gain = new Tone.Gain(1.0);
  player.connect(gain);
  gain.toDestination();

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[jamEngine] custom drum player start failed:", err);
    try { player.dispose(); gain.dispose(); } catch { /* ignore */ }
    return;
  }

  slots.set(slotId, {
    player,
    gain,
    unmutedGain: 1.0,
    muted:       false,
    soundId:     presetId,
    nativeBpm:   entry.nativeBpm,
  });

  void playJamWhoosh();
}

/**
 * Scrub support — set the master transport position. Pair with
 * resyncJamSlotsToTransport() on pointer-up to glitch-stitch every
 * looping slot Player to the new offset.
 */
export function seekJamTransport(seconds: number): void {
  Tone.getTransport().seconds = Math.max(0, seconds);
}

/**
 * After a seek, restart every slot's Tone.Player at the source-time
 * offset matching the new transport position. Mirrors the recipe
 * engine's resyncLoopingPlayersToTransport but operates on the jam
 * engine's slot map. Vocal slots also re-stitch — their nativeBpm
 * may be null (sync OFF) but `Tone.now()` is still valid.
 *
 * Call once on pointer-up after a scrub, not on every pointer-move
 * (stop/start every frame sounds terrible).
 */
export function resyncJamSlotsToTransport(): void {
  const transportSec = Tone.getTransport().seconds;
  for (const slot of slots.values()) {
    const player = slot.player;
    if (!player.loop || !player.loaded || !player.buffer) continue;
    const sourceDur = player.buffer.duration;
    const rate      = player.playbackRate || 1;
    const outputDur = sourceDur / rate;
    if (!isFinite(outputDur) || outputDur <= 0) continue;
    const offsetInOutput = ((transportSec % outputDur) + outputDur) % outputDur;
    const sourceOffset   = offsetInOutput * rate;
    try {
      player.stop();
      player.start(Tone.now(), sourceOffset);
    } catch (err) {
      console.warn("[resyncJamSlotsToTransport] failed:", err);
    }
  }
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

  // ── Trap / Travis-style autotune chain ──
  // The defining traits of the genre's vocal sound are octave-doubled
  // harmonies, tight slap delay, and a plate reverb tail, sitting on
  // top of an autotuned lead. Without realtime pitch detection we can
  // approximate the audible character with this signal flow:
  //
  //                                  ┌─► octaveShift → octaveGain ──┐
  //                                  │                                │
  //   player → pitchShift (tune) ────┼─► dry ─────────────────────────┤
  //                                  │                                │
  //                                  ├─► delay → delayGain ───────────┤
  //                                  │                                ▼
  //                                  └─► reverb → reverbGain ───► compressor → gain → out
  //
  // The EFFECT slider drives octaveGain / delayGain / reverbGain in
  // parallel, so 0 = near-dry tuned vocal, 1 = full "booth" stack.
  const pitchShift = new Tone.PitchShift({
    pitch:      0,
    windowSize: 0.05,   // tighter than before — grainier, more "autotuned"
    feedback:   0,
  });
  // Parallel +12 harmony (the "Travis stack").
  const octaveShift = new Tone.PitchShift({
    pitch:      12,
    windowSize: 0.05,
    feedback:   0,
  });
  const octaveGain = new Tone.Gain(0);   // ramped by EFFECT
  // Slap delay — eighth-note at the master BPM. Clamped to a sane
  // 60–220 ms range so it stays "slap"-like even at extreme tempos.
  // Low feedback for tightness; the wet IS the bus send (no internal
  // mix), the overall amount is controlled by delayGain downstream.
  const slapTime = Math.max(0.06, Math.min(0.22, (60 / bpm) / 2));
  const delay = new Tone.FeedbackDelay({
    delayTime: slapTime,
    feedback:  0.22,
    wet:       1,
  });
  const delayGain = new Tone.Gain(0);
  // Plate-ish reverb — tight pre-delay, ~1.6 s tail.
  const reverb = new Tone.Reverb({
    decay:     1.6,
    preDelay:  0.02,
    wet:       1,                     // again wet 100% on the bus; reverbGain controls the send
  });
  const reverbGain = new Tone.Gain(0);
  // Bus comp to glue everything together. Trap vocals are typically
  // smashed — heavy ratio, fast attack, slow release.
  const compressor = new Tone.Compressor({
    threshold: -22,
    ratio:     4,
    attack:    0.005,
    release:   0.2,
    knee:      6,
  });

  // Mute / volume node downstream of the entire wash.
  const gain = new Tone.Gain(1.0);

  player.disconnect();
  // Player → pitch (tune)
  player.connect(pitchShift);

  // Parallel branches off the tuned signal.
  pitchShift.connect(compressor);              // dry branch
  pitchShift.connect(octaveShift);
  octaveShift.connect(octaveGain);
  octaveGain.connect(compressor);
  pitchShift.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(compressor);
  pitchShift.connect(reverb);
  reverb.connect(reverbGain);
  reverbGain.connect(compressor);

  compressor.connect(gain);
  gain.toDestination();

  const offset = phaseAlignedOffset(player);
  try {
    player.start(Tone.now(), offset);
  } catch (err) {
    console.error("[jamEngine] vocal player start failed:", err);
    try {
      player.dispose();      gain.dispose();
      pitchShift.dispose();  octaveShift.dispose();
      octaveGain.dispose();  delay.dispose();
      delayGain.dispose();   reverb.dispose();
      reverbGain.dispose();  compressor.dispose();
    } catch { /* ignore */ }
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
    vocalFx: {
      pitchShift, octaveShift, octaveGain,
      delay, delayGain, reverb, reverbGain,
      compressor,
    },
  });

  // Apply the default effect amount immediately so the chain matches
  // the slider's default position (the popover defaults to 0.5).
  setVocalAutotune(slotId, { effect: 0.5 });

  // Vocal slot also gets the drop-in whoosh.
  void playJamWhoosh();
}

/**
 * Update the autotune parameters on a vocal slot in place. Safe to
 * call on non-vocal slots (no-op) and at any rate (no audible glitch).
 *
 *   - pitch:  -12..+12 semitones — sets Tone.PitchShift.pitch; the
 *             octave harmony tracks the tune (+12 on top).
 *   - effect: 0..1 — drives the octave-harmony, slap-delay, and
 *             reverb send levels in parallel. 0 ≈ dry tuned vocal,
 *             1 ≈ full Travis-style stack.
 */
export function setVocalAutotune(
  slotId: string,
  params: { pitch?: number; effect?: number },
): void {
  const slot = slots.get(slotId);
  if (!slot?.vocalFx) return;
  const fx = slot.vocalFx;
  if (typeof params.pitch === "number") {
    fx.pitchShift.pitch  = params.pitch;
    // Keep the harmony locked one octave above the tuned lead.
    fx.octaveShift.pitch = params.pitch + 12;
  }
  if (typeof params.effect === "number") {
    const e = Math.max(0, Math.min(1, params.effect));
    // Tuned ratios — octave harmony stays slightly under the dry
    // lead, slap delay subtle, reverb on top. Numbers picked by ear
    // to match recognisable trap-vocal mixes.
    fx.octaveGain.gain.rampTo(e * 0.55, 0.05);
    fx.delayGain.gain.rampTo (e * 0.35, 0.05);
    fx.reverbGain.gain.rampTo(e * 0.40, 0.05);
  }
}
