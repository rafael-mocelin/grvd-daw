/**
 * GRVD audio engine — Tone.js based.
 *
 * Phase 2 of engine development:
 * - Real drum samples loaded from Tone.js CDN (graceful synthesis fallback)
 * - Real piano samples via Tone.Sampler (Salamander Grand) for all melodic layers
 * - Synthesis is kept as fallback if CDN is unreachable
 */

import * as Tone from "tone";
import type { Song, Layer, LayerKind } from "../data/types";
import { getSound } from "../data/sounds";

type VoiceBuilder = (time: number, note?: string) => void;

let audioStarted = false;
let currentTransportBpm = 90;
const layerParts  = new Map<string, Tone.Part>();
const layerSynths = new Map<string, Tone.ToneAudioNode[]>();
/** Volume control Gain node per layer — inserted between chain output and destination */
const layerVolumes     = new Map<string, Tone.Gain>();
/** Linear gain value (0–1.5) remembered per layer for unmute restore */
const layerGainValues  = new Map<string, number>();

/* Autotune — live PitchShift node on the vocal player; toggled by Mixer AT button */
let vocalPitchShift: Tone.PitchShift | null = null;
let vocalPitchSemitones = 0;  // pre-calculated correction from last recording

/** Enable / disable autotune on the currently playing vocal track. */
export function setVocalAutotuneEnabled(enabled: boolean) {
  if (vocalPitchShift) {
    vocalPitchShift.wet.value = enabled ? 1 : 0;
  }
}

/** Store the correction offset (semitones) so makeVocalPlayer can pre-load it. */
export function setVocalPitchCorrection(semitones: number) {
  vocalPitchSemitones = semitones;
  if (vocalPitchShift) vocalPitchShift.pitch = semitones;
}

/* -------------------------------------------------------------------------- */
/* Pitch correction helper                                                      */
/* -------------------------------------------------------------------------- */

const NOTE_TO_PC: Record<string, number> = {
  C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5,
  "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11,
};
// Minor scale intervals (relative to root)
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

/**
 * Given a pitch contour (MIDI notes, -1 = unvoiced) and a key root,
 * return the semitone offset that snaps the median voiced pitch to the
 * nearest note in the minor scale. Used to set the initial autotune correction.
 */
export function calculatePitchCorrection(pitches: number[], keyRoot: string): number {
  const voiced = pitches.filter((p) => p > 0);
  if (voiced.length === 0) return 0;

  const sorted = [...voiced].sort((a, b) => a - b);
  const medianMidi = sorted[Math.floor(sorted.length / 2)];
  const rootPc = NOTE_TO_PC[keyRoot] ?? 9;
  const pc = medianMidi % 12;
  const relPc = ((pc - rootPc) + 12) % 12;

  let closest = MINOR_SCALE[0];
  let minDist = 13;
  for (const interval of MINOR_SCALE) {
    const dist = Math.min(Math.abs(relPc - interval), 12 - Math.abs(relPc - interval));
    if (dist < minDist) { minDist = dist; closest = interval; }
  }

  const targetPc = (rootPc + closest) % 12;
  let semitones = targetPc - pc;
  if (semitones > 6)  semitones -= 12;
  if (semitones < -6) semitones += 12;
  return semitones;
}

/* -------------------------------------------------------------------------- */
/* Sample bank — loaded once at startup                                        */
/* -------------------------------------------------------------------------- */

const DRUM_CDN = "https://tonejs.github.io/audio/drum-samples/CR78";
const PIANO_CDN = "https://tonejs.github.io/audio/salamander";

const drumBank: {
  kick?: Tone.ToneAudioBuffer;
  snare?: Tone.ToneAudioBuffer;
  hat?: Tone.ToneAudioBuffer;
} = {};

let pianoSampler: Tone.Sampler | null = null;
let samplesLoadAttempted = false;

export async function loadSamples(): Promise<void> {
  if (samplesLoadAttempted) return;
  samplesLoadAttempted = true;

  // Load drum one-shots
  await Promise.allSettled([
    Tone.ToneAudioBuffer.fromUrl(`${DRUM_CDN}/kick.mp3`)
      .then((b) => { drumBank.kick = b; })
      .catch(() => { /* stay on synthesis */ }),
    Tone.ToneAudioBuffer.fromUrl(`${DRUM_CDN}/snare.mp3`)
      .then((b) => { drumBank.snare = b; })
      .catch(() => {}),
    Tone.ToneAudioBuffer.fromUrl(`${DRUM_CDN}/hihat_closed.mp3`)
      .then((b) => { drumBank.hat = b; })
      .catch(() => {}),
  ]);

  // Load Salamander piano for all melodic content
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(resolve, 8000); // cap at 8s
    pianoSampler = new Tone.Sampler({
      urls: { A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3", C5: "C5.mp3" },
      baseUrl: `${PIANO_CDN}/`,
      onload: () => {
        clearTimeout(timeout);
        resolve();
      },
      onerror: () => {
        clearTimeout(timeout);
        pianoSampler = null; // fall back to synthesis
        resolve();
      },
    });
  });
}

