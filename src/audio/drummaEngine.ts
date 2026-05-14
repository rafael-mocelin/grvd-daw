/**
 * drummaEngine — audio engine for the DRUMMA training station.
 *
 * 16-step drum pattern player with three synthesized voices: kick
 * (MembraneSynth), snare (NoiseSynth), hat (MetalSynth). Ported from
 * the concept/3-den prototype's denEngine and trimmed down to just
 * the bits we need on the jam-stage.
 *
 * Lives on the master Tone.Transport so the station's metronome /
 * playhead automatically follow whatever BPM the station sets. The
 * jam stage's transport is paused (by JamView) before the station
 * mounts, so this engine has the transport to itself.
 *
 * Public API:
 *   - startDrumPattern(pattern, bpm) — start (or restart) the loop.
 *   - updateDrumPattern(pattern)     — swap the pattern in-place
 *                                       without restarting the loop;
 *                                       used so live edits to the
 *                                       grid take effect immediately.
 *   - stopDrumPattern()              — stop + dispose the sequence.
 *   - getCurrentStepIndex()          — 0..15 step the playhead is on
 *                                       right now; -1 when stopped.
 *
 * Voices are synthesized rather than sample-based so the prototype
 * is bulletproof offline / on slow networks.
 */

import * as Tone from "tone";
import { ensureAudio, setBpm } from "./engine";

/** A 16-step pattern across 3 rows. true = hit, false = rest. */
export interface DrumPattern {
  kick:  boolean[];   // length 16
  snare: boolean[];
  hat:   boolean[];
}

let kickSynth:  Tone.MembraneSynth   | null = null;
let snareSynth: Tone.NoiseSynth      | null = null;
let hatSynth:   Tone.MetalSynth      | null = null;
let stepSeq:    Tone.Sequence<number> | null = null;
let activePattern: DrumPattern | null = null;

function ensureDrumVoices() {
  if (kickSynth && snareSynth && hatSynth) return;

  kickSynth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves:    4,
    envelope:   { attack: 0.001, decay: 0.22, sustain: 0, release: 0.05 },
    volume:     -4,
  }).toDestination();

  snareSynth = new Tone.NoiseSynth({
    noise:    { type: "white" },
    envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.08 },
    volume:   -10,
  }).toDestination();

  hatSynth = new Tone.MetalSynth({
    envelope:   { attack: 0.001, decay: 0.04, release: 0.03 },
    harmonicity:      5.1,
    modulationIndex:  32,
    resonance:        4000,
    octaves:          1.5,
    volume:           -22,
  }).toDestination();
}

/**
 * Start (or restart) the step sequencer with a given pattern. Loops
 * until stopDrumPattern() is called.
 */
export async function startDrumPattern(pattern: DrumPattern, bpm = 140): Promise<void> {
  await ensureAudio();
  ensureDrumVoices();
  setBpm(bpm);

  // Tear down any existing sequence.
  stopDrumPattern();
  activePattern = pattern;

  stepSeq = new Tone.Sequence<number>(
    (time, step) => {
      const p = activePattern;
      if (!p) return;
      if (p.kick[step])  kickSynth?.triggerAttackRelease("C2", "16n", time);
      if (p.snare[step]) snareSynth?.triggerAttackRelease("16n", time);
      if (p.hat[step])   hatSynth?.triggerAttackRelease("C5", "32n", time, 0.6);
    },
    Array.from({ length: 16 }, (_, i) => i),
    "16n",
  );
  stepSeq.start(0);

  if (Tone.getTransport().state !== "started") {
    Tone.getTransport().position = "0:0:0";
    Tone.getTransport().start();
  }
}

/** Swap the active pattern in-place so live grid edits affect the
 *  loop without a stop/start glitch. */
export function updateDrumPattern(pattern: DrumPattern): void {
  activePattern = pattern;
}

export function stopDrumPattern(): void {
  if (stepSeq) {
    try { stepSeq.stop(); }    catch { /* ignore */ }
    try { stepSeq.dispose(); } catch { /* ignore */ }
    stepSeq = null;
  }
  activePattern = null;
}

/** 0..15 step the playhead is on right now; -1 when no sequence is
 *  active. The station polls this on rAF to drive the column-
 *  highlight + the scrolling tap-target lane. */
export function getCurrentStepIndex(): number {
  if (!stepSeq || !activePattern) return -1;
  const pos = Tone.getTransport().position.toString();
  const parts = pos.split(":");
  if (parts.length < 3) return -1;
  const beats     = parseInt(parts[1], 10);
  const sixteenth = Math.floor(parseFloat(parts[2]));
  return ((beats * 4) + sixteenth) % 16;
}
