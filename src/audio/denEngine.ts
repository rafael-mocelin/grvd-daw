/**
 * denEngine — audio engine for the DEN flow.
 *
 * Two responsibilities:
 *
 *   1. Step sequencer for DRUMMA's tap-pattern mini-game. Given a 16-step
 *      pattern (kick / snare / hat rows), schedule the right one-shot
 *      voices on the master transport. The pattern loops until stopped.
 *
 *   2. Stem playback. After mini-games complete, we have a set of stems
 *      (drum sequence, melody loop, vocal loop, etc). The den engine can
 *      play them all together as the "final track" preview on the boss
 *      / library screen.
 *
 * Tone is imported here only — components stay on the engine boundary.
 */

import * as Tone from "tone";
import { ensureAudio, setBpm } from "./engine";
import { getSound } from "../data/sounds";

/* -------------------------------------------------------------------------- */
/* Step sequencer                                                              */
/* -------------------------------------------------------------------------- */

/** A 16-step pattern across 3 rows. true = hit, false = rest. */
export interface DrumPattern {
  kick:  boolean[];   // length 16
  snare: boolean[];
  hat:   boolean[];
}

let kickSynth:  Tone.MembraneSynth | null = null;
let snareSynth: Tone.NoiseSynth    | null = null;
let hatSynth:   Tone.MetalSynth    | null = null;
let stepSeq:    Tone.Sequence<number> | null = null;
let activePattern: DrumPattern | null = null;

function ensureDrumVoices() {
  if (kickSynth && snareSynth && hatSynth) return;

  // Punchy kick — synthesized so we don't have to wait on sample loads
  // and the prototype is bulletproof offline.
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
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance:  4000,
    octaves:    1.5,
    volume:     -22,
  }).toDestination();
}

/**
 * Start (or restart) the step sequencer with a given pattern. Loops
 * until stopDrumPattern() is called.
 */
export async function startDrumPattern(pattern: DrumPattern, bpm = 96): Promise<void> {
  await ensureAudio();
  ensureDrumVoices();
  setBpm(bpm);

  // Tear down any existing sequence.
  stopDrumPattern();

  activePattern = pattern;

  // Sequence yields step indices 0..15; each step plays whichever rows
  // are active at that index. 16 sixteenth-notes per bar.
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

/** Update the active pattern in-place — used so live edits to the grid
 *  immediately affect what the loop is playing without a stop/start. */
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

/** Helper used by the UI to highlight the playhead step. Returns -1 if
 *  no sequence is active. */
export function getCurrentStepIndex(): number {
  if (!stepSeq || !activePattern) return -1;
  // Tone's transport.position is a bars:beats:sixteenths string.
  const pos = Tone.getTransport().position.toString();
  const parts = pos.split(":");
  if (parts.length < 3) return -1;
  const beats     = parseInt(parts[1], 10);
  const sixteenth = Math.floor(parseFloat(parts[2]));
  return ((beats * 4) + sixteenth) % 16;
}

/* -------------------------------------------------------------------------- */
/* Stem layer playback (used by Library / final-track preview)                 */
/* -------------------------------------------------------------------------- */

interface StemLayer {
  player: Tone.Player;
  gain:   Tone.Gain;
}

const stemLayers = new Map<string, StemLayer>();

export async function playStem(soundId: string, masterBpm: number): Promise<void> {
  await ensureAudio();
  if (stemLayers.has(soundId)) return;

  const sound = getSound(soundId);
  if (!sound?.fileUrl || !sound.nativeBpm) return;

  const rate = masterBpm / sound.nativeBpm;
  const player = new Tone.Player({
    url:           sound.fileUrl,
    loop:          true,
    playbackRate:  rate,
  });
  const gain = new Tone.Gain(1.0);
  player.connect(gain);
  gain.toDestination();

  await new Promise<void>((resolve) => {
    if (player.loaded) { resolve(); return; }
    const t0 = Date.now();
    const poll = setInterval(() => {
      if (player.loaded) { clearInterval(poll); resolve(); }
      else if (Date.now() - t0 > 6000) { clearInterval(poll); resolve(); }
    }, 30);
  });

  if (Tone.getTransport().state !== "started") {
    setBpm(masterBpm);
    Tone.getTransport().position = "0:0:0";
    Tone.getTransport().start();
  }

  // Phase-aligned drop-in
  const sourceDur = player.buffer?.duration ?? 0;
  const outputDur = sourceDur / (player.playbackRate || 1);
  const transportSec = Tone.getTransport().seconds;
  const offset = isFinite(outputDur) && outputDur > 0
    ? ((transportSec % outputDur) + outputDur) % outputDur * (player.playbackRate || 1)
    : 0;
  try { player.start(Tone.now(), offset); } catch { /* ignore */ }

  stemLayers.set(soundId, { player, gain });
}

export function stopStem(soundId: string): void {
  const l = stemLayers.get(soundId);
  if (!l) return;
  try { l.player.stop(); }    catch { /* ignore */ }
  try { l.player.dispose(); } catch { /* ignore */ }
  try { l.gain.dispose(); }   catch { /* ignore */ }
  stemLayers.delete(soundId);
}

export function stopAllStems(): void {
  for (const id of Array.from(stemLayers.keys())) stopStem(id);
}

/** Hard reset — kills the drum sequence AND all stems. Called on quit. */
export function resetDenAudio(): void {
  stopDrumPattern();
  stopAllStems();
}