export function samplesLoaded(): boolean {
  return samplesLoadAttempted;
}

export async function ensureAudio() {
  if (audioStarted) return;
  await Tone.start();
  audioStarted = true;
}

export function setBpm(bpm: number) {
  currentTransportBpm = bpm;
  Tone.getTransport().bpm.value = bpm;
}

export function getBpm() { return currentTransportBpm; }
export function isStarted() { return audioStarted; }

/* -------------------------------------------------------------------------- */
/* Master analyser — shell face visuals tap this for audio-reactivity          */
/* -------------------------------------------------------------------------- */

let masterAnalyser: Tone.Analyser | null = null;

/**
 * Lazy-create a single Tone.Analyser hooked to the master output
 * (Tone.getDestination()). Callers can read .getValue() every frame
 * to drive visuals (eye pupils, chest pulse, etc.).
 *
 * Safe to call before audio is started — the analyser returns zeros
 * until Tone's context actually produces signal. Created at most once.
 */
export function getMasterAnalyser(): Tone.Analyser {
  if (!masterAnalyser) {
    masterAnalyser = new Tone.Analyser("waveform", 256);
    // Tap destination non-destructively — the analyser is a parallel sink,
    // it does not alter the sound the user hears.
    Tone.getDestination().connect(masterAnalyser);
  }
  return masterAnalyser;
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

function disposeMany(nodes: Tone.ToneAudioNode[]) {
  for (const n of nodes) {
    try { n.dispose(); } catch { /* ignore */ }
  }
}

/* -------------------------------------------------------------------------- */
/* Voice builders — real samples preferred, synthesis fallback                 */
/* -------------------------------------------------------------------------- */

function makeKick() {
  if (drumBank.kick) {
    const player = new Tone.Player(drumBank.kick);
    const comp = new Tone.Compressor(-12, 4);
    const gain = new Tone.Gain(1.2);
    player.chain(comp, gain, Tone.getDestination());
    const builder: VoiceBuilder = (time) => player.start(time);
    return { builder, nodes: [player, comp, gain] as Tone.ToneAudioNode[] };
  }
  // Synthesis fallback
  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.08,
    octaves: 7,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.3 },
  });
  const dist = new Tone.Distortion(0.25);
  const comp = new Tone.Compressor(-8, 4);
  kick.chain(dist, comp, Tone.getDestination());
  const builder: VoiceBuilder = (time) => kick.triggerAttackRelease("C1", 0.25, time, 1.0);
  return { builder, nodes: [kick, dist, comp] as Tone.ToneAudioNode[] };
}

function makeSnare() {
  if (drumBank.snare) {
    const player = new Tone.Player(drumBank.snare);
    const eq = new Tone.EQ3({ low: -4, mid: 2, high: 3 });
    const gain = new Tone.Gain(1.1);
    player.chain(eq, gain, Tone.getDestination());
    const builder: VoiceBuilder = (time) => player.start(time);
    return { builder, nodes: [player, eq, gain] as Tone.ToneAudioNode[] };
  }
  // Synthesis fallback
  const noise = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
  });
  const body = new Tone.MembraneSynth({
    pitchDecay: 0.025,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  });
  const hp = new Tone.Filter(350, "highpass");
  noise.chain(hp, Tone.getDestination());
  body.connect(Tone.getDestination());
  const builder: VoiceBuilder = (time) => {
    noise.triggerAttackRelease(0.18, time, 0.65);
    body.triggerAttackRelease("G2", 0.1, time, 0.65);
  };
  return { builder, nodes: [noise, body, hp] as Tone.ToneAudioNode[] };
}

function makeHat() {
  if (drumBank.hat) {
    const player = new Tone.Player(drumBank.hat);
    const gain = new Tone.Gain(0.7);
    player.chain(gain, Tone.getDestination());
    const builder: VoiceBuilder = (time) => player.start(time);
    return { builder, nodes: [player, gain] as Tone.ToneAudioNode[] };
  }
  // Synthesis fallback
  const hat = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.07, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
  });
  const gain = new Tone.Gain(0.32);
  hat.chain(gain, Tone.getDestination());
  const builder: VoiceBuilder = (time) => hat.triggerAttackRelease("32n", time, 0.55);
  return { builder, nodes: [hat, gain] as Tone.ToneAudioNode[] };
}

function makeEightOhEight() {
  const synth = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.005, decay: 0.5, sustain: 0.25, release: 0.8 },
    filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.5, baseFrequency: 60 },
  });
  const sub = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.6, sustain: 0.1, release: 0.5 },
  });
  const drive = new Tone.Distortion(0.4);
  const lp = new Tone.Filter(180, "lowpass");
  const gain = new Tone.Gain(0.9);
  synth.chain(drive, lp, gain, Tone.getDestination());
  sub.chain(gain, Tone.getDestination());
  const builder: VoiceBuilder = (time, note) => {
    const n = note ?? "C2";
    synth.triggerAttackRelease(n, "2n", time, 0.9);
    sub.triggerAttackRelease(n.replace(/\d/, (d) => String(parseInt(d) - 1)), "2n", time, 0.5);
  };
  return { builder, nodes: [synth, sub, drive, lp, gain] as Tone.ToneAudioNode[] };
}

