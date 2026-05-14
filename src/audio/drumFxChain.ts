/**
 * drumFxChain — the 8-effect audio chain that sits between a
 * drum-guy slot's Tone.Player and its output gain.
 *
 * One Tone node per slot in the FX pool. Each effect's "amount knob"
 * (0..1, owned by useFxUnlocks) maps to the right parameter on its
 * underlying Tone node — 0 means transparent / bypass-equivalent,
 * 1 means full intensity.
 *
 * Audio flow:
 *   player → eq → reverb → distortion → punch → widener → ghost →
 *           crush → tape → (consumer connects this to gain → dest)
 *
 * All 8 nodes always live in series — they just go quiet when their
 * amount is 0, so there's no graph-mutation cost when the player
 * twists knobs. Disposing the chain disposes every node.
 */

import * as Tone from "tone";

export interface DrumFxChain {
  /** Connect the slot's Player to this node. */
  input:  Tone.ToneAudioNode;
  /** Connect this node to the slot's gain → destination. */
  output: Tone.ToneAudioNode;
  /** Update one effect's amount in place (0..1). Unknown ids no-op. */
  setAmount: (fxId: string, amount: number) => void;
  /** Tear down every node in the chain. */
  dispose: () => void;
}

export function createDrumFxChain(): DrumFxChain {
  // FRESH AIR — high-shelf brightness on the EQ. Subtle by default
  // (boost up to +12 dB at amount=1).
  const eq = new Tone.EQ3({ low: 0, mid: 0, high: 0 });
  // BOOM ROOM — short trap-room reverb. wet 0..0.4.
  const reverb = new Tone.Reverb({ decay: 0.9, preDelay: 0.01, wet: 0 });
  // DECAPITATOR — saturation + drive. wet 0..1; distortion 0..0.6.
  const dist = new Tone.Distortion({ distortion: 0, wet: 0 });
  // HEAD KICK — transient compressor (low ratio, fast attack/release)
  // ratio scales 1..5, threshold drops with amount.
  const punch = new Tone.Compressor({ threshold: -10, ratio: 1, attack: 0.001, release: 0.04, knee: 1 });
  // WIDE LOAD — stereo widener. width 0.5..1.0.
  const widener = new Tone.StereoWidener({ width: 0.5 });
  // GHOST RIDER — slow chorus modulation as a "ghost layer" substitute.
  // depth 0..0.5, wet 0..0.4.
  const ghost = new Tone.Chorus({ frequency: 0.7, depth: 0, wet: 0, delayTime: 4 }).start();
  // SUB CRUSHER — bus compression smash. ratio scales 1..8.
  const crush = new Tone.Compressor({ threshold: -10, ratio: 1, attack: 0.001, release: 0.1, knee: 3 });
  // TAPE WARM — soft saturation via Chebyshev. order 2..8, wet 0..1.
  const tape = new Tone.Chebyshev({ order: 2, wet: 0 });

  // Wire in series.
  eq.chain(reverb, dist, punch, widener, ghost, crush, tape);

  function setAmount(fxId: string, amount: number) {
    const a = Math.max(0, Math.min(1, amount));
    switch (fxId) {
      case "fresh-air":
        eq.high.value = a * 12;          // 0..+12 dB high-shelf boost
        break;
      case "boom-room":
        reverb.wet.value = a * 0.4;      // 0..0.4 reverb send
        break;
      case "decapitator":
        dist.wet.value     = a;
        dist.distortion    = a * 0.6;    // 0..0.6 distortion drive
        break;
      case "head-kick":
        punch.ratio.value     = 1 + a * 4;       // 1..5
        punch.threshold.value = -10 - a * 14;    // -10..-24 dB
        break;
      case "wide-load":
        widener.width.value = 0.5 + a * 0.5;     // 0.5..1.0
        break;
      case "ghost-rider":
        ghost.wet.value = a * 0.4;
        ghost.depth     = a * 0.5;
        break;
      case "sub-crusher":
        crush.ratio.value     = 1 + a * 7;
        crush.threshold.value = -10 - a * 20;
        break;
      case "tape-warm":
        tape.wet.value = a;
        tape.order     = Math.max(2, Math.round(2 + a * 6)); // 2..8
        break;
    }
  }

  function dispose() {
    try { eq.dispose();      } catch { /* ignore */ }
    try { reverb.dispose();  } catch { /* ignore */ }
    try { dist.dispose();    } catch { /* ignore */ }
    try { punch.dispose();   } catch { /* ignore */ }
    try { widener.dispose(); } catch { /* ignore */ }
    try { ghost.dispose();   } catch { /* ignore */ }
    try { crush.dispose();   } catch { /* ignore */ }
    try { tape.dispose();    } catch { /* ignore */ }
  }

  return { input: eq, output: tape, setAmount, dispose };
}
