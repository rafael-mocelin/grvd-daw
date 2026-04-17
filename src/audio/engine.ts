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

function makeVocalPlayer(buffer: AudioBuffer | null) {
  if (!buffer) return null;
  const tBuf = Tone.ToneAudioBuffer.fromArray(buffer.getChannelData(0));
  const player = new Tone.Player(tBuf);
  const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.18 });
  const gain = new Tone.Gain(0.9);
  player.chain(reverb, gain, Tone.getDestination());
  return { player, nodes: [player, reverb, gain] as Tone.ToneAudioNode[] };
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
): { builder: VoiceBuilder | null; nodes: Tone.ToneAudioNode[]; isPlayer?: boolean; isFileLoop?: boolean } {
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
      return { builder: null, nodes: v.nodes, isPlayer: true };
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
    const { builder, nodes, isPlayer, isFileLoop } = buildVoice(layer, vocalBuffer, song.bpm);
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
      const part = new Tone.Part((time) => { player.start(time); }, [["0:0:0"]]).start(0);
      part.loop = true;
      part.loopEnd = `${song.bars}m`;
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
  } catch {
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
    } catch {
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
  } catch {
    cleanup();
    return;
  }

  const timer = setTimeout(cleanup, 1800);
  stopCurrentPreview = () => { clearTimeout(timer); cleanup(); };
}

/* -------------------------------------------------------------------------- */
/* Vocal recording                                                             */
/* -------------------------------------------------------------------------- */

export async function recordVocal(
  maxSeconds: number
): Promise<{ blob: Blob; buffer: AudioBuffer }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Recording not supported in this browser.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  return new Promise((resolve, reject) => {
    recorder.onstop = async () => {
      try {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const ab = await blob.arrayBuffer();
        const ctx = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const buffer = await ctx.decodeAudioData(ab);
        stream.getTracks().forEach((t) => t.stop());
        resolve({ blob, buffer });
      } catch (e) { reject(e); }
    };
    recorder.onerror = (e) => reject(e);
    recorder.start();
    setTimeout(() => { if (recorder.state !== "inactive") recorder.stop(); }, maxSeconds * 1000);
  });
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