/* Piano-based sample/melody — uses real Salamander samples when available */

function makePianoLayer(options: {
  reverb: number;
  reverbWet: number;
  filterFreq: number;
  delayWet: number;
  volume: number;
  attack: number;
  release: number;
}) {
  const reverb = new Tone.Reverb({ decay: options.reverb, wet: options.reverbWet });
  const delay = new Tone.FeedbackDelay("8n.", options.delayWet);
  const filter = new Tone.Filter(options.filterFreq, "lowpass");
  const gain = new Tone.Gain(options.volume);
  filter.chain(delay, reverb, gain, Tone.getDestination());

  let builder: VoiceBuilder;
  const nodes: Tone.ToneAudioNode[] = [filter, delay, reverb, gain];

  if (pianoSampler) {
    // Clone the sampler chain — connect to our filter
    const localSampler = new Tone.Sampler({
      urls: { A2: "A2.mp3", A3: "A3.mp3", A4: "A4.mp3", A5: "A5.mp3", C5: "C5.mp3" },
      baseUrl: `${PIANO_CDN}/`,
    }).connect(filter);
    nodes.unshift(localSampler);
    builder = (time, note) =>
      localSampler.triggerAttackRelease(note ?? "C4", options.release < 1 ? "8n" : "2n", time, 0.75);
  } else {
    // Synthesis fallback
    const poly = new Tone.PolySynth(Tone.AMSynth, {
      oscillator: { type: options.filterFreq < 2000 ? "sawtooth" : "sine" },
      envelope: { attack: options.attack, decay: 0.3, sustain: 0.6, release: options.release },
    });
    poly.connect(filter);
    nodes.unshift(poly);
    builder = (time, note) => poly.triggerAttackRelease(note ?? "C4", "2n", time, 0.7);
  }

  return { builder, nodes };
}

function makeSample(sampleId: string) {
  const isDark = sampleId.includes("dark");
  const isDream = sampleId.includes("dream");
  return makePianoLayer({
    reverb: isDream ? 4.5 : isDark ? 1.2 : 1.8,
    reverbWet: isDream ? 0.5 : isDark ? 0.2 : 0.28,
    filterFreq: isDark ? 900 : isDream ? 4000 : 3200,
    delayWet: isDark ? 0.1 : 0.22,
    volume: 0.5,
    attack: isDream ? 0.5 : 0.02,
    release: isDream ? 2.5 : 1.0,
  });
}

function makeMelody(melodyId: string) {
  const isPluck = melodyId.includes("pluck");
  const isBell = melodyId.includes("bell");
  return makePianoLayer({
    reverb: isBell ? 2.5 : isPluck ? 1.0 : 1.8,
    reverbWet: isBell ? 0.4 : isPluck ? 0.2 : 0.3,
    filterFreq: isBell ? 8000 : isPluck ? 4000 : 5000,
    delayWet: isPluck ? 0.15 : 0.25,
    volume: 0.55,
    attack: isPluck ? 0.005 : isBell ? 0.005 : 0.02,
    release: isPluck ? 0.4 : isBell ? 0.8 : 0.6,
  });
}

/* -------------------------------------------------------------------------- */
/* Autotune helpers                                                             */
/* -------------------------------------------------------------------------- */

const CHROMATIC_PC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
// Minor pentatonic intervals: root, m3, P4, P5, m7 — most common in hip-hop/trap
const MINOR_PENTA = [0, 3, 5, 7, 10];

/**
 * Snap a MIDI note to the nearest note in the song's minor pentatonic key.
 * Returns the corrected MIDI note number.
 */
function snapMidiToKey(midi: number, keyRoot: string): number {
  const rootPc = CHROMATIC_PC.indexOf(keyRoot.replace("b", "#")); // normalize flats to sharps
  if (rootPc < 0) return midi;
  const pc = ((midi % 12) + 12) % 12;
  let bestDiff = 12;
  for (const interval of MINOR_PENTA) {
    const keyPc = (rootPc + interval) % 12;
    let diff = keyPc - pc;
    if (diff > 6)  diff -= 12;
    if (diff < -6) diff += 12;
    if (Math.abs(diff) < Math.abs(bestDiff)) bestDiff = diff;
  }
  return midi + bestDiff;
}

/**
 * Schedule frame-by-frame pitch correction on an already-created PitchShift node.
 * Creates a Tone.Part that loops at the same rate as the vocal buffer.
 */
