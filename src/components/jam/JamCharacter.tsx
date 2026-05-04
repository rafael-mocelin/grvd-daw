/**
 * JamCharacter — a single performer slot on the Jam stage.
 *
 * One of N characters standing on the studio floor. Holds at most one
 * assigned sound. Visual responsibilities:
 *
 *   - Empty slot: a faded silhouette with a "drop a sound here" cue.
 *   - Filled slot: the character bobs to the beat with an animation
 *     keyed to the sound's KIND (drums/hihat/808/sample).
 *   - Muted: a black blindfold band slides across the eyes; dance stops.
 *   - Loud (volume > 1.2): yellow lightning sparks crackle around them.
 *   - VERY loud (volume > 1.5): full rockstar pose — head tilts back,
 *     mouth opens wider, body leans into the mic.
 *   - Drag-over: cyan halo + scale-up to confirm the drop target.
 *   - Drop-in burst: a brief land-and-react animation when a fresh sound
 *     gets assigned, plus a small particle burst around the character.
 *
 * Each slot is configured by a JamCharacter (head shape, hair, jacket,
 * expression, personality) so the cast reads as three distinct people
 * rather than three hoodie-recolors of one chibi.
 *
 * Tap = mute toggle (instant). Long-press = open the floating
 * ControlPanel for this slot.
 */

import { useEffect, useRef, useState } from "react";
import type { LayerKind, SoundOption } from "../../data/types";
import { darken, lighten } from "../../ui/burst/tokens";
import { useJamAudioFrame } from "../../hooks/useJamAudioFrame";
import type { Accessory } from "../../data/jamCombos";
import { CharacterAccessory } from "./CharacterAccessory";
import type { JamCharacter as CharConfig } from "../../data/jamCharacters";

