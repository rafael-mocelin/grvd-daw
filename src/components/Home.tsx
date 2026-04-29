/**
 * Home — BURST hero stage view.
 *
 * Layout below the HUD:
 *
 *   ┌─────────────────────────────────────┐
 *   │  ┌────────────────────────────────┐ │
 *   │  │ [mascot] [💬 social bar    ]   │ │  ← top strip
 *   │  │          [🎨 creativity bar]   │ │
 *   │  │          [⚡ energy bar     ]  │ │
 *   │  │                                 │ │
 *   │  │ [BOOTH]              [FRIENDS]  │ │  ← left + right column,
 *   │  │ [STUDIO]              [CHARTS]  │ │     stacked vertically
 *   │  │                                 │ │
 *   │  │           [PROFILE PIC]         │ │  ← clickable, opens Profile
 *   │  │           "let's cook 🤝"      │ │
 *   │  └────────────────────────────────┘ │
 *   │                                      │
 *   │  ┌──────────────────────────────┐   │
 *   │  │   COOK A TRACK                │   │
 *   │  └──────────────────────────────┘   │
 *   │                                      │
 *   │           [📓 YOUR SONGS]            │
 *   └─────────────────────────────────────┘
 *
 * The center circle is the player-profile entry — tap to open
 * TastemakerProfile. The big chibi avatar mascot used to live there;
 * now it's been reframed as the player's "selfie" surface, and the
 * pet/needs sit in the top strip.
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { StudioScene } from "../ui/StudioScene";
import { CharacterFace } from "../ui/CharacterFace";
import { NeedsMeters }   from "./NeedsMeters";
import { SpeechBubble } from "../ui/burst/SpeechBubble";
import { NavButton }    from "../ui/burst/NavButton";
import { CookCTA }      from "../ui/burst/CookCTA";
import { GhostPill }    from "../ui/burst/GhostPill";
import { Icon }         from "../ui/burst/Icon";
import { C, chrome }    from "../ui/burst/tokens";
import type { Mood } from "../data/types";

const TALK_LINES: Record<Mood, string> = {
  asleep: "zzz...",
  sleepy: "ok... what we doing today",
  chill:  "pick a vibe. the booth's open too.",
  happy:  "let's cook 🤝",
  hyped:  "LET'S GOOOO 🔥",
  sad:    "put on something. it helps.",
  lonely: "wanna see what someone's been working on?",
};

export function Home() {
  const tamagotchi    = useStore((s) => s.tamagotchi);
  const moodOverride  = useStore((s) => s.moodOverride);
  const setStage      = useStore((s) => s.setStage);
  const toggleLogbook = useStore((s) => s.toggleLogbook);
  const sayLine       = useStore((s) => s.sayLine);
  const dawTalk       = useStore((s) => s.dawTalk);
  const inventory     = useStore((s) => s.inventory);
  const player        = useStore((s) => s.player);
  const userId        = useStore((s) => s.userId);
  const openProfile   = useStore((s) => s.openProfile);
  const hasTracks     = inventory.length > 0;

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  useEffect(() => {
    sayLine(TALK_LINES[mood], 6000);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  function goToProfile() {
    // openProfile(null) opens the player's own TastemakerProfile.
    // If somehow openProfile isn't wired (e.g. guest), fall back to
    // setStage("profile") which dispatches via profileUserId === null.
    if (userId) openProfile(userId);
    else        setStage("profile");
  }

  return (
    <div
      style={{
        paddingTop: 6,
        paddingBottom: 18,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        maxWidth: 400,
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* ── Stage panel ── */}
      <div
        style={{
          position: "relative",
          height: 520,
          borderRadius: 24,
          ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
          padding: 6,
        }}
      >
        <StudioScene>
          {/* Top strip: live pet (left) + companion needs bars (right). */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              right: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 8,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <CharacterFace size={64} bob />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <NeedsMeters tam={tamagotchi} compact />
            </div>
          </div>

          {/* Left column: BOOTH on top, STUDIO below. */}
          <NavButton
            style={{ left: 12, top: 110 }}
            gradFrom={C.pink}
            gradTo={C.coral}
            halo={`${C.pink}88`}
            icon={<Icon.Headphones size={26} />}
            label="BOOTH"
            onPress={() => setStage("booth")}
          />
          <NavButton
            style={{ left: 12, bottom: 12 }}
            gradFrom={C.green}
            gradTo="#16a34a"
            halo={`${C.green}88`}
            icon={<Icon.Sliders size={24} />}
            label="STUDIO"
            onPress={() => setStage("studio")}
          />

          {/* Right column: FRIENDS on top, CHARTS below. */}
          <NavButton
            style={{ right: 12, top: 110 }}
            gradFrom="#ff7a8e"
            gradTo={C.coralDeep}
            halo={`${C.coral}88`}
            icon={<Icon.Handshake size={26} />}
            label="FRIENDS"
            onPress={() => setStage("friends")}
          />
          <NavButton
            style={{ right: 12, bottom: 12 }}
            gradFrom={C.goldLight}
            gradTo="#a07a0c"
            halo={`${C.gold}99`}
            icon={<Icon.Trophy size={24} />}
            label="CHARTS"
            onPress={() => setStage("leaderboard")}
          />

          {/* Center: profile picture circle — tap to open the player's
           *  TastemakerProfile. Big circular chunky chrome with the
           *  player's avatar emoji centered. */}
          <button
            onClick={goToProfile}
            aria-label="open your profile"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 150,
              height: 150,
              borderRadius: "50%",
              border: "4px solid #0a0f1c",
              background: `radial-gradient(circle at 35% 30%, ${C.navyLight}, ${C.navyDeep} 70%, #0a0f1c)`,
              boxShadow: [
                "inset 0 4px 0 rgba(255,255,255,0.25)",
                "inset 0 -6px 0 rgba(0,0,0,0.4)",
                "inset 0 0 0 4px rgba(255,255,255,0.12)",
                "0 12px 32px rgba(0,0,0,0.55)",
                "0 0 36px rgba(167,139,250,0.4)",
              ].join(", "),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 9,
              padding: 0,
            }}
          >
            {/* Glossy top highlight */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: "6px 6px auto 6px",
                height: "40%",
                borderRadius: "50% 50% 40% 40% / 50% 50% 22% 22%",
                background: "linear-gradient(180deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 100%)",
                pointerEvents: "none",
              }}
            />
            <span
              style={{
                fontSize: 80,
                lineHeight: 1,
                filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
              }}
            >
              {player?.avatar || "🧢"}
            </span>
            {/* "you" caption hugging the bottom — gold pill like LV badge */}
            <span
              aria-hidden
              style={{
                position: "absolute",
                bottom: -10,
                left: "50%",
                transform: "translateX(-50%)",
                padding: "2px 10px",
                borderRadius: 10,
                background: `linear-gradient(180deg, ${C.goldLight}, ${C.gold})`,
                border: "2px solid #0a0f1c",
                fontFamily: "'Lilita One', system-ui",
                fontSize: 11,
                color: "#3a2906",
                letterSpacing: 0.5,
                boxShadow: "0 3px 0 rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.7)",
                textShadow: "0 1px 0 rgba(255,255,255,0.4)",
                whiteSpace: "nowrap",
              }}
            >
              YOU
            </span>
          </button>

          {/* Speech bubble — moved to sit just below the profile pic so
           *  it still reads as the pet talking, but doesn't collide with
           *  the new top strip. */}
          {dawTalk && <SpeechBubble text={dawTalk} bottom={70} right={36} />}
        </StudioScene>
      </div>

      {/* ── Hero CTA ── */}
      <div>
        <CookCTA onPress={() => setStage("template")} />
      </div>

      {/* ── Tertiary row ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <GhostPill onClick={toggleLogbook}>
          📓 YOUR SONGS{hasTracks && ` · ${inventory.length}`}
        </GhostPill>
      </div>
    </div>
  );
}