function scheduleAutotune(
  pitchShift: Tone.PitchShift,
  contour: number[],
  keyRoot: string,
  bpm: number,
  bufferBars: number,
  layerId: string,
) {
  const secPerBar = (60 / bpm) * 4;
  const CONTOUR_HOP = 0.03; // 30ms — matches estimatePitchContour hop
  const events: Array<[string, number]> = [];
  let prevCorr = 0;

  contour.forEach((midi, i) => {
    const t = i * CONTOUR_HOP;
    if (t >= bufferBars * secPerBar) return; // don't schedule past buffer end

    const corr = midi > 0
      ? Math.round(snapMidiToKey(midi, keyRoot) - midi)
      : prevCorr; // hold correction during unvoiced frames

    // Only emit an event when the correction changes (reduces Part overhead)
    if (corr !== prevCorr || i === 0) {
      const bar   = Math.floor(t / secPerBar);
      const beat  = Math.floor((t % secPerBar) / (secPerBar / 4));
      const six   = Math.floor(((t % secPerBar) % (secPerBar / 4)) / (secPerBar / 16));
      events.push([`${bar}:${beat}:${six}`, corr]);
      prevCorr = corr;
    }
  });

  if (events.length === 0) return;

  const part = new Tone.Part((_, value) => {
    pitchShift.pitch = value as number;
  }, events);
  part.loop = true;
  part.loopEnd = `${bufferBars}m`;
  part.start(0);
  layerParts.set(`${layerId}-at`, part);   // stored so stopSong can dispose it
}

/* -------------------------------------------------------------------------- */
/* Vocal player                                                                  */
/* -------------------------------------------------------------------------- */

function makeVocalPlayer(buffer: AudioBuffer | null) {
  if (!buffer) return null;
  const tBuf = Tone.ToneAudioBuffer.fromArray(buffer.getChannelData(0));
  const player = new Tone.Player(tBuf);

  // Autotune via PitchShift — ON by default; Mixer AT button toggles wet 0↔1
  // windowSize 80 ms = best trade-off between voice quality and latency artifact
  const pitchShift = new Tone.PitchShift({ pitch: vocalPitchSemitones, windowSize: 0.08 });
  pitchShift.wet.value = 1;     // active by default
  vocalPitchShift = pitchShift; // keep global ref so setVocalAutotuneEnabled can toggle it

  const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.18 });
  const gain   = new Tone.Gain(0.9);
  player.chain(pitchShift, reverb, gain, Tone.getDestination());
  return { player, nodes: [player, pitchShift, reverb, gain] as Tone.ToneAudioNode[] };
}

/* -------------------------------------------------------------------------- */
/* Pattern scheduling                                                          */
/* -------------------------------------------------------------------------- */

function patternFor(kind: LayerKind, variant: string): string[] {
  const variants: Record<string, Record<string, string>> = {
    kick: {
      boom: "x---x---x---x---",
      trap: "x-----x-x-----x-",
      halftime: "x---------------",
      bounce: "x---x-x-x---x-x-",
    },
    snare: {
      clap: "----x-------x---",
      rim: "----x--x----x--x",
      halftime: "--------x-------",
    },
    hat: {
      eighths: "x-x-x-x-x-x-x-x-",
      trills: "xxxxxxxxxxxxxxxx",
      skip: "x-x-x--xx-x-x-xx",
      sixteenths: "xxxxxxxxxxxxxxxx",
    },
    "808": {
      root: "x-------x-------",
      move: "x---x---x-x-x---",
      long: "x---------------",
    },
    sample: {
      chords: "x---------------",
      stab: "x-------x-------",
      loop: "x---x---x---x---",
    },
    melody: {
      hook: "x---x---x-x-x---",
      sparse: "x-------x-------",
      rolling: "x-x-x-x-x-x-x-x-",
    },
    vocal: {
      hook: "x---------------",
    },
  };
  return (variants[kind]?.[variant] ?? "x---------------").split("");
}

function noteSequenceFor(kind: LayerKind, keyRoot: string): string[] {
  const minor = ["0", "3", "5", "7"];
  const octave = kind === "808" ? 2 : 4;
  return minor.map((semi) => transpose(keyRoot + octave, parseInt(semi)));
}

