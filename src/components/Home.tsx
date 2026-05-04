/**
 * Home — BURST hero stage view.
 *
 * Faithful port of the home design from the Claude Design handoff,
 * wired to live store state. Layout below the HUD:
 *
 *   ┌─────────────────────────────┐
 *   │   ┌──────────────────────┐  │
 *   │   │   stage panel         │  │
 *   │   │  [BOOTH]    [FRIENDS] │  │
 *   │   │                       │  │
 *   │   │       MASCOT 🎧       │  │
 *   │   │       "let's cook 🤝" │  │
 *   │   │                       │  │
 *   │   │  [STUDIO]   [CHARTS]  │  │
 *   │   └──────────────────────┘  │
 *   │                              │
 *   │  ┌──────────────────────┐   │
 *   │  │   COOK A TRACK       │   │
 *   │  └──────────────────────┘   │
 *   │                              │
 *   │      [crib]  [logbook]       │
 *   └─────────────────────────────┘
 */

import { useEffect } from "react";
import { useStore } from "../store/useStore";
import { StudioScene } from "../ui/StudioScene";
import { Mascot }      from "../ui/burst/Mascot";
import { SpeechBubble } from "../ui/burst/SpeechBubble";
import { NavButton }    from "../ui/burst/NavButton";
import { CookCTA }      from "../ui/burst/CookCTA";
import { GhostPill }    from "../ui/burst/GhostPill";
import { Icon }         from "../ui/burst/Icon";
import { C, chrome }    from "../ui/burst/tokens";
import { CharacterFace } from "../ui/CharacterFace";
import { NeedsMeters }   from "./NeedsMeters";
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
  const hasTracks     = inventory.length > 0;

  const mood: Mood = moodOverride ?? tamagotchi.mood;

  useEffect(() => {
    sayLine(TALK_LINES[mood], 6000);
    return () => sayLine(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

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
      {/* ── Stage panel ──
       * Chunky chrome frame with the StudioScene backdrop inside, the
       * mascot center stage, and four corner nav buttons sitting on
       * the chrome rim. */}
      <div
        style={{
          position: "relative",
          height: 480,
          borderRadius: 24,
          ...chrome(`linear-gradient(180deg, ${C.navyLight}, ${C.navyDeep})`),
          padding: 6,
        }}
      >
        <StudioScene>
          <Mascot />
        </StudioScene>

        {/* Speech bubble — drops UNDER the top banner, anchored to the
         *  mascot's position on the left. Tail points up-left toward
         *  the mascot so it reads as the pet talking, not the avatar. */}
        {dawTalk && (
          <SpeechBubble
            text={dawTalk}
            tailSide="top"
            top={78}
            left={20}
            maxWidth={240}
          />
        )}

        {/* Top banner — single dark-transparent strip across the panel
         *  top, holding the mascot on the left and the 3 needs bars on
         *  the right. Bars use bare mode (no per-pill bg) so the banner
         *  is the only background. */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 8,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "6px 10px",
            borderRadius: 14,
            background: "rgba(10,8,20,0.78)",
            border: "1.5px solid rgba(0,0,0,0.7)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 1px rgba(0,0,0,0.5)",
          }}
        >
          <button
            onClick={() => setStage("pet")}
            aria-label="open pet portal"
            style={{
              flexShrink: 0,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "block",
            }}
          >
            <CharacterFace size={56} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <NeedsMeters tam={tamagotchi} compact bare />
          </div>
        </div>

        {/* Nav buttons — BOOTH stacks on top of STUDIO (left column),
         *  FRIENDS stacks on top of CHARTS (right column). STUDIO and
         *  CHARTS stay pinned to the bottom corners; BOOTH and FRIENDS
         *  sit just above them with a 12px gap. */}
        <NavButton
          style={{ left: 12, bottom: 100 }}
          gradFrom={C.pink}
          gradTo={C.coral}
          halo={`${C.pink}88`}
          icon={<Icon.Headphones size={26} />}
          label="BOOTH"
          onPress={() => setStage("booth")}
        />
        <NavButton
          style={{ right: 12, bottom: 100 }}
          gradFrom="#ff7a8e"
          gradTo={C.coralDeep}
          halo={`${C.coral}88`}
          icon={<Icon.Handshake size={26} />}
          label="FRIENDS"
          onPress={() => setStage("friends")}
        />
        <NavButton
          pos="bl"
          gradFrom={C.green}
          gradTo="#16a34a"
          halo={`${C.green}88`}
          icon={<Icon.Sliders size={24} />}
          label="STUDIO"
          onPress={() => setStage("studio")}
        />
        <NavButton
          pos="br"
          gradFrom={C.goldLight}
          gradTo="#a07a0c"
          halo={`${C.gold}99`}
          icon={<Icon.Trophy size={24} />}
          label="CHARTS"
          onPress={() => setStage("leaderboard")}
        />
      </div>

      {/* ── Hero CTA ── */}
      <div>
        <CookCTA onPress={() => setStage("template")} />
      </div>

      {/* ── Tertiary row ──
       * "JAM (NEW)" launches the experimental Incredibox-style stage —
       * lives next to YOUR SONGS for now while we test the mode. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <GhostPill onClick={toggleLogbook}>
          📓 YOUR SONGS{hasTracks && ` · ${inventory.length}`}
        </GhostPill>
        <GhostPill onClick={() => setStage("jam")}>
          🎛️ JAM (NEW)
        </GhostPill>
      </div>
    </div>
  );
}