interface JamCharacterProps {
  slotId:    string;
  /** Index of this slot in the row (0-based). Drives staggered idle
   *  animation delays so the cast doesn't all bob in lockstep. */
  slotIndex: number;
  /** Full character config — drives jacket, skin, head shape, hair,
   *  expression, and (later) personality / hype lines. */
  character: CharConfig;
  sound:     SoundOption | null;
  muted:     boolean;
  volume:    number;       // 0–2 linear gain
  /** Optional one-line hype text to float above the head. Parent owns
   *  the timer that clears it; the bubble fades itself out. */
  hypeLine?: string | null;
  onDropSound:   (soundId: string) => void;
  /** Tap = instant mute toggle. Long-press triggers onLongPress instead. */
  onTap:         () => void;
  onLongPress:   () => void;
  dragOver:      boolean;
  onDragEnter:   () => void;
  onDragLeave:   () => void;
  /** Combo accessory to wear (sunglasses / halo / fire / etc). Null = no accessory. */
  accessory?:    Accessory | null;
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

/**
 * Per-kind rim-light glow color. Wraps around the character whenever
 * a sound of this kind is assigned. Mirrors the palette colors used by
 * the SoundPalette tiles so visually-coherent.
 */
const KIND_RIM: Record<LayerKind, string> = {
  drums:  "rgba(233, 69, 96, 0.55)",   // coral
  kick:   "rgba(233, 69, 96, 0.55)",
  snare:  "rgba(233, 69, 96, 0.55)",
  hat:    "rgba(34, 211, 238, 0.55)",  // cyan
  "808":  "rgba(251, 146, 60, 0.55)",  // orange
  sample: "rgba(74, 222, 128, 0.55)",  // green
  melody: "rgba(212, 160, 23, 0.55)",  // gold
  vocal:  "rgba(255, 77, 156, 0.55)",  // pink
};

const LONG_PRESS_MS = 320;

export function JamCharacter({
  slotId,
  slotIndex,
  character,
  sound,
  muted,
  volume,
  hypeLine,
  onDropSound,
  onTap,
  onLongPress,
  dragOver,
  onDragEnter,
  onDragLeave,
  accessory,
}: JamCharacterProps) {
  const filled = !!sound;
  // Muted characters kill the dance entirely — no bob, no jitter, no
  // wobble. Empty slots get the slow idle bob; only filled-and-unmuted
  // characters perform their kind-specific dance. Audio-reactive refs
  // already short-circuit to identity on muted, so the figure freezes
  // cleanly except the blindfold pop-in animation.
  const animation = !filled
    ? "jamIdle"
    : muted
      ? "none"
      : KIND_ANIMATION[sound.kind] ?? "jamDanceBob";
  const animDur   = sound ? bpmDurationFor(sound) : "2.6s";
  // Per-slot stagger so the row breathes naturally rather than in lockstep.
  // Half-second offset per slot keeps the bobs out-of-phase enough to
  // read as three individuals.
  const animDelay = `${(slotIndex * 0.5).toFixed(2)}s`;
  const sparks    = volume > 1.2 && !muted;
  const rockstar  = volume > 1.5 && !muted;
  const rimColor  = filled ? KIND_RIM[sound.kind] ?? null : null;
  // Signature match — character is holding a sound of their specialty kind.
  // We bump the rim glow and pin a small ★ badge to the hoodie.
  const signatureMatch = filled && character.signatureKind === sound.kind;

  // ── Drop-in / clear bursts ──
  // When the sound id transitions we fire a brief one-shot animation:
  //   - null → id  → drop-in burst (outward particles, halo flash)
  //   - id   → null → clear puff (inward grey particles, "bye" feel)
  // Each key increments on transition so the corresponding component
  // remounts with a fresh animation and self-cleans via finite CSS time.
  const [burstKey, setBurstKey] = useState(0);
  const [clearKey, setClearKey] = useState(0);
  const lastSoundIdRef = useRef<string | null>(sound?.id ?? null);
  useEffect(() => {
    const incomingId = sound?.id ?? null;
    const previousId = lastSoundIdRef.current;
    if (incomingId !== previousId) {
      lastSoundIdRef.current = incomingId;
      if (incomingId) setBurstKey((k) => k + 1);
      else if (previousId) setClearKey((k) => k + 1);
    }
  }, [sound?.id]);

  // ── Audio-reactive plumbing ──
  // The character "feels" the music via a shared FFT-band frame ref.
  // Refs (not state) so we can write transforms in rAF without re-rendering.
  // Empty / muted slots short-circuit the loop and freeze on identity transforms.
  const audioFrame = useJamAudioFrame();
  const eyeLRef    = useRef<HTMLDivElement>(null!);
  const eyeRRef    = useRef<HTMLDivElement>(null!);
  const mouthRef   = useRef<HTMLDivElement>(null!);
  const bodyRef    = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;

    const isVocal = sound?.kind === "vocal";

    const tick = () => {
      if (cancelled) return;
      const { overall, kick } = audioFrame.current;

      const active = filled && !muted;
      const o = active ? overall : 0;
      const k = active ? kick    : 0;

      // Eye pump — bigger amplitude when in rockstar mode.
      const eyeMax = rockstar ? 0.65 : 0.45;
      const eyeScale = 1 + Math.min(o * 1.5, eyeMax);
      if (eyeLRef.current) eyeLRef.current.style.transform = `scale(${eyeScale.toFixed(3)})`;
      if (eyeRRef.current) eyeRRef.current.style.transform = `scale(${eyeScale.toFixed(3)})`;

      // Mouth pop — vocal slots open up on overall, drum slots pop on
      // kick, rockstar mode adds a baseline open-mouth scale.
      const baseY = rockstar ? 1.7 : 1.0;
      const mouthScaleY = baseY + (isVocal ? o * 1.4 : k * 0.7);
      const mouthScaleX = (rockstar ? 1.25 : 1.0) + (isVocal ? o * 0.4 : k * 0.2);
      if (mouthRef.current) {
        mouthRef.current.style.transform = `translateX(-50%) scale(${mouthScaleX.toFixed(3)}, ${mouthScaleY.toFixed(3)})`;
      }

      // Body breathe — entire torso scales by a hair on overall energy.
      const bodyScale = 1 + o * 0.04;
      if (bodyRef.current) {
        bodyRef.current.style.transform = `translateX(-50%) scale(${bodyScale.toFixed(3)})`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [audioFrame, filled, muted, sound?.kind, rockstar]);

  // ── Tap vs long-press ──
  // Pointer down starts a timer; if it fires before pointer-up, treat
  // as long-press (open popover). If pointer-up first, treat as tap
  // (mute toggle). Pointer-leave cancels the gesture.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef<boolean>(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handlePointerDown() {
    longPressFiredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressFiredRef.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function handlePointerUp() {
    clearLongPressTimer();
    if (!longPressFiredRef.current) {
      onTap();
    }
  }
  function handlePointerCancel() {
    clearLongPressTimer();
  }

  // HTML5 drag/drop wiring.
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
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
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerCancel}
      onPointerCancel={handlePointerCancel}
      style={{
        position: "relative",
        width: 130,
        height: 220,
        cursor: "pointer",
        // Drop-target halo OR per-kind rim glow when filled. Drag-over
        // wins because it's the more transient state. Signature-match
        // doubles up the rim for a "this is your role" cue.
        filter: dragOver
          ? "drop-shadow(0 0 18px rgba(34,211,238,0.9)) drop-shadow(0 14px 14px rgba(0,0,0,0.5))"
          : rimColor
            ? signatureMatch
              ? `drop-shadow(0 0 18px ${rimColor}) drop-shadow(0 0 8px ${rimColor}) drop-shadow(0 14px 14px rgba(0,0,0,0.5))`
              : `drop-shadow(0 0 14px ${rimColor}) drop-shadow(0 14px 14px rgba(0,0,0,0.5))`
            : "drop-shadow(0 14px 14px rgba(0,0,0,0.5))",
        transform: dragOver ? "scale(1.06)" : "scale(1)",
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), filter 0.2s",
        // Filled + unmuted = full presence. Muted = slightly faded so the
        // blindfold + frozen pose read as "this performer is taking a
        // break". Empty slot = strongly faded silhouette.
        opacity: filled ? (muted ? 0.72 : 1) : 0.55,
        // Prevent tap-and-hold context menus & native gestures from
        // hijacking the long-press detector on touch.
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        touchAction: "manipulation",
      }}
      data-slot-id={slotId}
    >
      {/* Floor reflection — soft jacket-colored splash directly beneath
       *  the character. Sells the "stage floor is glossy" feel and ties
       *  each character's identity color into the ground plane. Only
       *  renders for filled slots (an empty slot stays bare). */}
      {filled && (
        <div
          style={{
            position: "absolute",
            left: "50%", bottom: -18,
            marginLeft: -56,
            width: 112, height: 30,
            background: `radial-gradient(ellipse at 50% 0%, ${character.jacket}80 0%, ${character.jacket}30 35%, transparent 70%)`,
            filter: "blur(6px)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Drop-in burst — fires a single playback when burstKey changes.
       *  Keyed so React unmounts/remounts to retrigger animations. */}
      {burstKey > 0 && filled && sound && (
        <DropInBurst
          key={burstKey}
          accent={KIND_RIM[sound.kind]?.replace("0.55", "0.9") ?? "rgba(255,255,255,0.9)"}
        />
      )}

      {/* Clear puff — fires when a slot transitions back to empty. Sits
       *  in front of the character so the puff is visible even after the
       *  silhouette goes faded. Self-cleans on its own animation timer. */}
      {clearKey > 0 && (
        <ClearPuff key={`clear-${clearKey}`} />
      )}

      <CharacterArt
        character={character}
        animation={animation}
        animDur={animDur}
        animDelay={animDelay}
        muted={muted}
        rockstar={rockstar}
        eyeLRef={eyeLRef}
        eyeRRef={eyeRRef}
        mouthRef={mouthRef}
        bodyRef={bodyRef}
      />

      {/* Combo accessory — sits above CharacterArt so the visor / halo /
       *  flame paints on top of the chibi. */}
      {filled && accessory && (
        <CharacterAccessory key={accessory} accessory={accessory} />
      )}

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

      {/* Lightning VFX — appears when volume is high. */}
      {sparks && (
        <>
          <div className="jam-lightning jam-lightning-a" />
          <div className="jam-lightning jam-lightning-b" />
        </>
      )}

      {/* Signature match badge — small spinning star on the hoodie when
       *  the character is holding a sound of their specialty kind. */}
      {signatureMatch && (
        <div
          style={{
            position: "absolute",
            top: 130,
            left: "50%",
            marginLeft: 16,
            width: 18, height: 18,
            borderRadius: "50%",
            background: "linear-gradient(180deg, #f3c44a, #d4a017)",
            border: "2px solid #0a0f1c",
            display: "grid",
            placeItems: "center",
            color: "#0a0f1c",
            fontSize: 11,
            fontWeight: 700,
            zIndex: 6,
            pointerEvents: "none",
            boxShadow: "0 0 10px rgba(243, 196, 74, 0.85), inset 0 1px 0 rgba(255,255,255,0.5)",
            animation: "jamSignatureSpin 6s linear infinite",
          }}
        >★</div>
      )}

      {/* Hype-line speech bubble — parent owns the timer that clears it. */}
      {hypeLine && filled && (
        <HypeBubble key={hypeLine} text={hypeLine} />
      )}

      {/* Beneath-character "now playing" pill */}
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
/* DropInBurst — tiny one-shot particle ring fired on a fresh assignment.     */
/* Self-cleans by virtue of having a finite animation; React never has to    */
/* unmount it, the keyed remount handles that.                                */
/* -------------------------------------------------------------------------- */

function DropInBurst({ accent }: { accent: string }) {
  // 8 particles around the character at 45° intervals. Each starts at
  // the center of the character box and flies outward + up.
  const particles = Array.from({ length: 10 }, (_, i) => i);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
      }}
    >
      {/* Soft halo flash centered on the character */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "55%",
          marginLeft: -60, marginTop: -60,
          width: 120, height: 120,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent} 0%, transparent 65%)`,
          mixBlendMode: "screen",
          animation: "jamDropHalo 0.55s ease-out forwards",
        }}
      />
      {particles.map((i) => {
        const angle = (i / particles.length) * Math.PI * 2;
        const dx = Math.cos(angle) * 70;
        const dy = Math.sin(angle) * 70 - 20; // bias upward
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: 8, height: 8,
              borderRadius: "50%",
              background: accent,
              boxShadow: `0 0 10px ${accent}`,
              animation: "jamDropParticle 0.6s ease-out forwards",
              ["--end-x" as string]: `${dx}px`,
              ["--end-y" as string]: `${dy}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ClearPuff — the toss-off particle effect when a slot is cleared. Smaller   */
/* than the drop-in burst, neutral grey particles flying upward like dust.    */
/* -------------------------------------------------------------------------- */

function ClearPuff() {
  const particles = Array.from({ length: 7 }, (_, i) => i);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 6,
      }}
    >
      {/* small ring flash */}
      <div
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          marginLeft: -28, marginTop: -28,
          width: 56, height: 56,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.35)",
          animation: "jamClearRing 0.5s ease-out forwards",
        }}
      />
      {particles.map((i) => {
        // Particles drift up + spread out a bit; greyer than the drop-in.
        const angleSpread = (i - particles.length / 2) * 0.4;
        const dx = Math.sin(angleSpread) * 30;
        const dy = -50 - Math.random() * 30;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "55%",
              width: 5, height: 5,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.65)",
              animation: "jamClearParticle 0.55s ease-out forwards",
              ["--end-x" as string]: `${dx}px`,
              ["--end-y" as string]: `${dy}px`,
            } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* HypeBubble — short speech bubble that floats above the character's head.  */
/* Self-fades; parent unmounts via key/timer.                                  */
/* -------------------------------------------------------------------------- */

function HypeBubble({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -38, left: "50%",
        marginLeft: -56,
        width: 112,
        zIndex: 8,
        pointerEvents: "none",
        textAlign: "center",
        animation: "jamHypePop 1.6s cubic-bezier(.34,1.56,.64,1) forwards",
      }}
    >
      <div
        style={{
          display: "inline-block",
          padding: "5px 11px",
          borderRadius: 14,
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          boxShadow: "0 3px 0 rgba(0,0,0,0.45)",
          fontFamily: "'Lilita One', system-ui",
          fontSize: 11,
          letterSpacing: 0.4,
          color: "#0f1828",
          maxWidth: "100%",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
      {/* tail */}
      <div
        style={{
          width: 10, height: 10,
          background: "#fff",
          border: "2.5px solid #0a0f1c",
          borderTop: "none",
          borderLeft: "none",
          transform: "rotate(45deg)",
          margin: "-5px auto 0",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Character art — chibi silhouette ported & simplified from Mascot.tsx,      */
/* now parameterized with full character config (head shape, hair, expression).*/
/* -------------------------------------------------------------------------- */

interface CharacterArtProps {
  character: CharConfig;
  animation: string;
  animDur:   string;
  animDelay: string;
  muted:     boolean;
  rockstar:  boolean;
  eyeLRef?:  React.RefObject<HTMLDivElement>;
  eyeRRef?:  React.RefObject<HTMLDivElement>;
  mouthRef?: React.RefObject<HTMLDivElement>;
  bodyRef?:  React.RefObject<HTMLDivElement>;
}

/** Border-radius shapes for the head, keyed to character.headShape. */
const HEAD_RADIUS = {
  round:  "50% 50% 46% 46% / 52% 52% 44% 44%",
  oval:   "55% 55% 48% 48% / 60% 60% 50% 50%",
  square: "30% 30% 26% 26% / 32% 32% 28% 28%",
} as const;

function CharacterArt({
  character,
  animation,
  animDur,
  animDelay,
  muted,
  rockstar,
  eyeLRef,
  eyeRRef,
  mouthRef,
  bodyRef,
}: CharacterArtProps) {
  const { jacket, skin, hair, hairColor, headShape, expression } = character;
  const jacketDark = darken(jacket, 0.18);
  const skinLight  = lighten(skin, 0.15);
  const skinDark   = darken(skin, 0.18);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        animation: `${animation} ${animDur} ease-in-out infinite`,
        animationDelay: animDelay,
        transformOrigin: "50% 100%",
        // Rockstar pose: lean back from the floor up, extra emphatic.
        transform: rockstar ? "rotate(-3deg)" : undefined,
        transition: "transform 0.18s ease-out",
      }}
    >
      {/* floor shadow */}
      <div style={{
        position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
        width: 90, height: 12, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 70%)",
      }} />

      {/* hoodie body — bodyRef receives a body-breathe scale on the audio frame */}
      <div
        ref={bodyRef}
        style={{
          position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
          width: 88, height: 76,
          transformOrigin: "50% 100%",
          background: `linear-gradient(180deg, ${jacket} 0%, ${jacketDark} 100%)`,
          border: "2.5px solid #0a0f1c",
          borderRadius: "18px 18px 12px 12px",
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.25), inset 0 -4px 0 rgba(0,0,0,0.35)",
        }}
      >
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
        transform: rockstar ? "rotate(-30deg)" : "rotate(8deg)",
        transformOrigin: "50% 0%",
        transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
      }} />
      <div style={{
        position: "absolute", bottom: 28, right: 4, width: 18, height: 50,
        background: `linear-gradient(180deg, ${jacket}, ${jacketDark})`,
        border: "2.5px solid #0a0f1c",
        borderRadius: "6px 12px 10px 10px",
        transform: rockstar ? "rotate(30deg)" : "rotate(-8deg)",
        transformOrigin: "50% 0%",
        transition: "transform 0.22s cubic-bezier(.34,1.56,.64,1)",
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

      {/* head — head shape varies per character */}
      <div
        style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 110, height: 110,
          transformOrigin: "50% 100%",
          // Rockstar pose tilts the head back.
          transition: "transform 0.18s ease-out",
        }}
      >
        {/* face shape */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 35% 30%, ${skinLight}, ${skin} 60%, ${skinDark})`,
          border: "2.5px solid #0a0f1c",
          borderRadius: HEAD_RADIUS[headShape],
          boxShadow: "inset 0 -6px 0 rgba(0,0,0,0.18)",
        }} />

        {/* Hair layer — sits above face, below eyes */}
        <Hair style={hair} color={hairColor} />

        {/* eyes — almond. Hidden behind blindfold band when muted. */}
        <div
          ref={eyeLRef}
          style={{
            position: "absolute", top: 50, left: 28, width: 12, height: 14,
            background: "#0a0f1c", borderRadius: "50%",
            transformOrigin: "50% 50%",
            opacity: muted ? 0 : 1, transition: "opacity 0.2s",
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />
        </div>
        <div
          ref={eyeRRef}
          style={{
            position: "absolute", top: 50, right: 28, width: 12, height: 14,
            background: "#0a0f1c", borderRadius: "50%",
            transformOrigin: "50% 50%",
            opacity: muted ? 0 : 1, transition: "opacity 0.2s",
          }}
        >
          <div style={{ position: "absolute", top: 2, left: 2, width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />
        </div>

        {/* mouth — shape varies per expression. Audio-reactive scale. */}
        <Mouth mouthRef={mouthRef} expression={expression} />

        {/* Blindfold band — covers the eyes when muted. */}
        {muted && (
          <div
            style={{
              position: "absolute",
              top: 44, left: 0, right: 0, height: 24,
              background: "linear-gradient(180deg, #1a1a22, #0a0f1c)",
              border: "2px solid #0a0f1c",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.18), 0 2px 0 rgba(0,0,0,0.5)",
              animation: "jamBlindfoldIn 0.3s cubic-bezier(.34,1.56,.64,1) both",
            }}
          >
            <div style={{
              position: "absolute", top: "50%", right: 6,
              transform: "translateY(-50%)",
              width: 6, height: 6, borderRadius: "50%",
              background: "#0a0f1c",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.18)",
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hair — five styles, each just a stack of CSS shapes.                        */
/* -------------------------------------------------------------------------- */

function Hair({ style, color }: { style: CharConfig["hair"]; color: string }) {
  switch (style) {
    case "curls":  return <CurlsHair color={color} />;
    case "braids": return <BraidsHair color={color} />;
    case "slick":  return <SlickHair color={color} />;
    case "cap":    return <CapHair color={color} />;
    case "buzz":   return <BuzzHair color={color} />;
  }
}

function CurlsHair({ color }: { color: string }) {
  // 5 small ovals clustered along the top of the head — short curly tufts.
  const tufts: { x: number; y: number; size: number }[] = [
    { x: 18,  y: 4,  size: 22 },
    { x: 38,  y: -2, size: 24 },
    { x: 58,  y: -2, size: 24 },
    { x: 78,  y: 4,  size: 22 },
    { x: 28,  y: 12, size: 18 },
    { x: 70,  y: 12, size: 18 },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {tufts.map((t, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: t.x, top: t.y,
            width: t.size, height: t.size,
            borderRadius: "50%",
            background: color,
            border: "2px solid #0a0f1c",
          }}
        />
      ))}
    </div>
  );
}

function BraidsHair({ color }: { color: string }) {
  // A flat top section + two long braids hanging down on each side of
  // the face. Braids extend below the head box; that's fine because
  // the parent .head is overflow:visible by default.
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* crown */}
      <div style={{
        position: "absolute",
        top: -2, left: 14, right: 14,
        height: 24,
        background: color,
        border: "2px solid #0a0f1c",
        borderRadius: "44% 44% 30% 30% / 80% 80% 30% 30%",
      }} />
      {/* center part */}
      <div style={{
        position: "absolute",
        top: 4, left: "50%", marginLeft: -1,
        width: 2, height: 12,
        background: "#0a0f1c",
        opacity: 0.4,
      }} />
      {/* left braid */}
      <Braid x={2}  color={color} />
      {/* right braid */}
      <Braid x={88} color={color} />
    </div>
  );
}

function Braid({ x, color }: { x: number; color: string }) {
  // Stack of three rounded segments + a tassel at the bottom.
  const segs = [0, 1, 2];
  return (
    <div style={{ position: "absolute", left: x, top: 18, width: 18, height: 64 }}>
      {segs.map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 0, top: i * 18,
            width: 18, height: 22,
            borderRadius: "50%",
            background: color,
            border: "2px solid #0a0f1c",
          }}
        />
      ))}
      {/* gold tip */}
      <div style={{
        position: "absolute",
        left: 4, top: 60,
        width: 10, height: 8,
        borderRadius: 2,
        background: "linear-gradient(180deg, #f3c44a, #a07a0c)",
        border: "1.5px solid #0a0f1c",
      }} />
    </div>
  );
}

function SlickHair({ color }: { color: string }) {
  // Slick-back: a glossy dark pancake on top with a horizontal highlight
  // stripe to sell the gel.
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div style={{
        position: "absolute",
        top: -4, left: 8, right: 8,
        height: 28,
        background: `linear-gradient(180deg, ${color} 0%, #0a0a14 100%)`,
        border: "2px solid #0a0f1c",
        borderRadius: "32% 32% 14% 14% / 60% 60% 18% 18%",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12)",
      }}>
        {/* highlight stripe */}
        <div style={{
          position: "absolute",
          top: 4, left: 8, right: 8,
          height: 3,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
          borderRadius: 2,
        }} />
      </div>
    </div>
  );
}