function transpose(note: string, semitones: number): string {
  const chromatic = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const match = note.match(/^([A-G]#?)(\d+)$/);
  if (!match) return note;
  const base = match[1];
  const oct = parseInt(match[2]);
  const idx = chromatic.indexOf(base);
  if (idx < 0) return note;
  const total = idx + semitones + oct * 12;
  const newIdx = ((total % 12) + 12) % 12;
  const newOct = Math.floor(total / 12);
  return `${chromatic[newIdx]}${newOct}`;
}

/* -------------------------------------------------------------------------- */
/* File-backed loop player                                                     */
/* -------------------------------------------------------------------------- */

function makeFileLoop(fileUrl: string, nativeBpm: number, templateBpm: number) {
  const rate = templateBpm / nativeBpm;
  const player = new Tone.Player({
    url: fileUrl,
    loop: true,
    playbackRate: rate,
  });
  const gain = new Tone.Gain(0.85);
  player.connect(gain);
  gain.toDestination();
  // builder triggers loop start; stop is handled by stopSong
  const builder: VoiceBuilder = (time) => { player.start(time); };
  return { builder, nodes: [player, gain] as Tone.ToneAudioNode[], isFileLoop: true };
}

function buildVoice(
  layer: Layer,
  vocalBuffer: AudioBuffer | null,
  templateBpm?: number
): { builder: VoiceBuilder | null; nodes: Tone.ToneAudioNode[]; isPlayer?: boolean; isFileLoop?: boolean; isVocal?: boolean } {
  // File-backed sounds always take priority — kind doesn't matter for routing
  const sound = getSound(layer.soundId);
  if (sound?.fileUrl && sound.nativeBpm) {
    return makeFileLoop(sound.fileUrl, sound.nativeBpm, templateBpm ?? sound.nativeBpm);
  }

  switch (layer.kind) {
    case "drums":  return makeKick(); // synth fallback for drums kind
    case "kick":   return makeKick();
    case "snare":  return makeSnare();
    case "hat":    return makeHat();
    case "808":    return makeEightOhEight();
    case "sample": return makeSample(layer.variant);
    case "melody": return makeMelody(layer.variant);
    case "vocal": {
      const v = makeVocalPlayer(vocalBuffer);
      if (!v) return { builder: null, nodes: [] };
      return { builder: null, nodes: v.nodes, isPlayer: true, isVocal: true };
    }
    default: return { builder: null, nodes: [] };
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export async function playSong(song: Song, vocalBuffer: AudioBuffer | null) {
  await ensureAudio();
  stopSong();
  setBpm(song.bpm);

  for (const layer of song.layers) {
    const { builder, nodes, isPlayer, isFileLoop, isVocal } = buildVoice(layer, vocalBuffer, song.bpm);
    layerSynths.set(layer.id, nodes);

    // Insert a dedicated volume-control Gain between the chain output and destination.
    // We try-disconnect every node from destination and reconnect through volCtrl —
    // intermediate nodes silently fail (they're not connected to destination anyway).
    const volCtrl = new Tone.Gain(1.0);
    volCtrl.toDestination();
    for (const n of nodes) {
      try { n.disconnect(Tone.getDestination()); n.connect(volCtrl); } catch { /* not wired to dest */ }
    }
    layerVolumes.set(layer.id, volCtrl);
    layerGainValues.set(layer.id, 1.0);

    // File loops: schedule a single start at t=0; Tone.Player handles looping
    if (isFileLoop && builder) {
      const part = new Tone.Part((time) => { builder(time); }, [["0:0:0"]]);
      part.start(0);
      layerParts.set(layer.id, part);
      continue;
    }

    if (isPlayer) {
      const player = nodes[0] as Tone.Player;
      // Vocal: loop based on the actual recording duration, not song.bars.
      // A 4-bar hook recording loops every 4 bars so it plays over both HOOK and CHORUS.
      let loopBars = song.bars;
      if (isVocal && player.buffer?.duration) {
        loopBars = Math.max(1, Math.round(player.buffer.duration * (song.bpm / 60) / 4));
      }
      const part = new Tone.Part((time) => { player.start(time); }, [["0:0:0"]]).start(0);
      part.loop = true;
      part.loopEnd = `${loopBars}m`;
      layerParts.set(layer.id, part);
      continue;
    }

    if (!builder) continue;
    const steps = patternFor(layer.kind, layer.variant);
    const notes = noteSequenceFor(layer.kind, song.keyRoot);
    const events: Array<[string, string]> = [];
    for (let bar = 0; bar < song.bars; bar++) {
      for (let step = 0; step < 16; step++) {
        if (steps[step] === "x") {
          const t = `${bar}:${Math.floor(step / 4)}:${step % 4}`;
          const note = notes[(bar + Math.floor(step / 4)) % notes.length];
          events.push([t, note]);
        }
      }
    }
    const part = new Tone.Part((time, value) => {
      builder(time, value as unknown as string);
    }, events);
    part.start(0);
    layerParts.set(layer.id, part);
  }

  // Wait for any file-backed buffers to finish loading before starting transport
  await Tone.loaded();
  Tone.getTransport().position = "0:0:0";
  Tone.getTransport().start();
}

export function stopSong() {
  vocalPitchShift = null;  // clear live ref; next playSong will recreate it
  Tone.getTransport().stop();
  Tone.getTransport().cancel(0);
  for (const p of layerParts.values()) {
    try { p.stop(); p.dispose(); } catch { /* ignore */ }
  }
  layerParts.clear();
  for (const nodes of layerSynths.values()) {
    disposeMany(nodes);
  }
  layerSynths.clear();
  for (const v of layerVolumes.values()) {
    try { v.dispose(); } catch { /* ignore */ }
  }
  layerVolumes.clear();
  layerGainValues.clear();
}

/** Mute or unmute a layer — restores previous fader level on unmute. */
export function updateMuteState(layerId: string, muted: boolean) {
  const vol = layerVolumes.get(layerId);
  if (vol) {
    vol.gain.value = muted ? 0 : (layerGainValues.get(layerId) ?? 1.0);
    return;
  }
  // Fallback when no volCtrl exists (e.g. preview paths)
  const nodes = layerSynths.get(layerId);
  if (!nodes) return;
  for (const n of nodes) {
    const g = (n as { volume?: { value: number } }).volume;
    if (g) g.value = muted ? -60 : 0;
  }
}

/** Set a layer's volume (linear gain 0–1.5). Remembered for unmute restore. */
export function setLayerVolume(layerId: string, linear: number) {
  const gain = Math.max(0, linear);
  layerGainValues.set(layerId, gain);
  const vol = layerVolumes.get(layerId);
  if (vol) vol.gain.value = gain;
}

/** Returns the transport's current elapsed time in seconds. */
export function getTransportSeconds(): number {
  return Tone.getTransport().seconds;
}

/** Seek the transport to an absolute time in seconds. */
export function seekTransport(seconds: number) {
  Tone.getTransport().seconds = Math.max(0, seconds);
}

/* -------------------------------------------------------------------------- */
/* Offline render → WAV                                                        */
/* -------------------------------------------------------------------------- */

export async function renderSongToWav(
  song: Song,
  vocalBuffer: AudioBuffer | null
): Promise<Blob> {
  const seconds = (song.bars * 4 * 60) / song.bpm;
  const rendered = await Tone.Offline(async (ctx) => {
    ctx.transport.bpm.value = song.bpm;
    for (const layer of song.layers) {
      const { builder, nodes, isPlayer } = buildVoice(layer, vocalBuffer);
      if (isPlayer) {
        const player = nodes[0] as Tone.Player;
        ctx.transport.schedule((time) => { player.start(time); }, 0);
        continue;
      }
      if (!builder) continue;
      const steps = patternFor(layer.kind, layer.variant);
      const notes = noteSequenceFor(layer.kind, song.keyRoot);
      for (let bar = 0; bar < song.bars; bar++) {
        for (let step = 0; step < 16; step++) {
          if (steps[step] === "x") {
            const t = `${bar}:${Math.floor(step / 4)}:${step % 4}`;
            const note = notes[(bar + Math.floor(step / 4)) % notes.length];
            ctx.transport.schedule((time) => builder(time, note), t);
          }
        }
      }
    }
    ctx.transport.start(0);
  }, seconds);

  const audioBuffer = rendered.get() as AudioBuffer;
  return encodeWav(audioBuffer);
}

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLength = buffer.length * blockAlign;
  const bufferLength = 44 + dataLength;
  const ab = new ArrayBuffer(bufferLength);
  const view = new DataView(ab);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample, true);
      offset += 2;
    }
  }
  return new Blob([ab], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/* -------------------------------------------------------------------------- */
/* One-shot preview — single at a time, new click interrupts previous         */
/* -------------------------------------------------------------------------- */

/** Calling this stops and cleans up whatever is currently previewing. */
let stopCurrentPreview: (() => void) | null = null;

export function stopPreview() {
  if (stopCurrentPreview) {
    stopCurrentPreview();
    stopCurrentPreview = null;
  }
}

export async function previewLayer(
  layer: Layer,
  keyRoot = "A",
  templateBpm = 140,
  onDone?: () => void,
) {
  // Interrupt any in-flight preview immediately
  stopPreview();

  try {
    await ensureAudio();
  } catch (err) {
    console.error("[previewLayer] audio context failed to start:", err);
    onDone?.();
    return;
  }

  const { builder, nodes, isFileLoop } = buildVoice(layer, null, templateBpm);

  if (!builder && !isFileLoop) {
    disposeMany(nodes);
    onDone?.();
    return;
  }

  if (isFileLoop) {
    // Poll for the specific player's buffer to finish loading (up to 6 s).
    // Relying on Tone.loaded() alone is unreliable — it can resolve before
    // a newly-created Player's buffer is registered with the loading manager.
    const player = nodes[0] as Tone.Player;
    const loaded = await new Promise<boolean>((resolve) => {
      if (player.loaded) { resolve(true); return; }
      const maxMs = 6000;
      const start = Date.now();
      const poll = setInterval(() => {
        if (player.loaded) { clearInterval(poll); resolve(true); }
        else if (Date.now() - start > maxMs) { clearInterval(poll); resolve(false); }
      }, 30);
    });

    if (!loaded) {
      // File didn't load — clean up and bail out silently
      disposeMany(nodes);
      onDone?.();
      return;
    }

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      try { player.stop(); } catch { /* ignore */ }
      disposeMany(nodes);
      if (stopCurrentPreview === cleanup) stopCurrentPreview = null;
      onDone?.();
    };

    try {
      player.start(Tone.now());
    } catch (err) {
      console.error("[previewLayer] sample player failed to start:", err);
      cleanup();
      return;
    }

    const timer = setTimeout(cleanup, 3500);
    stopCurrentPreview = () => { clearTimeout(timer); cleanup(); };
    return;
  }

  // Synth preview — schedule 4 hits then clean up
  if (!builder) { disposeMany(nodes); onDone?.(); return; }

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    disposeMany(nodes);
    if (stopCurrentPreview === cleanup) stopCurrentPreview = null;
    onDone?.();
  };

  try {
    const now = Tone.now();
    const notes = noteSequenceFor(layer.kind, keyRoot);
    for (let i = 0; i < 4; i++) {
      builder(now + i * 0.22, notes[i % notes.length]);
    }
  } catch (err) {
    console.error("[previewLayer] synth preview failed to schedule:", err);
    cleanup();
    return;
  }

  const timer = setTimeout(cleanup, 1800);
  stopCurrentPreview = () => { clearTimeout(timer); cleanup(); };
}

