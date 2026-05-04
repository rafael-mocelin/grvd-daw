/**
 * JamCharacter — a single performer slot on the Jam stage.
 *
 * One of N characters standing on the studio floor. Holds at most one
 * assigned sound. Visual responsibilities:
 *
 *   - Empty slot: a faded silhouette with a "drop a sound here" cue.
 *   - Filled slot: the character bobs to the beat with an animation
 *     keyed to the sound's KIND (drums/hihat/808/sample).
 *   - Muted: a black blindfold band slides across the eyes.
 *   - Loud (volume > 1.2): yellow lightning sparks crackle around them.
 *   - Drag-over: cyan halo + scale-up to confirm the drop target.
 *
 * Tap the character → opens the floating ControlPanel for this slot.
 *
 * Reuses the in-game chibi mascot silhouette but with a recolorable
 * jacket so each slot gets a distinct character (coral / cyan / gold).
 */

import { useEffect, useRef, useState } from "react";
import type { LayerKind, SoundOption } from "../../data/types";
import { darken, lighten } from "../../ui/burst/tokens";

interface JamCharacterProps {
  slotId:    string;
  jacket:    string;       // Body / hoodie color — defines the character's identity
  skin:      string;
  sound:     SoundOption | null;
  muted:     boolean;
  volume:    number;       // 0–2 linear gain
  onDropSound: (soundId: string) => void;
  onTap:       () => void;
  /** True while a sound is being dragged over this slot — drives drop-target halo. */
  dragOver:    boolean;
  onDragEnter: () => void;
  onDragLeave: () => void;
}

/**
 * Map from sound kind to a CSS animation class. Each kind gets a
 * distinct dance so the character's behavior is legible at a glance.
 */
const KIND_ANIMATION: Record<LayerKind, string> = {
  drums:  "jamDanceBob",
  kick:   "jamDanceBob",
  snare:  "jamDanceBob",
  hat:    "jamDanceJitter",
  "808":  "jamDanceWobble",
  sample: "jamDanceSway",
  melody: "jamDanceSway",
  vocal:  "jamDanceMouth",
};