function CapHair({ color }: { color: string }) {
  // Backwards baseball cap silhouette.
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* crown */}
      <div style={{
        position: "absolute",
        top: -2, left: 12, right: 12,
        height: 26,
        background: color,
        border: "2px solid #0a0f1c",
        borderRadius: "40% 40% 20% 20% / 80% 80% 20% 20%",
      }} />
      {/* visor (peeking on the back) */}
      <div style={{
        position: "absolute",
        top: 18, left: -2,
        width: 22, height: 8,
        background: color,
        border: "2px solid #0a0f1c",
        borderRadius: "0 50% 50% 0 / 0 100% 100% 0",
      }} />
    </div>
  );
}

function BuzzHair({ color }: { color: string }) {
  // Subtle dark shading along the top of the head — a fade.
  return (
    <div style={{
      position: "absolute",
      top: 4, left: 14, right: 14,
      height: 18,
      background: `linear-gradient(180deg, ${color} 0%, transparent 100%)`,
      borderRadius: "50% 50% 20% 20% / 100% 100% 0 0",
      pointerEvents: "none",
      opacity: 0.7,
    }} />
  );
}

/* -------------------------------------------------------------------------- */
/* Mouth — varies per expression, audio-reactive scale via parent ref.         */
/* -------------------------------------------------------------------------- */

