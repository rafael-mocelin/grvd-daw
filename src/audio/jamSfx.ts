/**
 * jamSfx — small synthesized one-shot UI sounds for the Jam stage.
 *
 * Pure Tone.js. No audio assets required. Each public function is a
 * fire-and-forget play that schedules the sound at Tone.now(); the
 * synth/filter graph is created once on first call and reused on
 * subsequent calls to avoid GC churn.
 *
 * Routed through a shared sfxBus Gain at –8 dB so the SFX sit
 * comfortably under whatever loops are playing.
 *
 * Public API:
 *   - playJamWhoosh()      — drop-in: filtered noise sweep
 *   - playJamThunk()       — mute on:  low sine bonk
 *   - playJamFwoop()       — mute off: rising sine sweep
 *   - playJamComboSting()  — combo unlock: triad stab
 */

import * as Tone from "tone";
import { ensureAudio } from "./engine";

/* -------------------------------------------------------------------------- */
/* Shared bus                                                                  */
/* -------------------------------------------------------------------------- */

let sfxBus: Tone.Gain | null = null;

function getBus(): Tone.Gain {
  if (!sfxBus) {
    // –8 dB gives plenty of headroom under the music. We can revisit
    // the level once the music side has a settled mix bus.
    sfxBus = new Tone.Gain(Tone.dbToGain(-8)).toDestination();
  }
  return sfxBus;
}

/* -------------------------------------------------------------------------- */
/* Whoosh — filtered white noise with a quick falling cutoff sweep.           */
/* Used when a sound is freshly assigned to a character.                       */
/* -------------------------------------------------------------------------- */

let whooshNoise: Tone.NoiseSynth | null = null;
let whooshFilter: Tone.Filter | null = null;

function ensureWhoosh() {
  if (whooshNoise && whooshFilter) return;
  whooshFilter = new Tone.Filter({
    type: "bandpass",
    frequency: 1800,
    Q: 1.2,
  });
  whooshNoise = new Tone.NoiseSynth({
    noise:    { type: "pink" },
    envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.05 },
    volume:   -6,
  });
  whooshNoise.chain(whooshFilter, getBus());
}

export async function playJamWhoosh(): Promise<void> {
  await ensureAudio();
  ensureWhoosh();
  if (!whooshNoise || !whooshFilter) return;

  const t = Tone.now();
  // Quick filter ramp from bright to dark so it reads as a "sweep down"
  // rather than a flat noise burst.
  whooshFilter.frequency.cancelScheduledValues(t);
  whooshFilter.frequency.setValueAtTime(2400, t);
  whooshFilter.frequency.exponentialRampToValueAtTime(420, t + 0.18);
  whooshNoise.triggerAttackRelease(0.18, t);
}

/* -------------------------------------------------------------------------- */
/* Thunk — short low sine burst. Mute toggle ON.                               */
/* -------------------------------------------------------------------------- */

let thunkSynth: Tone.MembraneSynth | null = null;

function ensureThunk() {
  if (thunkSynth) return;
  thunkSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
    volume: -10,
  });
  thunkSynth.connect(getBus());
}

export async function playJamThunk(): Promise<void> {
  await ensureAudio();
  ensureThunk();
  if (!thunkSynth) return;
  thunkSynth.triggerAttackRelease("A1", "16n", Tone.now());
}

/* -------------------------------------------------------------------------- */
/* Fwoop — rising sine sweep. Mute toggle OFF.                                 */
/* -------------------------------------------------------------------------- */

let fwoopSynth: Tone.Synth | null = null;

function ensureFwoop() {
  if (fwoopSynth) return;
  fwoopSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.16, sustain: 0, release: 0.08 },
    volume: -10,
  });
  fwoopSynth.connect(getBus());
}

export async function playJamFwoop(): Promise<void> {
  await ensureAudio();
  ensureFwoop();
  if (!fwoopSynth) return;
  const t = Tone.now();
  // Pitch glides up across the envelope window for a satisfying "wake".
  fwoopSynth.frequency.cancelScheduledValues(t);
  fwoopSynth.frequency.setValueAtTime(220, t);
  fwoopSynth.frequency.exponentialRampToValueAtTime(660, t + 0.18);
  fwoopSynth.triggerAttackRelease(220, 0.2, t);
}

/* -------------------------------------------------------------------------- */
/* Combo sting — short triad stab. Combo unlock.                               */
/* -------------------------------------------------------------------------- */

let stingSynth: Tone.PolySynth | null = null;
let stingReverb: Tone.Reverb | null = null;

function ensureSting() {
  if (stingSynth && stingReverb) return;
  stingReverb = new Tone.Reverb({ decay: 1.6, preDelay: 0.01, wet: 0.35 });
  stingSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.0, release: 0.25 },
    volume: -6,
  });
  stingSynth.chain(stingReverb, getBus());
}

export async function playJamComboSting(): Promise<void> {
  await ensureAudio();
  ensureSting();
  if (!stingSynth) return;
  // Major-7 voicing gives a "won an achievement" lift without sounding
  // too triumphal. Pitched to sit out of the way of typical mix bass.
  const t = Tone.now();
  stingSynth.triggerAttackRelease(["E5", "G#5", "B5", "D#6"], 0.7, t);
}

/* -------------------------------------------------------------------------- */
/* Metronome tick — single short click used during vocal recording to give    */
/* unexperienced singers a beat reference. Lives on a dedicated synth so we   */
/* can volume-tune it independently of the SFX bus and route it directly to   */
/* the destination (it shouldn't duck under the SFX bus's –8 dB).             */
/* -------------------------------------------------------------------------- */

let metroSynth: Tone.MembraneSynth | null = null;

function ensureMetro() {
  if (metroSynth) return;
  metroSynth = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves:    2,
    envelope:   { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
    volume:     -6,
  }).toDestination();
}

/**
 * Play one metronome click. `accent` = true for the downbeat (beat 1)
 * — the click is brighter so the singer hears the bar boundary.
 *
 * Quiet enough to coexist with the band loops; loud enough that you
 * hear it through wired headphones over a backing track. If recording
 * happens on speakers (no headphones) the mic will pick this up — by
 * design we still play it because the user has been told to use
 * headphones, and a captured tick is far less bad than the singer
 * losing the beat entirely.
 */
/**
 * Plays a metronome tick. The optional `time` parameter accepts an
 * AudioContext time (e.g., the `time` argument from a
 * Tone.Transport.scheduleRepeat callback) so the click lands exactly
 * on the scheduled beat instead of being smeared by JS event-loop
 * latency. When omitted, the tick fires immediately at Tone.now().
 *
 * IMPORTANT: when called from inside a Tone.Transport callback, do
 * NOT await ensureAudio() (the audio context is already running by
 * definition) — awaiting from within a scheduler callback can break
 * the timing. The non-async variant playMetronomeTickAt below is
 * provided for that case.
 */
export async function playMetronomeTick(accent = false): Promise<void> {
  await ensureAudio();
  ensureMetro();
  if (!metroSynth) return;
  metroSynth.triggerAttackRelease(accent ? "C4" : "G3", "32n", Tone.now());
}

/** Synchronous variant — caller is responsible for the audio context
 *  already being unlocked. Used by Tone.Transport scheduler callbacks
 *  so the tick fires at the exact scheduled time. */
export function playMetronomeTickAt(time: number, accent = false): void {
  ensureMetro();
  if (!metroSynth) return;
  metroSynth.triggerAttackRelease(accent ? "C4" : "G3", "32n", time);
}