/* -------------------------------------------------------------------------- */
/* Vocal recording                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Record from the microphone for up to maxSeconds.
 *
 * The capture path is intentionally minimal: MediaRecorder reads from the raw
 * getUserMedia stream directly, bypassing the WebAudio graph entirely. The VU
 * meter (if requested) reads from a CLONED audio track so it can never starve
 * the recorder of signal.
 *
 * Why this shape: WebAudio routing for mic capture (parallel taps, series
 * through AnalyserNode, MediaStreamDestination, etc.) is fragile across
 * device + browser + OS combinations. Reading the raw stream is the one path
 * that works everywhere.
 *
 * @param maxSeconds Hard cap on recording duration.
 * @param onLevel    Optional callback fired ~20×/sec with RMS 0–1 for VU.
 */
export async function recordVocal(
  maxSeconds: number,
  onLevel?: (rms: number) => void
): Promise<{ blob: Blob; buffer: AudioBuffer }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Recording is not supported in this browser. Try Chrome, Edge, Firefox, or Safari.");
  }

  // ── Acquire the mic stream ─────────────────────────────────────────────
  // Tiered constraints, narrow → permissive. We prefer 2-channel capture
  // because some multi-channel USB interfaces (e.g. Scarlett Solo 4th Gen,
  // Apollo Twin, MOTU M-series) advertise 4+ channels to the OS — physical
  // inputs PLUS loopback/aggregate channels — and browsers can pick the
  // wrong pair without a strict constraint, yielding a stream that opens
  // successfully but contains zero signal.
  //
  // If the strict 2-channel constraint fails (mono mics, mobile devices,
  // some Bluetooth headsets), we fall through to looser constraints rather
  // than rejecting the user.
  const stream = await acquireMicStream();
  console.log("[recordVocal] track settings:", stream.getAudioTracks()[0].getSettings());

  // ── Pick a recording format the browser supports ───────────────────────
  // Order: best quality / widest playback support first. audio/mp4 is the
  // Safari/iOS path (it cannot decode webm/opus from MediaRecorder output).
  const mimeType = pickRecorderMimeType();

  let recorder: MediaRecorder;
  try {
    recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("Could not start recorder — your browser may not support audio recording. " + (err instanceof Error ? err.message : ""));
  }

  // ── VU meter on a CLONED audio track ────────────────────────────────────
  // Cloning the track gives the analyser its own independent consumer of the
  // same source frames, so reading it cannot interfere with what the
  // recorder is capturing from the original track.
  const vu = onLevel ? setupVuMeter(stream, onLevel) : null;

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const cleanup = () => {
    vu?.dispose();
    stream.getTracks().forEach((t) => t.stop());
  };

  return new Promise((resolve, reject) => {
    let stopTimer: ReturnType<typeof setTimeout> | null = null;

    recorder.onstop = async () => {
      if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
      cleanup();
      try {
        if (chunks.length === 0) {
          reject(new Error("No audio captured. Check that your browser has microphone permission for this site."));
          return;
        }
        const blobType = mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: blobType });
        if (blob.size < 500) {
          reject(new Error("Recording was empty. Your microphone may be muted or another app may be using it."));
          return;
        }

        const buffer = await decodeRecordedBlob(blob);
        const maxAmp = peakAmplitude(buffer);

        console.log(`[recordVocal] ${buffer.duration.toFixed(2)}s @ ${buffer.sampleRate}Hz, ${(blob.size / 1024).toFixed(0)}KB ${blobType}, maxAmp=${maxAmp.toFixed(4)}`);
        if (maxAmp < 0.001) {
          console.warn(
            "[recordVocal] silent recording — the mic stream opened but contained no signal.\n" +
            "Common causes:\n" +
            " • Multi-channel USB interface (Scarlett 4th Gen, Apollo) exposing loopback channels: enable 'Combine Inputs' in the device's control software.\n" +
            " • OS mic input level set to zero or device muted.\n" +
            " • Another app (Zoom, Discord, OBS) holding exclusive access to the device.",
          );
        }

        resolve({ blob, buffer });
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Failed to decode the recording."));
      }
    };

    recorder.onerror = (e) => {
      if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
      cleanup();
      reject(e instanceof Error ? e : new Error("Recorder error."));
    };

    recorder.start(100);  // 100ms timeslice keeps memory bounded for long takes
    stopTimer = setTimeout(() => {
      if (recorder.state !== "inactive") recorder.stop();
    }, maxSeconds * 1000);
  });
}