interface MouthProps {
  expression: CharConfig["expression"];
  mouthRef?: React.RefObject<HTMLDivElement>;
}

function Mouth({ expression, mouthRef }: MouthProps) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    top: 76,
    left: "50%",
    transform: "translateX(-50%)",
    transformOrigin: "50% 50%",
    background: "#3a1818",
    border: "1.5px solid #0a0f1c",
  };

  switch (expression) {
    case "grin":
      // Wider toothy smile — short oval with a tiny white tooth strip.
      return (
        <div ref={mouthRef} style={{ ...baseStyle, width: 16, height: 9, borderRadius: "0 0 18px 18px" }}>
          <div style={{
            position: "absolute",
            top: 1, left: 3,
            width: 8, height: 3,
            background: "#fff",
            opacity: 0.95,
            borderRadius: 1,
          }} />
        </div>
      );
    case "smirk":
      // Asymmetric — small ellipse pulled to one side.
      return (
        <div ref={mouthRef} style={{
          ...baseStyle,
          width: 14, height: 7,
          marginLeft: 4,
          borderRadius: "20% 50% 80% 50% / 50% 50% 50% 50%",
        }} />
      );
    case "cool":
      // Flat, neutral — a horizontal bar.
      return (
        <div ref={mouthRef} style={{
          ...baseStyle,
          width: 14, height: 4,
          borderRadius: 2,
        }} />
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function bpmDurationFor(sound: SoundOption): string {
  const bpm = sound.nativeBpm ?? 120;
  const barSec = (60 / bpm) * 4;
  const clamped = Math.max(1.2, Math.min(3.5, barSec));
  return `${clamped.toFixed(2)}s`;
}

/* -------------------------------------------------------------------------- */
/* Shared keyframes — injected once per character. CSS dedupes identical      */
/* @keyframes blocks so multiple character instances are cheap.                */
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
      @keyframes jamBlindfoldIn {
        0%   { transform: translateX(-100%); opacity: 0; }
        70%  { transform: translateX(8%);    opacity: 1; }
        100% { transform: translateX(0);     opacity: 1; }
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
      @keyframes jamDropParticle {
        0%   { opacity: 0;   transform: translate(-50%, -50%); }
        20%  { opacity: 1;   }
        100% { opacity: 0;   transform: translate(calc(-50% + var(--end-x, 0px)), calc(-50% + var(--end-y, 0px))); }
      }
      @keyframes jamDropHalo {
        0%   { opacity: 0;   transform: scale(0.5); }
        30%  { opacity: 1;   }
        100% { opacity: 0;   transform: scale(1.6); }
      }
      @keyframes jamHypePop {
        0%   { transform: translateY(8px) scale(0.7); opacity: 0; }
        20%  { transform: translateY(-2px) scale(1.06); opacity: 1; }
        45%  { transform: translateY(0) scale(1); opacity: 1; }
        85%  { transform: translateY(0) scale(1); opacity: 1; }
        100% { transform: translateY(-6px) scale(0.96); opacity: 0; }
      }
      @keyframes jamClearParticle {
        0%   { opacity: 0; transform: translate(-50%, -50%); }
        20%  { opacity: 1; }
        100% { opacity: 0; transform: translate(calc(-50% + var(--end-x, 0px)), calc(-50% + var(--end-y, -50px))); }
      }
      @keyframes jamClearRing {
        0%   { opacity: 0;   transform: scale(0.4); }
        25%  { opacity: 0.9; }
        100% { opacity: 0;   transform: scale(1.6); }
      }
      @keyframes jamSignatureSpin {
        0%   { transform: rotate(0deg)   scale(1);    }
        50%  { transform: rotate(180deg) scale(1.12); }
        100% { transform: rotate(360deg) scale(1);    }
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