export function JamCharacter({
  slotId,
  jacket,
  skin,
  sound,
  muted,
  volume,
  onDropSound,
  onTap,
  dragOver,
  onDragEnter,
  onDragLeave,
}: JamCharacterProps) {
  const filled = !!sound;
  const animation = sound ? KIND_ANIMATION[sound.kind] ?? "jamDanceBob" : "jamIdle";
  const animDur   = sound ? bpmDurationFor(sound) : "2.6s";
  const loud      = volume > 1.2 && !muted;

  // HTML5 drag/drop wiring — we use the native dataTransfer string so
  // it works on desktop without us needing to wire a global drag state.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault(); // allow drop
    e.dataTransfer.dropEffect = "copy";
  }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/jam-sound-id");
    if (id) onDropSound(id);
    onDragLeave();
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragEnter={(e) => { e.preventDefault(); onDragEnter(); }}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
      onClick={onTap}
      style={{
        position: "relative",
        width: 130,
        height: 220,
        cursor: "pointer",
        // Drop-target halo
        filter: dragOver
          ? "drop-shadow(0 0 18px rgba(34,211,238,0.9)) drop-shadow(0 14px 14px rgba(0,0,0,0.5))"
          : "drop-shadow(0 14px 14px rgba(0,0,0,0.5))",
        transform: dragOver ? "scale(1.06)" : "scale(1)",
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), filter 0.2s",
        opacity: filled ? 1 : 0.55,
      }}
      data-slot-id={slotId}
    >
      <CharacterArt
        jacket={jacket}
        skin={skin}
        animation={animation}
        animDur={animDur}
        muted={muted}
      />

      {/* Empty-slot affordance — pulsing dotted ring + label */}
      {!filled && (
        <div
          style={{
            position: "absolute",
            top: -10, left: -10, right: -10, bottom: -10,
            borderRadius: 30,
            border: "2.5px dashed rgba(255,255,255,0.18)",
            pointerEvents: "none",
            animation: "jamSlotPulse 2.2s ease-in-out infinite",
          }}
        />
      )}

      {/* Lightning VFX — appears when volume is high. Two spark layers
       *  rotating in opposite directions for a chaotic crackle. */}
      {loud && (
        <>
          <div className="jam-lightning jam-lightning-a" />
          <div className="jam-lightning jam-lightning-b" />
        </>
      )}

      {/* Beneath-character "now playing" pill — shows the assigned sound
       *  name. Kept minimal so the character stays the focus. */}
      {filled && (
        <div
          style={{
            position: "absolute",
            bottom: -28,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "3px 10px",
            borderRadius: 999,
            background: "rgba(0,0,0,0.65)",
            border: "1.5px solid rgba(255,255,255,0.18)",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#fff",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {sound!.glyph} {sound!.name}
        </div>
      )}

      <SharedKeyframes />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Character art — chibi silhouette ported & simplified from Mascot.tsx,      */
/* parameterized so each slot can be a different color.                       */
/* -------------------------------------------------------------------------- */

interface CharacterArtProps {
  jacket:    string;
  skin:      string;
  animation: string;
  animDur:   string;
  muted:     boolean;
}

function CharacterArt({ jacket, skin, animation, animDur, muted }: CharacterArtProps) {
  const jacketDark = darken(jacket, 0.18);
  const skinLight  = lighten(skin, 0.15);
  const skinDark   = darken(skin, 0.18);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        animation: `${animation} ${animDur} ease-in-out infinite`,
        transformOrigin: "50% 100%",
      }}
    >
      {/* floor shadow */}
      <div style={{
        position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
        width: 90, height: 12, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
      }} />

      {/* hoodie body */}
      <div style={{
        position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: 88, height: 76,
        background: `linear-gradient(180deg, ${jacket} 0%, ${jacketDark} 100%)`,
        border: "2.5px solid #0a0f1c",
        borderRadius: "18px 18px 12px 12px",
        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -4px 0 rgba(0,0,0,0.35)",
      }}>
        {/* hood collar */}
        <div style={{
          position: "absolute", top: -4, left: "50%", transform: "translateX(-50%)",
          width: 60, height: 12,
          background: jacket,
          border: "2.5px solid #0a0f1c",
          borderRadius: "10px 10px 4px 4px",
        }} />
      </div>

      {/* arms (two simple hoodie sleeves) */}
      <div style={{
        position: "absolute", bottom: 28, left: 4, width: 18, height: 50,
        background: `linear-gradient(180deg, ${jacket}, ${jacketDark})`,
        border: "2.5px solid #0a0f1c",
        borderRadius: "12px 6px 10px 10px",
        transform: "rotate(8deg)",
      }} />
      <div style={{
        position: "absolute", bottom: 28, right: 4, width: 18, height: 50,
        background: `linear-gradient(180deg, ${jacket}, ${jacketDark})`,
        border: "2.5px solid #0a0f1c",
        borderRadius: "6px 12px 10px 10px",
        transform: "rotate(-8deg)",
      }} />

      {/* legs / sneakers */}
      <div style={{
        position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: 70, display: "flex", justifyContent: "space-between",
      }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ width: 28, height: 26 }}>
            <div style={{
              width: "100%", height: 12, background: "#1a1a22",
              border: "2.5px solid #0a0f1c", borderRadius: "4px 4px 0 0",
            }} />
            <div style={{
              width: "108%", height: 16, marginLeft: -1,
              background: "linear-gradient(180deg, #fff, #d0d0d8)",
              border: "2.5px solid #0a0f1c",
              borderRadius: i === 0 ? "4px 10px 6px 6px" : "10px 4px 6px 6px",
              boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.3)",
            }} />
          </div>
        ))}
      </div>

      {/* head */}
      <div style={{
        position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
        width: 110, height: 110,
      }}>
        {/* face shape */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 35% 30%, ${skinLight}, ${skin} 60%, ${skinDark})`,
          border: "2.5px solid #0a0f1c",
          borderRadius: "50% 50% 46% 46% / 52% 52% 44% 44%",
          boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)",
        }} />

        {/* eyes — almond. Hidden behind blindfold band when muted. */}
        <div style={{
          position: "absolute", top: 50, left: 28, width: 12, height: 14,
          background: "#0a0f1c", borderRadius: "50%",
          opacity: muted ? 0 : 1, transition: "opacity 0.2s",
        }}>
          <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />
        </div>
        <div style={{
          position: "absolute", top: 50, right: 28, width: 12, height: 14,
          background: "#0a0f1c", borderRadius: "50%",
          opacity: muted ? 0 : 1, transition: "opacity 0.2s",
        }}>
          <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />
        </div>

        {/* mouth */}
        <div style={{
          position: "absolute", top: 76, left: "50%", transform: "translateX(-50%)",
          width: 8, height: 8, borderRadius: "50%",
          background: "#3a1818",
          border: "1.5px solid #0a0f1c",
        }} />

        {/* Blindfold band — covers the eyes when muted. Slides in
         *  from off-screen via CSS transition so toggling reads
         *  clearly. */}
        <div
          style={{
            position: "absolute",
            top: 44, left: 0, right: 0, height: 24,
            background: "linear-gradient(180deg, #1a1a22, #0a0f1c)",
            border: "2px solid #0a0f1c",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), 0 2px 0 rgba(0,0,0,0.5)",
            transform: muted ? "translateX(0)" : "translateX(-150%)",
            transition: "transform 0.3s cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          {/* tiny knot dot at the back */}
          <div style={{
            position: "absolute", top: "50%", right: 6,
            transform: "translateY(-50%)",
            width: 6, height: 6, borderRadius: "50%",
            background: "#0a0f1c",
            boxShadow: "0 0 0 2px rgba(255,255,255,0.18)",
          }} />
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Derive an animation duration from the sound so the dance roughly
 * matches the audio's cadence. We target one full bar at the sound's
 * native BPM (4 beats), which feels musically natural for an idle
 * sway. Short and clamped so very fast or very slow songs still look
 * organic.
 */
function bpmDurationFor(sound: SoundOption): string {
  const bpm = sound.nativeBpm ?? 120;
  const barSec = (60 / bpm) * 4;
  const clamped = Math.max(1.2, Math.min(3.5, barSec));
  return `${clamped.toFixed(2)}s`;
}

/* -------------------------------------------------------------------------- */
/* Shared keyframes — injected once per character. Cheap; CSS dedupe handles  */
/* multiple instances.                                                         */
/* -------------------------------------------------------------------------- */

function SharedKeyframes() {
  return (
    <style>{`
      @keyframes jamIdle {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-3px); }
      }
      @keyframes jamDanceBob {
        0%, 100% { transform: translateY(0)   rotate(0deg);   }
        25%      { transform: translateY(-6px) rotate(-2deg); }
        50%      { transform: translateY(0)   rotate(0deg);   }
        75%      { transform: translateY(-6px) rotate(2deg);  }
      }
      @keyframes jamDanceJitter {
        0%, 100% { transform: translate(0, 0)    rotate(0deg);  }
        20%      { transform: translate(-1px, -2px) rotate(-1deg); }
        40%      { transform: translate(1px, -1px)  rotate(1deg);  }
        60%      { transform: translate(-1px, -2px) rotate(-1deg); }
        80%      { transform: translate(1px, -1px)  rotate(1deg);  }
      }
      @keyframes jamDanceWobble {
        0%, 100% { transform: scaleY(1)    translateY(0);   }
        50%      { transform: scaleY(0.92) translateY(4px); }
      }
      @keyframes jamDanceSway {
        0%, 100% { transform: translateX(0)    rotate(0deg);  }
        50%      { transform: translateX(-3px) rotate(-3deg); }
      }
      @keyframes jamDanceMouth {
        0%, 100% { transform: translateY(0); }
        50%      { transform: translateY(-2px); }
      }
      @keyframes jamSlotPulse {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50%      { opacity: 0.8; transform: scale(1.02); }
      }
      @keyframes jamSpark {
        0%   { transform: rotate(0deg)   scale(0.9); opacity: 0.9; }
        50%  { transform: rotate(180deg) scale(1.1); opacity: 0.4; }
        100% { transform: rotate(360deg) scale(0.9); opacity: 0.9; }
      }
      @keyframes jamSparkRev {
        0%   { transform: rotate(0deg)    scale(1.1); opacity: 0.7; }
        50%  { transform: rotate(-180deg) scale(0.9); opacity: 0.3; }
        100% { transform: rotate(-360deg) scale(1.1); opacity: 0.7; }
      }

      .jam-lightning {
        position: absolute;
        inset: -20px;
        pointer-events: none;
        background:
          radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 80% 25%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 15% 75%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 85% 80%, rgba(251, 191, 36, 0.45) 0%, transparent 5%),
          radial-gradient(circle at 50% 10%, rgba(251, 191, 36, 0.55) 0%, transparent 4%);
        mix-blend-mode: screen;
        filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.8));
      }
      .jam-lightning-a { animation: jamSpark    0.9s linear infinite; }
      .jam-lightning-b { animation: jamSparkRev 1.1s linear infinite; }
    `}</style>
  );
}