/**
 * Acquire a mic stream with a fallback chain that handles the long tail of
 * device quirks: multi-channel USB interfaces, mono devices, mobile, BT.
 */
async function acquireMicStream(): Promise<MediaStream> {
  const baseAudio = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  };

  // 1) Best case: 2-channel exact (forces the actual mic inputs on multi-ch
  //    interfaces; won't satisfy mono devices).
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { ...baseAudio, channelCount: { exact: 2 } },
    });
  } catch { /* fall through */ }

  // 2) Mono devices and BT headsets: drop the channel constraint, keep the
  //    no-processing flags so vocals stay intact when the beat plays.
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: baseAudio });
  } catch { /* fall through */ }

  // 3) Last resort: accept whatever the browser hands back, including any
  //    auto-applied processing. Some mobile browsers reject 'audio: object'
  //    entirely and only accept the boolean shorthand.
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/**
 * Pick the most widely-playable recording mimeType the browser supports.
 * Returns "" if no preferred type is supported (caller falls back to default).
 */
function pickRecorderMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus", // Chrome, Edge, Firefox — best quality
    "audio/webm",
    "audio/ogg;codecs=opus",  // Firefox legacy
    "audio/mp4",              // Safari / iOS
    "audio/mp4;codecs=mp4a.40.2",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "";
}

/**
 * Set up a VU meter that reads from a clone of the recording track.
 * Returns null if setup fails — recording continues silently in that case.
 */
function setupVuMeter(stream: MediaStream, onLevel: (rms: number) => void) {
  try {
    const audioCtx = Tone.getContext().rawContext as AudioContext;
    // Don't await Tone.start() here — recordVocal is invoked from a user
    // gesture handler upstream and Tone has typically already been started
    // by sound preview or playback. If the context is suspended we still get
    // valid time-domain data after it resumes; the meter will just be flat
    // briefly.
    const clonedTrack = stream.getAudioTracks()[0].clone();
    const vuStream = new MediaStream([clonedTrack]);
    const source = audioCtx.createMediaStreamSource(vuStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      onLevel(Math.sqrt(sum / buf.length));
    }, 50);

    return {
      dispose() {
        clearInterval(timer);
        try { source.disconnect(); } catch { /* ignore */ }
        try { analyser.disconnect(); } catch { /* ignore */ }
        try { vuStream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      },
    };
  } catch (err) {
    console.warn("[recordVocal] VU meter unavailable (recording continues):", err);
    return null;
  }
}

/**
 * Decode the recorded blob to an AudioBuffer. Tries the live Tone context
 * first (most efficient); falls back to a throwaway context if Tone's
 * context is in a state that rejects the decode.
 */
async function decodeRecordedBlob(blob: Blob): Promise<AudioBuffer> {
  const ab = await blob.arrayBuffer();
  try {
    const ctx = Tone.getContext().rawContext as AudioContext;
    return await ctx.decodeAudioData(ab.slice(0));
  } catch {
    const tmpCtx = new AudioContext();
    try {
      return await tmpCtx.decodeAudioData(ab.slice(0));
    } finally {
      tmpCtx.close().catch(() => { /* ignore */ });
    }
  }
}

function peakAmplitude(buffer: AudioBuffer): number {
  let max = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < ch.length; i++) {
      const abs = Math.abs(ch[i]);
      if (abs > max) max = abs;
    }
  }
  return max;
}

/**
 * Autocorrelation pitch estimator for the karaoke pitch-snap minigame.
 */
export function estimatePitchContour(buffer: AudioBuffer): number[] {
  const data = buffer.getChannelData(0);
  const rate = buffer.sampleRate;
  const frame = Math.floor(rate * 0.06);
  const hop = Math.floor(rate * 0.03);
  const minLag = Math.floor(rate / 500);
  const maxLag = Math.floor(rate / 70);
  const notes: number[] = [];

  for (let start = 0; start + maxLag < data.length; start += hop) {
    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag < maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < frame; i++) corr += data[start + i] * data[start + i + lag];
      if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }
    if (bestLag > 0 && bestCorr > 0.5) {
      const freq = rate / bestLag;
      const midi = Math.round(69 + 12 * Math.log2(freq / 440));
      notes.push(midi);
    } else {
      notes.push(-1);
    }
  }
  return notes;
}
